"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Line,
  LineChart as ReLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, ArrowUpRight, FlaskConical, History, Save, TrendingUp } from "lucide-react";
import { api, isUpgradeRequiredError } from "@/lib/api";
import type { BacktestResult, BacktestRun, Strategy, StrategyOption } from "@/lib/api";
import { useAuth } from "@/components/auth/AuthProvider";
import { LockedFeature } from "@/components/LockedFeature";
import TickerSuggestionInput from "@/components/market/TickerSuggestionInput";
import UpgradePrompt from "@/components/common/UpgradePrompt";
import { Field, Metric, PLAN_RANK, formatCurrency, formatPercent, formatStrategyType } from "@/components/backtest/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const STRATEGIES: StrategyOption[] = [
  {
    type: "buy_and_hold",
    name: "Buy and hold",
    description: "Benchmark that buys selected assets and holds through the period.",
    default_parameters: {},
  },
  {
    type: "moving_average_crossover",
    name: "MA crossover",
    description: "Long-only entries when short moving average is above long moving average.",
    default_parameters: { short_window: 20, long_window: 50 },
  },
  {
    type: "rsi_mean_reversion",
    name: "RSI mean reversion",
    description: "Long-only entries on oversold RSI and exits on recovery.",
    default_parameters: { rsi_window: 14, buy_threshold: 30, sell_threshold: 55 },
  },
];

