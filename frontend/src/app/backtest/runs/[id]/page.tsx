"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Area,
  AreaChart,
  Line,
  LineChart as ReLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowLeft, CandlestickChart as CandlestickIcon, RefreshCcw, Trash2, TrendingUp } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { BacktestRun, Candle } from "@/lib/api";
import { useAuth } from "@/components/auth/AuthProvider";
import { LockedFeature } from "@/components/LockedFeature";
import CandlestickChart from "@/components/backtest/CandlestickChart";
import { computeDrawdownSeries } from "@/components/backtest/replay";
import { Metric, PLAN_RANK, formatCurrency, formatPercent, formatStrategyType } from "@/components/backtest/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function BacktestRunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const router = useRouter();
  const [run, setRun] = useState<BacktestRun | null>(null);
  const [candles, setCandles] = useState<Record<string, Candle[]>>({});
  const [activeSymbol, setActiveSymbol] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chartError, setChartError] = useState<string | null>(null);

  const canUseBacktesting = PLAN_RANK[user.plan] >= PLAN_RANK.trader;

  useEffect(() => {
    if (!canUseBacktesting) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const fetched = await api.backtestRun(id);
        if (cancelled) return;
        setRun(fetched);
        setActiveSymbol(fetched.symbols[0] ?? "");

        const startDate = typeof fetched.assumptions.start_date === "string" ? fetched.assumptions.start_date : fetched.equity_curve[0]?.date;
        const endDate = typeof fetched.assumptions.end_date === "string" ? fetched.assumptions.end_date : fetched.equity_curve.at(-1)?.date;
        if (startDate && endDate) {
          try {
            const response = await api.backtestCandles(fetched.symbols, startDate, endDate);
            if (!cancelled) setCandles(response.candles);
          } catch (err) {
            if (!cancelled) setChartError(err instanceof Error ? err.message : "Unable to load price candles.");
          }
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) setError("This backtest run no longer exists.");
        else setError(err instanceof Error ? err.message : "Unable to load the backtest run.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [canUseBacktesting, id]);

  const equityData = useMemo(
    () => run?.equity_curve.map((point) => ({ date: point.date.slice(5), value: point.value })) ?? [],
    [run]
  );
  const drawdownData = useMemo(
    () => (run ? computeDrawdownSeries(run.equity_curve).map((point) => ({ date: point.date.slice(5), value: point.value * 100 })) : []),
    [run]
  );
  const markers = useMemo(
    () =>
      run?.trades
        .filter((trade) => trade.symbol === activeSymbol)
        .map((trade) => ({ time: trade.executed_at.slice(0, 10), side: trade.side })) ?? [],
    [run, activeSymbol]
  );

  if (!canUseBacktesting) {
    return (
      <LockedFeature
        title="Backtest Lab is available on Trader"
        description="Run historical strategy simulations, save strategy parameters, and review trades with clear assumptions."
        requiredPlan="trader"
        benefits={["Saved strategy runs", "Fees and slippage assumptions", "Trade-level simulation history"]}
      />
    );
  }

  const deleteRun = async () => {
    if (!run || !window.confirm(`Delete the run "${run.strategy_name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await api.deleteBacktestRun(run.id);
      router.push("/backtest/sessions");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete this run.");
      setDeleting(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <Link href="/backtest/sessions" className="inline-flex w-fit items-center gap-2 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]">
          <ArrowLeft className="h-4 w-4" />
          Back to sessions
        </Link>

        {loading && <Card className="rounded-2xl border border-[var(--theme-border)] bg-[var(--surface-card)] py-0"><CardContent className="p-6 text-sm text-[var(--text-muted)]">Loading run...</CardContent></Card>}
        {error && !run && <Card className="rounded-2xl border border-[var(--theme-border)] bg-[var(--surface-card)] py-0"><CardContent className="p-6 text-sm text-red-negative">{error}</CardContent></Card>}

        {run && (
          <>
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <h1 className="text-3xl font-bold text-[var(--text-primary)]">{run.strategy_name}</h1>
                <p className="mt-2 text-sm text-[var(--text-muted)]">
                  {formatStrategyType(run.strategy_type)} · {run.symbols.join(", ")} · {new Date(run.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-2">
                <Button render={<Link href={`/backtest?rerun=${run.id}`} />} variant="outline" className="h-10 rounded-xl text-sm">
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Re-run
                </Button>
                <Button variant="outline" onClick={deleteRun} disabled={deleting} className="h-10 rounded-xl text-sm text-red-negative">
                  <Trash2 className="mr-2 h-4 w-4" />
                  {deleting ? "Deleting..." : "Delete"}
                </Button>
              </div>
            </div>

            {error && <div className="text-sm text-red-negative">{error}</div>}

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Metric label="Total return" value={formatPercent(run.metrics.total_return)} tone={run.metrics.total_return >= 0 ? "positive" : "negative"} />
              <Metric label="Annualized" value={formatPercent(run.metrics.annualized_return)} />
              <Metric label="Max drawdown" value={formatPercent(run.metrics.max_drawdown)} tone="negative" />
              <Metric label="Sharpe" value={run.metrics.sharpe_ratio.toFixed(2)} />
              <Metric label="Win rate" value={formatPercent(run.metrics.win_rate)} />
              <Metric label="Profit factor" value={run.metrics.profit_factor !== null ? run.metrics.profit_factor.toFixed(2) : "—"} />
              <Metric label="Trades" value={String(run.metrics.number_of_trades)} />
              <Metric label="Fees paid" value={formatCurrency(run.metrics.fees_paid)} />
            </div>

            <Card className="rounded-2xl border border-[var(--theme-border)] bg-[var(--surface-card)] py-0 text-[var(--text-primary)] shadow-[var(--shadow-card)]">
              <CardContent className="p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <CandlestickIcon className="h-4 w-4 text-indigo-primary" />
                    Price action and trades
                  </div>
                  {run.symbols.length > 1 && (
                    <div className="flex flex-wrap gap-2">
                      {run.symbols.map((symbol) => (
                        <button
                          key={symbol}
                          type="button"
                          onClick={() => setActiveSymbol(symbol)}
                          className={cn(
                            "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                            activeSymbol === symbol
                              ? "border-indigo-primary/35 bg-indigo-primary/12 text-indigo-primary"
                              : "border-[var(--theme-border)] bg-[var(--surface-card-hover)] text-[var(--text-secondary)] hover:bg-[var(--surface-control-hover)]"
                          )}
                        >
                          {symbol}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {candles[activeSymbol]?.length ? (
                  <CandlestickChart candles={candles[activeSymbol]} markers={markers} height={380} />
                ) : (
                  <div className="flex h-48 items-center justify-center text-sm text-[var(--text-muted)]">
                    {chartError ?? "Price candles are unavailable for this run."}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="rounded-2xl border border-[var(--theme-border)] bg-[var(--surface-card)] py-0 text-[var(--text-primary)] shadow-[var(--shadow-card)]">
                <CardContent className="p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="text-sm font-semibold">Equity curve</div>
                    <TrendingUp className="h-4 w-4 text-indigo-primary" />
                  </div>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <ReLineChart data={equityData}>
                        <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: "rgba(255,255,255,0.36)", fontSize: 11 }} />
                        <YAxis tickLine={false} axisLine={false} tick={{ fill: "rgba(255,255,255,0.36)", fontSize: 11 }} width={70} />
                        <Tooltip contentStyle={{ background: "var(--surface-popover)", border: "1px solid var(--theme-border)", borderRadius: 12 }} />
                        <Line type="monotone" dataKey="value" stroke="rgb(99,102,241)" strokeWidth={2} dot={false} />
                      </ReLineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border border-[var(--theme-border)] bg-[var(--surface-card)] py-0 text-[var(--text-primary)] shadow-[var(--shadow-card)]">
                <CardContent className="p-5">
                  <div className="mb-4 text-sm font-semibold">Drawdown</div>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={drawdownData}>
                        <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: "rgba(255,255,255,0.36)", fontSize: 11 }} />
                        <YAxis tickLine={false} axisLine={false} tick={{ fill: "rgba(255,255,255,0.36)", fontSize: 11 }} width={50} tickFormatter={(value: number) => `${value.toFixed(0)}%`} />
                        <Tooltip
                          contentStyle={{ background: "var(--surface-popover)", border: "1px solid var(--theme-border)", borderRadius: 12 }}
                          formatter={(value) => [`${Number(value).toFixed(2)}%`, "Drawdown"]}
                        />
                        <Area type="monotone" dataKey="value" stroke="#f87171" fill="rgba(248,113,113,0.18)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="rounded-2xl border border-[var(--theme-border)] bg-[var(--surface-card)] py-0 text-[var(--text-primary)] shadow-[var(--shadow-card)]">
              <CardContent className="p-5">
                <div className="mb-4 text-sm font-semibold">Trades ({run.trades.length})</div>
                <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                  {run.trades.length === 0 && <div className="text-sm text-[var(--text-muted)]">No trades were executed in this run.</div>}
                  {run.trades.map((trade, index) => (
                    <div key={`${trade.symbol}-${trade.executed_at}-${index}`} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-xl border border-[var(--theme-border)] bg-[var(--surface-card-hover)] px-3 py-2 text-sm">
                      <div>
                        <span className="font-semibold">{trade.symbol}</span>
                        <span className={cn("ml-2 text-xs font-semibold", trade.side === "buy" ? "text-green-positive" : "text-red-negative")}>
                          {trade.side.toUpperCase()} {trade.quantity.toFixed(3)}
                        </span>
                        <span className="ml-2 text-xs text-[var(--text-muted)]">{trade.executed_at.slice(0, 10)}{trade.reason ? ` · ${trade.reason.replaceAll("_", " ")}` : ""}</span>
                      </div>
                      <div className="text-right text-[var(--text-secondary)]">{formatCurrency(trade.price)}</div>
                      <div className={cn("w-24 text-right text-xs font-semibold", trade.pnl === null || trade.pnl === undefined ? "text-[var(--text-muted)]" : trade.pnl >= 0 ? "text-green-positive" : "text-red-negative")}>
                        {trade.pnl === null || trade.pnl === undefined ? "—" : formatCurrency(trade.pnl)}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-[var(--theme-border)] bg-[var(--surface-card)] py-0 text-[var(--text-primary)] shadow-[var(--shadow-card)]">
              <CardContent className="p-5">
                <div className="mb-3 text-sm font-semibold">Assumptions</div>
                <div className="grid gap-2 text-sm text-[var(--text-secondary)] md:grid-cols-2">
                  {Object.entries(run.assumptions).map(([key, value]) => (
                    <div key={key} className="flex justify-between gap-4 rounded-lg bg-[var(--surface-card-hover)] px-3 py-2">
                      <span className="text-[var(--text-muted)]">{key.replaceAll("_", " ")}</span>
                      <span>{String(value)}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-xs leading-5 text-[var(--text-muted)]">
                  Backtests use historical data and simplified assumptions. Historical results do not guarantee future performance.
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
