from datetime import datetime, timezone
from math import sqrt

import numpy as np
import pandas as pd

from src.backtesting.market_data import MarketDataAdapter
from src.backtesting.models import BacktestMetrics, BacktestRequest, EquityPoint
from src.saas.models import BacktestTradeCreate


def run_backtest(req: BacktestRequest, adapter: MarketDataAdapter) -> tuple[BacktestMetrics, list[EquityPoint], list[BacktestTradeCreate]]:
    prices = adapter.fetch_prices(req.symbols, req.start_date, req.end_date)
    missing = sorted(set(req.symbols) - set(prices))
    if missing:
        raise ValueError(f"No price data returned for: {', '.join(missing)}")

    allocation = req.initial_capital / len(req.symbols)
    curves = []
    all_trades: list[BacktestTradeCreate] = []

    for symbol in req.symbols:
        symbol_prices = prices[symbol].astype(float).dropna()
        if len(symbol_prices) < 3:
            raise ValueError(f"Not enough price data returned for {symbol}")
        signals = _signals(req.strategy_type, symbol_prices, req.parameters)
        curve, trades = _simulate_symbol(
            symbol=symbol,
            prices=symbol_prices,
            signals=signals,
            initial_cash=allocation,
            fees_bps=req.fees_bps,
            slippage_bps=req.slippage_bps,
            position_size=req.position_size,
        )
        curves.append(curve)
        all_trades.extend(trades)

    portfolio_curve = pd.concat(curves, axis=1).ffill().sum(axis=1)
    metrics = _metrics(portfolio_curve, all_trades, req.initial_capital)
    equity_curve = [
        EquityPoint(date=index.date() if hasattr(index, "date") else index, value=round(float(value), 2))
        for index, value in portfolio_curve.items()
    ]
    return metrics, equity_curve, sorted(all_trades, key=lambda trade: trade.executed_at)


def _signals(strategy_type: str, prices: pd.Series, parameters: dict) -> pd.Series:
    if strategy_type == "buy_and_hold":
        return pd.Series(1, index=prices.index)

    if strategy_type == "moving_average_crossover":
        short_window = int(parameters.get("short_window", 20))
        long_window = int(parameters.get("long_window", 50))
        if short_window >= long_window:
            raise ValueError("short_window must be less than long_window")
        short_ma = prices.rolling(short_window, min_periods=1).mean()
        long_ma = prices.rolling(long_window, min_periods=1).mean()
        return (short_ma > long_ma).astype(int)

    if strategy_type == "rsi_mean_reversion":
        window = int(parameters.get("rsi_window", 14))
        buy_threshold = float(parameters.get("buy_threshold", 30))
        sell_threshold = float(parameters.get("sell_threshold", 55))
        rsi = _rsi(prices, window)
        state = 0
        values = []
        for value in rsi:
            if state == 0 and value <= buy_threshold:
                state = 1
            elif state == 1 and value >= sell_threshold:
                state = 0
            values.append(state)
        return pd.Series(values, index=prices.index)

    raise ValueError(f"Unsupported strategy_type: {strategy_type}")


