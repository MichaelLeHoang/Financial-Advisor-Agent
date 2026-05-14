"use client";

import { useState } from "react";
import { Code2 } from "lucide-react";
import { api, isUpgradeRequiredError } from "@/lib/api";
import type { StrategyExportRequest, StrategyExportResult } from "@/lib/api";
import { useAuth } from "@/components/auth/AuthProvider";
import { LockedFeature } from "@/components/LockedFeature";
import UpgradePrompt from "@/components/common/UpgradePrompt";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const PLAN_RANK: Record<string, number> = { free: 0, pro: 1, trader: 2, quant: 3, execution_addon: 4 };

export default function ExportPage() {
  const { user } = useAuth();
  const [language, setLanguage] = useState<StrategyExportRequest["language"]>("json");
  const [strategyName, setStrategyName] = useState("MA crossover research");
  const [result, setResult] = useState<StrategyExportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upgradeMessage, setUpgradeMessage] = useState<string | null>(null);
  const canUseQuant = PLAN_RANK[user.plan] >= PLAN_RANK.quant;

  if (!canUseQuant) {
    return (
      <LockedFeature
        title="Export Center is available on Quant"
        description="Generate research configs and strategy skeletons without enabling live execution."
        requiredPlan="quant"
        benefits={["JSON strategy config", "Python skeleton", "TradingView Pine draft"]}
      />
    );
  }

  const run = async () => {
    setLoading(true);
    setError(null);
    setUpgradeMessage(null);
    try {
      setResult(await api.exportStrategy({
        strategy_name: strategyName,
        strategy_type: "moving_average_crossover",
        symbols: ["AAPL", "MSFT"],
        parameters: { short_window: 20, long_window: 50 },
        language,
      }));
    } catch (err) {
      if (isUpgradeRequiredError(err)) setUpgradeMessage(err.detail.message);
      else setError(err instanceof Error ? err.message : "Unable to export strategy.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-7">
        <div>
          <div className="flex items-center gap-3"><Code2 className="h-6 w-6 text-indigo-primary" /><h1 className="text-4xl font-bold text-[var(--text-primary)]">Export Center</h1></div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">Export research artifacts. Live trading remains disabled.</p>
        </div>
        {upgradeMessage && <UpgradePrompt message={upgradeMessage} />}
        {error && <div className="rounded-xl border border-red-negative/25 bg-red-negative/10 px-4 py-3 text-sm text-red-negative">{error}</div>}

        <Card className="rounded-2xl border border-[var(--theme-border)] bg-[var(--surface-card)] py-0 text-[var(--text-primary)] shadow-[var(--shadow-card)]">
          <CardContent className="grid gap-4 p-5 md:grid-cols-[1fr_180px_160px]">
            <Input value={strategyName} onChange={(event) => setStrategyName(event.target.value)} className="h-11 rounded-xl" />
            <select value={language} onChange={(event) => setLanguage(event.target.value as StrategyExportRequest["language"])} className="h-11 rounded-xl border border-[var(--theme-border)] bg-[var(--surface-control)] px-3 text-sm text-[var(--text-primary)] outline-none">
              <option value="json">JSON</option>
              <option value="python">Python</option>
              <option value="pine">Pine Script</option>
            </select>
            <Button onClick={run} disabled={loading} className="accent-gradient-surface on-accent h-11 rounded-xl">{loading ? "Exporting..." : "Generate"}</Button>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-[var(--theme-border)] bg-[var(--surface-card)] py-0 text-[var(--text-primary)] shadow-[var(--shadow-card)]">
          <CardContent className="p-5">
            {result ? (
              <>
                <div className="mb-3 flex items-center justify-between text-sm">
                  <span className="font-semibold uppercase">{result.language}</span>
                  <span className="text-[var(--text-muted)]">Mode: {result.routed_mode}</span>
                </div>
                <pre className="max-h-[520px] overflow-auto rounded-xl border border-[var(--theme-border)] bg-[var(--surface-control)] p-4 text-xs leading-5 text-[var(--text-secondary)]"><code>{result.content}</code></pre>
                <p className="mt-4 text-xs leading-5 text-[var(--text-muted)]">{result.disclaimer}</p>
              </>
            ) : (
              <div className="p-4 text-sm text-[var(--text-muted)]">Generate an export to preview the artifact.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
