"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Line, LineChart as ReLineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowLeft, Pause, Play, StepForward } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { BacktestEquityPoint, Candle, ReplaySession, ReplayTrade } from "@/lib/api";
import { useAuth } from "@/components/auth/AuthProvider";
import { LockedFeature } from "@/components/LockedFeature";
import CandlestickChart from "@/components/backtest/CandlestickChart";
import { computeReplayMetrics, equityAt, executeOrder } from "@/components/backtest/replay";
import type { ReplayPositionState } from "@/components/backtest/replay";
import { Metric, PLAN_RANK, formatCurrency, formatPercent } from "@/components/backtest/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const SPEEDS = [
  { label: "1x", intervalMs: 1000 },
  { label: "2x", intervalMs: 500 },
  { label: "5x", intervalMs: 200 },
  { label: "10x", intervalMs: 100 },
];

interface ReplayState extends ReplayPositionState {
  visibleIndex: number;
  trades: ReplayTrade[];
  equityCurve: BacktestEquityPoint[];
}

export default function ReplaySessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const [session, setSession] = useState<ReplaySession | null>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [replay, setReplay] = useState<ReplayState | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speedIndex, setSpeedIndex] = useState(1);
  const [qtyInput, setQtyInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const finishedRef = useRef(false);
  const replayRef = useRef<ReplayState | null>(null);
  replayRef.current = replay;

  const canUseBacktesting = PLAN_RANK[user.plan] >= PLAN_RANK.trader;

  useEffect(() => {
    if (!canUseBacktesting) return;
    let cancelled = false;

    const load = async () => {
      try {
        const fetched = await api.replaySession(id);
        if (cancelled) return;
        const response = await api.backtestCandles([fetched.symbol], fetched.start_date, fetched.end_date);
        if (cancelled) return;
        const bars = response.candles[fetched.symbol] ?? [];
        const isDone = fetched.status === "completed";
        const visibleIndex = isDone ? bars.length : Math.min(Math.max(fetched.current_index, 1), bars.length);

        const state: ReplayState = {
          cash: fetched.cash,
          positionQty: fetched.position_qty,
          positionAvgPrice: fetched.position_avg_price,
          visibleIndex,
          trades: fetched.trades,
          equityCurve: fetched.equity_curve.length > 0 ? fetched.equity_curve : bars.slice(0, visibleIndex).map((bar) => ({ date: bar.date, value: fetched.initial_balance })),
        };
        setSession(fetched);
        setCandles(bars);
        setReplay(state);
        setCompleted(isDone);
        finishedRef.current = isDone;
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) setError("This replay session no longer exists.");
        else setError(err instanceof Error ? err.message : "Unable to load the replay session.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [canUseBacktesting, id]);

  const step = useCallback(() => {
    setReplay((prev) => {
      if (!prev || prev.visibleIndex >= candles.length) return prev;
      const nextIndex = prev.visibleIndex + 1;
      const bar = candles[nextIndex - 1];
      dirtyRef.current = true;
      return {
        ...prev,
        visibleIndex: nextIndex,
        equityCurve: [...prev.equityCurve, { date: bar.date, value: Math.round(equityAt(prev, bar.close) * 100) / 100 }],
      };
    });
  }, [candles]);

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(step, SPEEDS[speedIndex].intervalMs);
    return () => clearInterval(timer);
  }, [playing, speedIndex, step]);

  const persist = useCallback(
    async (extra?: Partial<Parameters<typeof api.updateReplaySession>[1]>) => {
      const current = replayRef.current;
      if (!current || savingRef.current) return;
      savingRef.current = true;
      dirtyRef.current = false;
      try {
        await api.updateReplaySession(id, {
          current_index: current.visibleIndex,
          cash: current.cash,
          position_qty: current.positionQty,
          position_avg_price: current.positionAvgPrice,
          trades: current.trades,
          equity_curve: current.equityCurve,
          ...extra,
        });
      } catch {
        dirtyRef.current = true;
      } finally {
        savingRef.current = false;
      }
    },
    [id]
  );

  useEffect(() => {
    if (!replay || completed) return;
    const timer = setTimeout(() => {
      if (dirtyRef.current) void persist();
    }, 2000);
    return () => clearTimeout(timer);
  }, [replay, completed, persist]);

  useEffect(() => {
    return () => {
      if (dirtyRef.current) void persist();
    };
  }, [persist]);

  useEffect(() => {
    if (!replay || !session || candles.length === 0 || finishedRef.current) return;
    if (replay.visibleIndex < candles.length) return;
    finishedRef.current = true;
    setPlaying(false);

    const lastBar = candles[candles.length - 1];
    let finalState: ReplayPositionState = replay;
    let finalTrades = replay.trades;
    if (replay.positionQty > 0) {
      const closed = executeOrder(replay, "sell", replay.positionQty, lastBar.close, lastBar.date);
      finalState = closed.state;
      if (closed.trade) finalTrades = [...finalTrades, { ...closed.trade, pnl: closed.trade.pnl }];
    }
    const equityCurve = [...replay.equityCurve.slice(0, -1), { date: lastBar.date, value: Math.round(equityAt(finalState, lastBar.close) * 100) / 100 }];
    const metrics = computeReplayMetrics(finalTrades, equityCurve, session.initial_balance);

    setReplay((prev) => (prev ? { ...prev, ...finalState, trades: finalTrades, equityCurve } : prev));
    setCompleted(true);
    replayRef.current = { ...replay, ...finalState, trades: finalTrades, equityCurve };
    void persist({ status: "completed", metrics: metrics as unknown as Record<string, number> });
  }, [replay, session, candles, persist]);

  const currentBar = replay && replay.visibleIndex > 0 ? candles[replay.visibleIndex - 1] : null;
  const equity = replay && currentBar ? equityAt(replay, currentBar.close) : session?.initial_balance ?? 0;
  const returnPct = session ? equity / session.initial_balance - 1 : 0;
  const unrealizedPnl = replay && currentBar ? replay.positionQty * (currentBar.close - replay.positionAvgPrice) : 0;

  const markers = useMemo(
    () => replay?.trades.map((trade) => ({ time: trade.date, side: trade.side })) ?? [],
    [replay?.trades]
  );
  const sparkData = useMemo(
    () => replay?.equityCurve.map((point) => ({ date: point.date.slice(5), value: point.value })) ?? [],
    [replay?.equityCurve]
  );

  if (!canUseBacktesting) {
    return (
      <LockedFeature
        title="Backtest Lab is available on Trader"
        description="Practice trading with bar-by-bar market replay and manual order entry."
        requiredPlan="trader"
        benefits={["Manual replay sessions", "Bar-by-bar playback", "Resume sessions anytime"]}
      />
    );
  }

  const placeOrder = (side: "buy" | "sell", quantityOverride?: number) => {
    if (!replay || !currentBar || completed) return;
    const quantity = quantityOverride ?? Number(qtyInput);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError("Enter a valid quantity.");
      return;
    }
    setError(null);
    const { state, trade } = executeOrder(replay, side, quantity, currentBar.close, currentBar.date);
    if (!trade) {
      setError(side === "buy" ? "Not enough cash for that order." : "No position to sell.");
      return;
    }
    dirtyRef.current = true;
    setReplay({
      ...replay,
      ...state,
      trades: [...replay.trades, trade],
      equityCurve: [...replay.equityCurve.slice(0, -1), { date: currentBar.date, value: Math.round(equityAt(state, currentBar.close) * 100) / 100 }],
    });
  };

  const buyPercent = (fraction: number) => {
    if (!replay || !currentBar) return;
    placeOrder("buy", (replay.cash * fraction) / currentBar.close);
  };

  const togglePlay = () => {
    setPlaying((current) => {
      if (current && dirtyRef.current) void persist();
      return !current;
    });
  };

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <Link href="/trade/strategies/sessions" className="inline-flex w-fit items-center gap-2 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]">
          <ArrowLeft className="h-4 w-4" />
          Back to sessions
        </Link>

        {loading && <Card className="rounded-2xl border border-[var(--theme-border)] bg-[var(--surface-card)] py-0"><CardContent className="p-6 text-sm text-[var(--text-muted)]">Loading session...</CardContent></Card>}
        {error && !session && <Card className="rounded-2xl border border-[var(--theme-border)] bg-[var(--surface-card)] py-0"><CardContent className="p-6 text-sm text-red-negative">{error}</CardContent></Card>}

        {session && replay && (
          <>
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <h1 className="text-3xl font-bold text-[var(--text-primary)]">{session.name}</h1>
                <p className="mt-2 text-sm text-[var(--text-muted)]">
                  {session.symbol} · {session.start_date} → {session.end_date} · Fills simulated at daily close
                </p>
              </div>
              <span
                className={cn(
                  "h-fit rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wider",
                  completed ? "bg-green-positive/15 text-green-positive" : "bg-indigo-primary/15 text-indigo-primary"
                )}
              >
                {completed ? "Completed" : "Active"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Metric label="Equity" value={formatCurrency(equity)} />
              <Metric label="Return" value={formatPercent(returnPct)} tone={returnPct >= 0 ? "positive" : "negative"} />
              <Metric label="Cash" value={formatCurrency(replay.cash)} />
              <Metric
                label={replay.positionQty > 0 ? `Position ${replay.positionQty.toFixed(3)} @ ${formatCurrency(replay.positionAvgPrice)}` : "Position"}
                value={replay.positionQty > 0 ? formatCurrency(unrealizedPnl) : "Flat"}
                tone={replay.positionQty > 0 ? (unrealizedPnl >= 0 ? "positive" : "negative") : undefined}
              />
            </div>

            <Card className="rounded-2xl border border-[var(--theme-border)] bg-[var(--surface-card)] py-0 text-[var(--text-primary)] shadow-[var(--shadow-card)]">
              <CardContent className="p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm font-semibold">
                    {session.symbol} · {currentBar ? currentBar.date : ""} · {currentBar ? formatCurrency(currentBar.close) : ""}
                  </div>
                  {!completed && (
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={togglePlay} className="h-9 w-24 rounded-lg text-xs">
                        {playing ? <Pause className="mr-1 h-3.5 w-3.5" /> : <Play className="mr-1 h-3.5 w-3.5" />}
                        {playing ? "Pause" : "Play"}
                      </Button>
                      <Button variant="outline" size="sm" onClick={step} disabled={playing} className="h-9 rounded-lg text-xs">
                        <StepForward className="mr-1 h-3.5 w-3.5" />
                        Step
                      </Button>
                      <div className="flex overflow-hidden rounded-lg border border-[var(--theme-border)]">
                        {SPEEDS.map((speed, index) => (
                          <button
                            key={speed.label}
                            type="button"
                            onClick={() => setSpeedIndex(index)}
                            className={cn(
                              "px-2.5 py-1.5 text-xs font-semibold transition-colors",
                              speedIndex === index ? "bg-indigo-primary/15 text-indigo-primary" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                            )}
                          >
                            {speed.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <CandlestickChart candles={candles} markers={markers} visibleCount={replay.visibleIndex} height={380} />

                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[var(--surface-control)]">
                  <div className="h-full rounded-full bg-indigo-primary/70" style={{ width: `${candles.length > 0 ? Math.round((replay.visibleIndex / candles.length) * 100) : 0}%` }} />
                </div>
                <div className="mt-1 text-[10px] text-[var(--text-muted)]">
                  Bar {replay.visibleIndex} of {candles.length}
                </div>
              </CardContent>
            </Card>

            {error && <div className="text-sm text-red-negative">{error}</div>}

            <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
              {!completed ? (
                <Card className="rounded-2xl border border-[var(--theme-border)] bg-[var(--surface-card)] py-0 text-[var(--text-primary)] shadow-[var(--shadow-card)]">
                  <CardContent className="space-y-4 p-5">
                    <div className="text-sm font-semibold">Order ticket</div>
                    <div className="flex items-end gap-3">
                      <div className="flex-1">
                        <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">Quantity</div>
                        <Input type="number" min={0} step="any" value={qtyInput} placeholder="Shares" onChange={(event) => setQtyInput(event.target.value)} className="h-11 rounded-xl" />
                      </div>
                      <div className="flex gap-1">
                        {[0.25, 0.5, 1].map((fraction) => (
                          <button
                            key={fraction}
                            type="button"
                            onClick={() => buyPercent(fraction)}
                            className="rounded-lg border border-[var(--theme-border)] bg-[var(--surface-card-hover)] px-2.5 py-2 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-control-hover)]"
                          >
                            {Math.round(fraction * 100)}%
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Button onClick={() => placeOrder("buy")} className="h-11 rounded-xl bg-green-positive/90 text-sm font-semibold text-white hover:bg-green-positive">
                        Buy
                      </Button>
                      <Button onClick={() => placeOrder("sell")} className="h-11 rounded-xl bg-red-negative/90 text-sm font-semibold text-white hover:bg-red-negative">
                        Sell
                      </Button>
                    </div>
                    <Button variant="outline" onClick={() => replay.positionQty > 0 && placeOrder("sell", replay.positionQty)} disabled={replay.positionQty <= 0} className="h-10 w-full rounded-xl text-xs">
                      Close position
                    </Button>
                    <p className="text-xs leading-5 text-[var(--text-muted)]">
                      Orders fill at the current bar's close with no fees. The percent buttons size a buy from available cash.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <Card className="rounded-2xl border border-green-positive/25 bg-[var(--surface-card)] py-0 text-[var(--text-primary)] shadow-[var(--shadow-card)]">
                  <CardContent className="space-y-4 p-5">
                    <div className="text-sm font-semibold">Session summary</div>
                    <div className="grid grid-cols-2 gap-3">
                      <Metric label="Total return" value={formatPercent(Number(session.metrics.total_return ?? returnPct))} tone={returnPct >= 0 ? "positive" : "negative"} />
                      <Metric label="Max drawdown" value={formatPercent(Number(session.metrics.max_drawdown ?? 0))} tone="negative" />
                      <Metric label="Win rate" value={formatPercent(Number(session.metrics.win_rate ?? 0))} />
                      <Metric label="Closed trades" value={String(session.metrics.number_of_trades ?? replay.trades.filter((trade) => trade.side === "sell").length)} />
                    </div>
                    <Button render={<Link href="/trade/strategies/sessions" />} nativeButton={false} variant="outline" className="h-10 w-full rounded-xl text-sm">
                      Start another session
                    </Button>
                  </CardContent>
                </Card>
              )}

              <div className="flex flex-col gap-6">
                <Card className="rounded-2xl border border-[var(--theme-border)] bg-[var(--surface-card)] py-0 text-[var(--text-primary)] shadow-[var(--shadow-card)]">
                  <CardContent className="p-5">
                    <div className="mb-3 text-sm font-semibold">Session equity</div>
                    <div className="h-36">
                      <ResponsiveContainer width="100%" height="100%">
                        <ReLineChart data={sparkData}>
                          <XAxis dataKey="date" hide />
                          <YAxis hide domain={["auto", "auto"]} />
                          <Tooltip contentStyle={{ background: "var(--surface-popover)", border: "1px solid var(--theme-border)", borderRadius: 12 }} />
                          <Line type="monotone" dataKey="value" stroke="rgb(99,102,241)" strokeWidth={2} dot={false} />
                        </ReLineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border border-[var(--theme-border)] bg-[var(--surface-card)] py-0 text-[var(--text-primary)] shadow-[var(--shadow-card)]">
                  <CardContent className="p-5">
                    <div className="mb-3 text-sm font-semibold">Trade log ({replay.trades.length})</div>
                    <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                      {replay.trades.length === 0 && <div className="text-sm text-[var(--text-muted)]">No trades yet. Use the order ticket to buy and sell.</div>}
                      {[...replay.trades].reverse().map((trade, index) => (
                        <div key={`${trade.date}-${trade.side}-${index}`} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-xl border border-[var(--theme-border)] bg-[var(--surface-card-hover)] px-3 py-2 text-sm">
                          <div>
                            <span className={cn("text-xs font-semibold", trade.side === "buy" ? "text-green-positive" : "text-red-negative")}>
                              {trade.side.toUpperCase()} {trade.quantity.toFixed(3)}
                            </span>
                            <span className="ml-2 text-xs text-[var(--text-muted)]">{trade.date}</span>
                          </div>
                          <div className="text-right text-[var(--text-secondary)]">{formatCurrency(trade.price)}</div>
                          <div className={cn("w-20 text-right text-xs font-semibold", trade.pnl === null || trade.pnl === undefined ? "text-[var(--text-muted)]" : trade.pnl >= 0 ? "text-green-positive" : "text-red-negative")}>
                            {trade.pnl === null || trade.pnl === undefined ? "—" : formatCurrency(trade.pnl)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