def _simulate_symbol(
    *,
    symbol: str,
    prices: pd.Series,
    signals: pd.Series,
    initial_cash: float,
    fees_bps: float,
    slippage_bps: float,
    position_size: float,
) -> tuple[pd.Series, list[BacktestTradeCreate]]:
    cash = float(initial_cash)
    quantity = 0.0
    entry_cost_basis = 0.0
    values = []
    trades: list[BacktestTradeCreate] = []

    for timestamp, price in prices.items():
        signal = int(signals.loc[timestamp])
        price = float(price)
        if signal == 1 and quantity == 0:
            deployable_cash = cash * position_size
            buy_price = price * (1 + slippage_bps / 10_000)
            fee = deployable_cash * fees_bps / 10_000
            quantity = max((deployable_cash - fee) / buy_price, 0)
            cash -= quantity * buy_price + fee
            entry_cost_basis = quantity * buy_price + fee
            trades.append(_trade(symbol, "buy", quantity, buy_price, fee, None, "signal_entry", timestamp))
        elif signal == 0 and quantity > 0:
            sell_price = price * (1 - slippage_bps / 10_000)
            gross = quantity * sell_price
            fee = gross * fees_bps / 10_000
            pnl = gross - fee - entry_cost_basis
            cash += gross - fee
            trades.append(_trade(symbol, "sell", quantity, sell_price, fee, pnl, "signal_exit", timestamp))
            quantity = 0
            entry_cost_basis = 0

        values.append(cash + quantity * price)

    if quantity > 0:
        timestamp = prices.index[-1]
        price = float(prices.iloc[-1])
        sell_price = price * (1 - slippage_bps / 10_000)
        gross = quantity * sell_price
        fee = gross * fees_bps / 10_000
        pnl = gross - fee - entry_cost_basis
        cash += gross - fee
        trades.append(_trade(symbol, "sell", quantity, sell_price, fee, pnl, "final_close", timestamp))
        values[-1] = cash

    return pd.Series(values, index=prices.index), trades


def _trade(
    symbol: str,
    side: str,
    quantity: float,
    price: float,
    fees: float,
    pnl: float | None,
    reason: str,
    timestamp,
) -> BacktestTradeCreate:
    if hasattr(timestamp, "to_pydatetime"):
        executed_at = timestamp.to_pydatetime()
    elif isinstance(timestamp, datetime):
        executed_at = timestamp
    else:
        executed_at = datetime.combine(timestamp, datetime.min.time())
    if executed_at.tzinfo is None:
        executed_at = executed_at.replace(tzinfo=timezone.utc)
    return BacktestTradeCreate(
        symbol=symbol,
        side=side,
        quantity=round(float(quantity), 6),
        price=round(float(price), 4),
        fees=round(float(fees), 4),
        pnl=round(float(pnl), 4) if pnl is not None else None,
        reason=reason,
        executed_at=executed_at,
    )


def _metrics(equity: pd.Series, trades: list[BacktestTradeCreate], initial_capital: float) -> BacktestMetrics:
    final_value = float(equity.iloc[-1])
    total_return = final_value / initial_capital - 1
    days = max((equity.index[-1] - equity.index[0]).days if hasattr(equity.index[-1] - equity.index[0], "days") else len(equity), 1)
    annualized_return = (final_value / initial_capital) ** (365 / days) - 1 if final_value > 0 else -1

    returns = equity.pct_change().replace([np.inf, -np.inf], np.nan).dropna()
    sharpe = 0.0
    if not returns.empty and float(returns.std()) > 0:
        sharpe = float((returns.mean() / returns.std()) * sqrt(252))

    drawdown = equity / equity.cummax() - 1
    realized = [float(trade.pnl) for trade in trades if trade.side == "sell" and trade.pnl is not None]
    wins = [pnl for pnl in realized if pnl > 0]
    losses = [pnl for pnl in realized if pnl < 0]
    profit_factor = (sum(wins) / abs(sum(losses))) if losses else None

    return BacktestMetrics(
        total_return=round(total_return, 6),
        annualized_return=round(float(annualized_return), 6),
        max_drawdown=round(float(drawdown.min()), 6),
        sharpe_ratio=round(sharpe, 4),
        win_rate=round(len(wins) / len(realized), 4) if realized else 0,
        profit_factor=round(profit_factor, 4) if isinstance(profit_factor, float) else profit_factor,
        number_of_trades=len(realized),
        fees_paid=round(sum(float(trade.fees) for trade in trades), 4),
    )


def _rsi(prices: pd.Series, window: int) -> pd.Series:
    delta = prices.diff()
    gain = delta.clip(lower=0).rolling(window, min_periods=1).mean()
    loss = -delta.clip(upper=0).rolling(window, min_periods=1).mean()
    rs = gain / loss.replace(0, np.nan)
    rsi = 100 - (100 / (1 + rs))
    return rsi.fillna(50)
