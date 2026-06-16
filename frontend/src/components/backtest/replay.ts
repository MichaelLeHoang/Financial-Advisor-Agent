import type { BacktestEquityPoint, Candle, ReplayTrade } from "@/lib/api";

export interface ReplayPositionState {
  cash: number;
  positionQty: number;
  positionAvgPrice: number;
}

export interface ReplayMetrics {
  total_return: number;
  max_drawdown: number;
  win_rate: number;
  number_of_trades: number;
  fees_paid: number;
  final_equity: number;
}

export function equityAt(state: ReplayPositionState, price: number): number {
  return state.cash + state.positionQty * price;
}

export function executeOrder(
  state: ReplayPositionState,
  side: "buy" | "sell",
  quantity: number,
  price: number,
  date: string,
  feeBps = 0
): { state: ReplayPositionState; trade: ReplayTrade | null } {
  if (quantity <= 0 || price <= 0) return { state, trade: null };
  const feeRate = feeBps / 10_000;

  if (side === "buy") {
    const affordable = state.cash / (price * (1 + feeRate));
    const qty = Math.min(quantity, affordable);
    if (qty <= 0) return { state, trade: null };
    const cost = qty * price;
    const fee = cost * feeRate;
    const nextQty = state.positionQty + qty;
    return {
      state: {
        cash: state.cash - cost - fee,
        positionQty: nextQty,
        positionAvgPrice: (state.positionQty * state.positionAvgPrice + cost + fee) / nextQty,
      },
      trade: { date, side, quantity: round6(qty), price, fee: round4(fee), pnl: null },
    };
  }

  const qty = Math.min(quantity, state.positionQty);
  if (qty <= 0) return { state, trade: null };
  const gross = qty * price;
  const fee = gross * feeRate;
  const pnl = gross - fee - qty * state.positionAvgPrice;
  const nextQty = state.positionQty - qty;
  return {
    state: {
      cash: state.cash + gross - fee,
      positionQty: nextQty,
      positionAvgPrice: nextQty > 0 ? state.positionAvgPrice : 0,
    },
    trade: { date, side, quantity: round6(qty), price, fee: round4(fee), pnl: round4(pnl) },
  };
}

export function computeReplayMetrics(
  trades: ReplayTrade[],
  equityCurve: BacktestEquityPoint[],
  initialBalance: number
): ReplayMetrics {
  const finalEquity = equityCurve.length > 0 ? equityCurve[equityCurve.length - 1].value : initialBalance;
  const sells = trades.filter((trade) => trade.side === "sell" && trade.pnl !== null && trade.pnl !== undefined);
  const wins = sells.filter((trade) => (trade.pnl ?? 0) > 0);

  let peak = -Infinity;
  let maxDrawdown = 0;
  for (const point of equityCurve) {
    peak = Math.max(peak, point.value);
    if (peak > 0) maxDrawdown = Math.min(maxDrawdown, point.value / peak - 1);
  }

  return {
    total_return: round6(finalEquity / initialBalance - 1),
    max_drawdown: round6(maxDrawdown),
    win_rate: sells.length > 0 ? round4(wins.length / sells.length) : 0,
    number_of_trades: sells.length,
    fees_paid: round4(trades.reduce((sum, trade) => sum + trade.fee, 0)),
    final_equity: round4(finalEquity),
  };
}

export function positionFromTrades(trades: ReplayTrade[], initialBalance: number): ReplayPositionState {
  let cash = initialBalance;
  let qty = 0;
  let avgPrice = 0;
  for (const trade of trades) {
    if (trade.side === "buy") {
      const cost = trade.quantity * trade.price + trade.fee;
      avgPrice = (qty * avgPrice + cost) / (qty + trade.quantity);
      cash -= cost;
      qty += trade.quantity;
    } else {
      cash += trade.quantity * trade.price - trade.fee;
      qty = Math.max(qty - trade.quantity, 0);
      if (qty === 0) avgPrice = 0;
    }
  }
  return { cash: round4(cash), positionQty: round6(qty), positionAvgPrice: round4(avgPrice) };
}

export function rebuildEquityCurve(
  candles: Candle[],
  trades: ReplayTrade[],
  initialBalance: number,
  upToIndex: number
): BacktestEquityPoint[] {
  const tradesByDate = new Map<string, ReplayTrade[]>();
  for (const trade of trades) {
    const list = tradesByDate.get(trade.date);
    if (list) list.push(trade);
    else tradesByDate.set(trade.date, [trade]);
  }

  let cash = initialBalance;
  let qty = 0;
  const curve: BacktestEquityPoint[] = [];
  const last = Math.min(upToIndex, candles.length - 1);
  for (let i = 0; i <= last; i++) {
    for (const trade of tradesByDate.get(candles[i].date) ?? []) {
      if (trade.side === "buy") {
        cash -= trade.quantity * trade.price + trade.fee;
        qty += trade.quantity;
      } else {
        cash += trade.quantity * trade.price - trade.fee;
        qty = Math.max(qty - trade.quantity, 0);
      }
    }
    curve.push({ date: candles[i].date, value: round4(cash + qty * candles[i].close) });
  }
  return curve;
}

export function computeDrawdownSeries(equityCurve: BacktestEquityPoint[]): BacktestEquityPoint[] {
  let peak = -Infinity;
  return equityCurve.map((point) => {
    peak = Math.max(peak, point.value);
    return { date: point.date, value: peak > 0 ? round6(point.value / peak - 1) : 0 };
  });
}

function round4(value: number) {
  return Math.round(value * 10_000) / 10_000;
}

function round6(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}
