"use client";

import { useMemo, useState } from "react";
import { LineChart, Plus } from "lucide-react";
import { api, isUpgradeRequiredError } from "@/lib/api";
import type { QuantStrategyConfig, StrategyComparisonResult } from "@/lib/api";
import { useAuth } from "@/components/auth/AuthProvider";
import { LockedFeature } from "@/components/LockedFeature";
import UpgradePrompt from "@/components/common/UpgradePrompt";
import TickerSuggestionInput from "@/components/market/TickerSuggestionInput";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const PLAN_RANK: Record<string, number> = { free: 0, pro: 1, trader: 2, quant: 3, execution_addon: 4 };

const DEFAULT_STRATEGIES: QuantStrategyConfig[] = [
  { name: "Buy and hold", strategy_type: "buy_and_hold", parameters: {} },
  { name: "MA crossover", strategy_type: "moving_average_crossover", parameters: { short_window: 20, long_window: 50 } },
  { name: "RSI mean reversion", strategy_type: "rsi_mean_reversion", parameters: { rsi_window: 14, buy_threshold: 30, sell_threshold: 55 } },
];

export default function StrategyComparePage() {
  const { user } = useAuth();
  const [symbols, setSymbols] = useState(["AAPL", "MSFT"]);
  const [symbolInput, setSymbolInput] = useState("");
  const [startDate, setStartDate] = useState("2024-01-01");
  const [endDate, setEndDate] = useState("2024-12-31");
  const [result, setResult] = useState<StrategyComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upgradeMessage, setUpgradeMessage] = useState<string | null>(null);
  const canUseQuant = PLAN_RANK[user.plan] >= PLAN_RANK.quant;

  const orderedRows = useMemo(
    () => [...(result?.results ?? [])].sort((a, b) => b.metrics.sharpe_ratio - a.metrics.sharpe_ratio),
    [result]
  );

  if (!canUseQuant) {
    return (
      <LockedFeature
        title="Strategy Compare is available on Quant"
        description="Compare multiple strategy families across the same assumptions before choosing what to validate further."
        requiredPlan="quant"
        benefits={["Multi-strategy metrics", "Shared assumptions", "Research-only ranking"]}
      />
    );
  }

  const addSymbol = (value = symbolInput) => {
    const normalized = value.trim().toUpperCase();
    if (normalized && !symbols.includes(normalized)) setSymbols((current) => [...current, normalized]);
    setSymbolInput("");
  };

  const run = async () => {
    setLoading(true);
    setError(null);
    setUpgradeMessage(null);
    try {
      setResult(await api.compareStrategies({
        symbols,
        start_date: startDate,
        end_date: endDate,
        initial_capital: 10000,
        fees_bps: 5,
        slippage_bps: 5,
        position_size: 1,
        strategies: DEFAULT_STRATEGIES,
      }));
    } catch (err) {
      if (isUpgradeRequiredError(err)) setUpgradeMessage(err.detail.message);
      else setError(err instanceof Error ? err.message : "Unable to compare strategies.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-7">
        <Header icon={LineChart} title="Strategy Compare" subtitle="Run strategy families against the same symbols, dates, fees, and slippage." />
        {upgradeMessage && <UpgradePrompt message={upgradeMessage} />}
        {error && <ErrorBanner message={error} />}

        <Card className="rounded-2xl border border-[var(--theme-border)] bg-[var(--surface-card)] py-0 text-[var(--text-primary)] shadow-[var(--shadow-card)]">
          <CardContent className="grid gap-5 p-5 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 rounded-xl border border-[var(--theme-border)] bg-[var(--surface-control)] p-3">
                {symbols.map((symbol) => (
                  <button key={symbol} type="button" onClick={() => setSymbols((current) => current.filter((item) => item !== symbol))} className="rounded-lg bg-indigo-primary/14 px-3 py-1 text-xs font-semibold text-indigo-primary">
                    {symbol}
                  </button>
                ))}
                <TickerSuggestionInput value={symbolInput} onValueChange={setSymbolInput} onSelect={addSymbol} existingTickers={symbols} placeholder="Add symbol..." className="min-w-40 flex-1" inputClassName="border-transparent bg-transparent shadow-none focus-visible:ring-0" />
                <Button type="button" size="icon" onClick={() => addSymbol()} className="theme-solid-action h-9 w-9 rounded-lg"><Plus className="h-4 w-4" /></Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="h-11 rounded-xl border border-[var(--theme-border)] bg-[var(--surface-control)] px-3 text-sm text-[var(--text-primary)] outline-none" />
                <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="h-11 rounded-xl border border-[var(--theme-border)] bg-[var(--surface-control)] px-3 text-sm text-[var(--text-primary)] outline-none" />
              </div>
            </div>
            <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--surface-card-hover)] p-4 text-sm leading-6 text-[var(--text-secondary)]">
              Comparing buy and hold, moving average crossover, and RSI mean reversion with identical assumptions.
              <Button onClick={run} disabled={loading || symbols.length === 0} className="theme-accent-surface on-accent mt-4 h-11 w-full rounded-xl">
                {loading ? "Comparing..." : "Compare strategies"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-3">
          {orderedRows.length > 0 ? orderedRows.map((row) => (
            <Card key={row.name} className={cn("rounded-2xl border py-0 text-[var(--text-primary)] shadow-[var(--shadow-card)]", row.name === result?.best_strategy ? "border-indigo-primary/35 bg-indigo-primary/10" : "border-[var(--theme-border)] bg-[var(--surface-card)]")}>
              <CardContent className="p-5">
                <div className="text-sm font-semibold">{row.name}</div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <Metric label="Sharpe" value={row.metrics.sharpe_ratio.toFixed(2)} />
                  <Metric label="Return" value={formatPercent(row.metrics.total_return)} />
                  <Metric label="Drawdown" value={formatPercent(row.metrics.max_drawdown)} />
                  <Metric label="Trades" value={String(row.metrics.number_of_trades)} />
                </div>
              </CardContent>
            </Card>
          )) : (
            <Empty text="Run a comparison to rank strategies by Sharpe ratio." />
          )}
        </div>
        {result && <p className="text-xs leading-5 text-[var(--text-muted)]">{result.disclaimer}</p>}
      </div>
    </div>
  );
}

function Header({ icon: Icon, title, subtitle }: { icon: typeof LineChart; title: string; subtitle: string }) {
  return <div><div className="flex items-center gap-3"><Icon className="h-6 w-6 text-indigo-primary" /><h1 className="text-4xl font-bold text-[var(--text-primary)]">{title}</h1></div><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">{subtitle}</p></div>;
}
function Metric({ label, value }: { label: string; value: string }) { return <div><div className="text-xs text-[var(--text-muted)]">{label}</div><div className="mt-1 font-semibold">{value}</div></div>; }
function ErrorBanner({ message }: { message: string }) { return <div className="rounded-xl border border-red-negative/25 bg-red-negative/10 px-4 py-3 text-sm text-red-negative">{message}</div>; }
function Empty({ text }: { text: string }) { return <Card className="col-span-full rounded-2xl border border-[var(--theme-border)] bg-[var(--surface-card)] py-0 text-[var(--text-primary)]"><CardContent className="p-6 text-sm text-[var(--text-muted)]">{text}</CardContent></Card>; }
function formatPercent(value: number) { return `${(value * 100).toFixed(1)}%`; }