export default function BacktestPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const rerunId = searchParams.get("rerun");
  const [strategy, setStrategy] = useState<StrategyOption["type"]>("moving_average_crossover");
  const [strategyName, setStrategyName] = useState("MA crossover test");
  const [symbols, setSymbols] = useState(["AAPL", "MSFT"]);
  const [symbolInput, setSymbolInput] = useState("");
  const [startDate, setStartDate] = useState("2024-01-01");
  const [endDate, setEndDate] = useState("2024-12-31");
  const [initialCapital, setInitialCapital] = useState(10000);
  const [feesBps, setFeesBps] = useState(5);
  const [slippageBps, setSlippageBps] = useState(5);
  const [positionSize, setPositionSize] = useState(1);
  const [saveStrategy, setSaveStrategy] = useState(true);
  const [parameters, setParameters] = useState<Record<string, number>>({ short_window: 20, long_window: 50 });
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [recentRuns, setRecentRuns] = useState<BacktestRun[]>([]);
  const [savedStrategies, setSavedStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upgradeMessage, setUpgradeMessage] = useState<string | null>(null);

  const canUseBacktesting = PLAN_RANK[user.plan] >= PLAN_RANK.trader;
  const activeStrategy = STRATEGIES.find((item) => item.type === strategy) ?? STRATEGIES[1];
  const chartData = useMemo(
    () => result?.equity_curve.map((point) => ({ date: point.date.slice(5), value: point.value })) ?? [],
    [result]
  );
  const positionProgress = `${positionSize * 100}%`;

  useEffect(() => {
    if (!canUseBacktesting) return;
    void refreshHistory();
  }, [canUseBacktesting]);

  useEffect(() => {
    if (!canUseBacktesting || !rerunId) return;
    let cancelled = false;
    void api
      .backtestRun(rerunId)
      .then((run) => {
        if (cancelled) return;
        setStrategy(run.strategy_type as StrategyOption["type"]);
        setStrategyName(run.strategy_name);
        setSymbols(run.symbols);
        setParameters(run.parameters as Record<string, number>);
        const assumptions = run.assumptions as Record<string, unknown>;
        if (typeof assumptions.start_date === "string") setStartDate(assumptions.start_date);
        if (typeof assumptions.end_date === "string") setEndDate(assumptions.end_date);
        if (typeof assumptions.initial_capital === "number") setInitialCapital(assumptions.initial_capital);
        if (typeof assumptions.fees_bps === "number") setFeesBps(assumptions.fees_bps);
        if (typeof assumptions.slippage_bps === "number") setSlippageBps(assumptions.slippage_bps);
        if (typeof assumptions.position_size === "number") setPositionSize(assumptions.position_size);
      })
      .catch(() => {
        /* stale rerun links should not break the lab */
      });
    return () => {
      cancelled = true;
    };
  }, [canUseBacktesting, rerunId]);

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

  const addSymbol = (value = symbolInput) => {
    const normalized = value.trim().toUpperCase();
    if (normalized && !symbols.includes(normalized)) setSymbols((current) => [...current, normalized]);
    setSymbolInput("");
  };

  const selectStrategy = (next: StrategyOption) => {
    setStrategy(next.type);
    setStrategyName(next.name);
    setParameters(next.default_parameters as Record<string, number>);
    setResult(null);
    setError(null);
  };

  const run = async () => {
    if (symbols.length === 0) {
      setError("Add at least one symbol.");
      return;
    }
    setLoading(true);
    setError(null);
    setUpgradeMessage(null);
    try {
      const response = await api.runBacktest({
        strategy_name: strategyName,
        strategy_type: strategy,
        symbols,
        start_date: startDate,
        end_date: endDate,
        initial_capital: initialCapital,
        fees_bps: feesBps,
        slippage_bps: slippageBps,
        position_size: positionSize,
        parameters,
        save_strategy: saveStrategy,
      });
      setResult(response);
      await refreshHistory();
    } catch (err) {
      if (isUpgradeRequiredError(err)) setUpgradeMessage(err.detail.message);
      else setError(err instanceof Error ? err.message : "Unable to run backtest.");
    } finally {
      setLoading(false);
    }
  };

  const refreshHistory = async () => {
    try {
      const [runs, strategies] = await Promise.all([api.backtestRuns(), api.backtestStrategies()]);
      setRecentRuns(runs);
      setSavedStrategies(strategies);
    } catch {
      setRecentRuns([]);
      setSavedStrategies([]);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-4xl font-bold text-[var(--text-primary)]">Backtest Lab</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
              Historical simulations for strategy research. Results are not financial advice and do not guarantee future performance.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button render={<Link href="/backtest/sessions" />} nativeButton={false} variant="outline" className="h-10 rounded-xl text-sm">
              <History className="mr-2 h-4 w-4" />
              Sessions & history
            </Button>
            <div className="inline-flex w-fit items-center gap-2 rounded-xl border border-[var(--theme-border)] bg-[var(--surface-card)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)]">
              <FlaskConical className="h-4 w-4 text-indigo-primary" />
              Trader workflow
            </div>
          </div>
        </div>

        {upgradeMessage && <UpgradePrompt message={upgradeMessage} />}

        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <Card className="rounded-2xl border border-[var(--theme-border)] bg-[var(--surface-card)] py-0 text-[var(--text-primary)] shadow-[var(--shadow-card)]">
            <CardContent className="space-y-6 p-6">
              <div>
                <div className="text-sm font-semibold text-[var(--text-primary)]">Strategy</div>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  {STRATEGIES.map((item) => (
                    <button
                      key={item.type}
                      type="button"
                      onClick={() => selectStrategy(item)}
                      className={cn(
                        "rounded-xl border p-4 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50",
                        strategy === item.type
                          ? "border-indigo-primary/35 bg-indigo-primary/12 text-[var(--text-primary)]"
                          : "border-[var(--theme-border)] bg-[var(--surface-card-hover)] text-[var(--text-secondary)] hover:bg-[var(--surface-control-hover)]"
                      )}
                    >
                      <div className="text-sm font-semibold">{item.name}</div>
                      <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">{item.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Run name">
                  <Input value={strategyName} onChange={(event) => setStrategyName(event.target.value)} className="h-11 rounded-xl" />
                </Field>
                <Field label="Initial capital">
                  <Input type="number" value={initialCapital} min={100} onChange={(event) => setInitialCapital(Number(event.target.value))} className="h-11 rounded-xl" />
                </Field>
                <Field label="Start date">
                  <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="h-11 rounded-xl" />
                </Field>
                <Field label="End date">
                  <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="h-11 rounded-xl" />
                </Field>
              </div>

              <Field label="Symbols">
                <div className="flex flex-wrap gap-2 rounded-xl border border-[var(--theme-border)] bg-[var(--surface-control)] p-3">
                  {symbols.map((symbol) => (
                    <span key={symbol} className="inline-flex h-8 items-center gap-2 rounded-lg bg-indigo-primary/14 px-3 text-xs font-semibold text-indigo-primary">
                      {symbol}
                      <button type="button" onClick={() => setSymbols((current) => current.filter((item) => item !== symbol))} aria-label={`Remove ${symbol}`} className="text-indigo-primary/70 hover:text-indigo-primary">
                        x
                      </button>
                    </span>
                  ))}
                  <TickerSuggestionInput
                    value={symbolInput}
                    onValueChange={setSymbolInput}
                    onSelect={addSymbol}
                    existingTickers={symbols}
                    placeholder="Add symbol..."
                    className="min-w-48 flex-1"
                    inputClassName="border-transparent bg-transparent shadow-none focus-visible:ring-0"
                  />
                </div>
              </Field>

              <div className="grid gap-4 md:grid-cols-3">
                {strategy === "moving_average_crossover" && (
                  <>
                    <NumberParam label="Short MA" value={Number(parameters.short_window ?? 20)} onChange={(value) => setParameters((current) => ({ ...current, short_window: value }))} />
                    <NumberParam label="Long MA" value={Number(parameters.long_window ?? 50)} onChange={(value) => setParameters((current) => ({ ...current, long_window: value }))} />
                  </>
                )}
                {strategy === "rsi_mean_reversion" && (
                  <>
                    <NumberParam label="RSI window" value={Number(parameters.rsi_window ?? 14)} onChange={(value) => setParameters((current) => ({ ...current, rsi_window: value }))} />
                    <NumberParam label="Buy below" value={Number(parameters.buy_threshold ?? 30)} onChange={(value) => setParameters((current) => ({ ...current, buy_threshold: value }))} />
                    <NumberParam label="Sell above" value={Number(parameters.sell_threshold ?? 55)} onChange={(value) => setParameters((current) => ({ ...current, sell_threshold: value }))} />
                  </>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <NumberParam label="Fees (bps)" value={feesBps} onChange={setFeesBps} />
                <NumberParam label="Slippage (bps)" value={slippageBps} onChange={setSlippageBps} />
                <Field label={`Position size ${Math.round(positionSize * 100)}%`}>
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.05"
                    value={positionSize}
                    onChange={(event) => setPositionSize(Number(event.target.value))}
                    style={{ "--position-progress": positionProgress } as CSSProperties}
                    className="portfolio-range h-2 w-full cursor-pointer appearance-none rounded-lg"
                  />
                </Field>
              </div>

              <label className="flex items-center gap-3 text-sm text-[var(--text-secondary)]">
                <input type="checkbox" checked={saveStrategy} onChange={(event) => setSaveStrategy(event.target.checked)} className="h-4 w-4 accent-indigo-primary" />
                Save strategy parameters with this run
              </label>

              {error && <div className="text-sm text-red-negative">{error}</div>}

              <Button onClick={run} disabled={loading} className="accent-gradient-surface on-accent h-12 w-full rounded-xl text-sm font-semibold">
                {loading ? "Running simulation..." : "Run backtest"}
              </Button>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-6">
            <Card className="rounded-2xl border border-[var(--theme-border)] bg-[var(--surface-card)] py-0 text-[var(--text-primary)] shadow-[var(--shadow-card)]">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <AlertTriangle className="h-4 w-4 text-amber-warning" />
                  Simulation assumptions
                </div>
                <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
                  yfinance data is for development. The simulation uses daily close prices, long-only signals, configured fees, slippage, and final close-out to measure historical performance.
                </p>
              </CardContent>
            </Card>

            {(savedStrategies.length > 0 || recentRuns.length > 0) && (
              <Card className="rounded-2xl border border-[var(--theme-border)] bg-[var(--surface-card)] py-0 text-[var(--text-primary)] shadow-[var(--shadow-card)]">
                <CardContent className="space-y-5 p-5">
                  {savedStrategies.length > 0 && (
                    <div>
                      <div className="text-sm font-semibold">Saved strategies</div>
                      <div className="mt-3 space-y-2">
                        {savedStrategies.slice(0, 3).map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setStrategy(item.strategy_type);
                              setStrategyName(item.name);
                              setParameters(item.parameters as Record<string, number>);
                            }}
                            className="flex w-full items-center justify-between rounded-xl border border-[var(--theme-border)] bg-[var(--surface-card-hover)] px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--surface-control-hover)]"
                          >
                            <span className="font-medium">{item.name}</span>
                            <span className="text-xs text-[var(--text-muted)]">{formatStrategyType(item.strategy_type)}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {recentRuns.length > 0 && (
                    <div>
                      <div className="text-sm font-semibold">Recent runs</div>
                      <div className="mt-3 space-y-2">
                        {recentRuns.slice(0, 3).map((run) => (
                          <Link
                            key={run.id}
                            href={`/backtest/runs/${run.id}`}
                            className="block rounded-xl border border-[var(--theme-border)] bg-[var(--surface-card-hover)] px-3 py-2 text-sm transition-colors hover:bg-[var(--surface-control-hover)]"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="truncate font-medium">{run.strategy_name}</span>
                              <span className={cn("shrink-0 text-xs font-semibold", run.metrics.total_return >= 0 ? "text-green-positive" : "text-red-negative")}>
                                {formatPercent(run.metrics.total_return)}
                              </span>
                            </div>
                            <div className="mt-1 text-xs text-[var(--text-muted)]">{run.symbols.join(", ")}</div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {result ? (
              <>
                <Link
                  href={`/backtest/runs/${result.run.id}`}
                  className="inline-flex items-center gap-2 rounded-xl border border-indigo-primary/30 bg-indigo-primary/10 px-4 py-3 text-sm font-semibold text-indigo-primary transition-colors hover:bg-indigo-primary/15"
                >
                  View full results with price chart
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
                <div className="grid grid-cols-2 gap-3">
                  <Metric label="Total return" value={formatPercent(result.metrics.total_return)} tone="positive" />
                  <Metric label="Max drawdown" value={formatPercent(result.metrics.max_drawdown)} tone="negative" />
                  <Metric label="Sharpe" value={result.metrics.sharpe_ratio.toFixed(2)} />
                  <Metric label="Win rate" value={formatPercent(result.metrics.win_rate)} />
                  <Metric label="Trades" value={String(result.metrics.number_of_trades)} />
                  <Metric label="Fees paid" value={formatCurrency(result.metrics.fees_paid)} />
                </div>

                <Card className="rounded-2xl border border-[var(--theme-border)] bg-[var(--surface-card)] py-0 text-[var(--text-primary)] shadow-[var(--shadow-card)]">
                  <CardContent className="p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <div className="text-sm font-semibold">Equity curve</div>
                      <TrendingUp className="h-4 w-4 text-indigo-primary" />
                    </div>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <ReLineChart data={chartData}>
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
                    <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
                      <Save className="h-4 w-4 text-indigo-primary" />
                      Recent trades
                    </div>
                    <div className="space-y-2">
                      {result.trades.slice(-6).map((trade, index) => (
                        <div key={`${trade.symbol}-${trade.executed_at}-${index}`} className="grid grid-cols-[1fr_auto] gap-3 rounded-xl border border-[var(--theme-border)] bg-[var(--surface-card-hover)] px-3 py-2 text-sm">
                          <div>
                            <span className="font-semibold">{trade.symbol}</span>
                            <span className="ml-2 text-[var(--text-muted)]">{trade.side.toUpperCase()} {trade.quantity.toFixed(3)}</span>
                          </div>
                          <div className="text-right text-[var(--text-secondary)]">{formatCurrency(trade.price)}</div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <p className="text-xs leading-5 text-[var(--text-muted)]">{result.disclaimer}</p>
              </>
            ) : (
              <Card className="rounded-2xl border border-[var(--theme-border)] bg-[var(--surface-card)] py-0 text-[var(--text-primary)] shadow-[var(--shadow-card)]">
                <CardContent className="p-6 text-sm leading-6 text-[var(--text-muted)]">
                  Configure assumptions and run a simulation to see metrics, equity curve, and trade history.
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function NumberParam({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <Field label={label}>
      <Input type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} className="h-11 rounded-xl" />
    </Field>
  );
}
