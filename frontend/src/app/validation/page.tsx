"use client";

import { useState } from "react";
import { BarChart3 } from "lucide-react";
import { api, isUpgradeRequiredError } from "@/lib/api";
import type { AdvancedValidationResult } from "@/lib/api";
import { useAuth } from "@/components/auth/AuthProvider";
import { LockedFeature } from "@/components/LockedFeature";
import UpgradePrompt from "@/components/common/UpgradePrompt";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";

const PLAN_RANK: Record<string, number> = { free: 0, pro: 1, trader: 2, quant: 3, execution_addon: 4 };

export default function ValidationPage() {
  const { user } = useAuth();
  const [symbols, setSymbols] = useState("AAPL,MSFT");
  const [startDate, setStartDate] = useState("2024-01-01");
  const [endDate, setEndDate] = useState("2024-12-31");
  const [result, setResult] = useState<AdvancedValidationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upgradeMessage, setUpgradeMessage] = useState<string | null>(null);
  const canUseQuant = PLAN_RANK[user.plan] >= PLAN_RANK.quant;

  if (!canUseQuant) {
    return (
      <LockedFeature
        title="Advanced Validation is available on Quant"
        description="Stress test a strategy with walk-forward windows, Monte Carlo paths, and bootstrap confidence intervals."
        requiredPlan="quant"
        benefits={["Walk-forward validation", "Monte Carlo distribution", "Bootstrap confidence intervals"]}
      />
    );
  }

  const run = async () => {
    setLoading(true);
    setError(null);
    setUpgradeMessage(null);
    try {
      setResult(await api.validateStrategyAdvanced({
        strategy_name: "MA validation",
        strategy_type: "moving_average_crossover",
        symbols: symbols.split(",").map((item) => item.trim().toUpperCase()).filter(Boolean),
        start_date: startDate,
        end_date: endDate,
        initial_capital: 10000,
        fees_bps: 5,
        slippage_bps: 5,
        position_size: 1,
        parameters: { short_window: 20, long_window: 50 },
        walk_forward_windows: 4,
        monte_carlo_paths: 250,
        bootstrap_samples: 500,
      }));
    } catch (err) {
      if (isUpgradeRequiredError(err)) setUpgradeMessage(err.detail.message);
      else setError(err instanceof Error ? err.message : "Unable to validate strategy.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-7">
        <div>
          <div className="flex items-center gap-3"><BarChart3 className="h-6 w-6 text-indigo-primary" /><h1 className="text-4xl font-bold text-[var(--text-primary)]">Advanced Validation</h1></div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">Quant-grade robustness checks for a saved research strategy.</p>
        </div>
        {upgradeMessage && <UpgradePrompt message={upgradeMessage} />}
        {error && <div className="rounded-xl border border-red-negative/25 bg-red-negative/10 px-4 py-3 text-sm text-red-negative">{error}</div>}

        <Card className="rounded-2xl border border-[var(--theme-border)] bg-[var(--surface-card)] py-0 text-[var(--text-primary)] shadow-[var(--shadow-card)]">
          <CardContent className="grid gap-4 p-5 md:grid-cols-[1fr_180px_180px_180px]">
            <Input value={symbols} onChange={(event) => setSymbols(event.target.value)} className="h-11 rounded-xl" />
            <DatePicker aria-label="Start date" value={startDate} onValueChange={setStartDate} />
            <DatePicker aria-label="End date" value={endDate} onValueChange={setEndDate} min={startDate} />
            <Button onClick={run} disabled={loading} className="theme-accent-surface on-accent h-11 rounded-xl">{loading ? "Running..." : "Validate"}</Button>
          </CardContent>
        </Card>

        {result ? (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <Metric label="Base return" value={formatPercent(result.base_metrics.total_return)} />
              <Metric label="Sharpe" value={result.base_metrics.sharpe_ratio.toFixed(2)} />
              <Metric label="Monte Carlo P50" value={formatPercent(result.monte_carlo.p50)} />
              <Metric label="Loss probability" value={formatPercent(result.monte_carlo.loss_probability)} />
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="rounded-2xl border border-[var(--theme-border)] bg-[var(--surface-card)] py-0 text-[var(--text-primary)] shadow-[var(--shadow-card)]">
                <CardContent className="space-y-3 p-5">
                  <div className="text-sm font-semibold">Walk-forward windows</div>
                  {result.walk_forward.map((row) => (
                    <div key={row.window} className="flex items-center justify-between rounded-xl border border-[var(--theme-border)] bg-[var(--surface-card-hover)] px-3 py-2 text-sm">
                      <span>Window {row.window}: {row.start} to {row.end}</span>
                      <span>{formatPercent(row.return)}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card className="rounded-2xl border border-[var(--theme-border)] bg-[var(--surface-card)] py-0 text-[var(--text-primary)] shadow-[var(--shadow-card)]">
                <CardContent className="space-y-4 p-5 text-sm">
                  <div className="font-semibold">Bootstrap interval</div>
                  <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--surface-card-hover)] p-3">
                    {formatPercent(result.bootstrap.ci_5)} to {formatPercent(result.bootstrap.ci_95)} across {result.bootstrap.samples} samples.
                  </div>
                  <div className="font-semibold">Monte Carlo range</div>
                  <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--surface-card-hover)] p-3">
                    P05 {formatPercent(result.monte_carlo.p05)}, P95 {formatPercent(result.monte_carlo.p95)} across {result.monte_carlo.paths} paths.
                  </div>
                </CardContent>
              </Card>
            </div>
            <p className="text-xs leading-5 text-[var(--text-muted)]">{result.disclaimer}</p>
          </>
        ) : (
          <Card className="rounded-2xl border border-[var(--theme-border)] bg-[var(--surface-card)] py-0 text-[var(--text-primary)]"><CardContent className="p-6 text-sm text-[var(--text-muted)]">Run validation to see walk-forward, Monte Carlo, and bootstrap results.</CardContent></Card>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <Card className="rounded-2xl border border-[var(--theme-border)] bg-[var(--surface-card)] py-0 text-[var(--text-primary)] shadow-[var(--shadow-card)]"><CardContent className="p-4"><div className="text-xs text-[var(--text-muted)]">{label}</div><div className="mt-2 text-xl font-semibold">{value}</div></CardContent></Card>;
}
function formatPercent(value: number) { return `${(value * 100).toFixed(1)}%`; }
