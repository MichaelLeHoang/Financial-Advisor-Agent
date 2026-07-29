"use client";

import { useState } from "react";
import { Signal } from "lucide-react";
import { api, isUpgradeRequiredError } from "@/lib/api";
import type { SignalRankingResult } from "@/lib/api";
import { useAuth } from "@/components/auth/AuthProvider";
import { LockedFeature } from "@/components/LockedFeature";
import UpgradePrompt from "@/components/common/UpgradePrompt";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { cn } from "@/lib/utils";

const PLAN_RANK: Record<string, number> = { free: 0, pro: 1, trader: 2, quant: 3, execution_addon: 4 };

export default function SignalsPage() {
  const { user } = useAuth();
  const [symbols, setSymbols] = useState("AAPL,MSFT,NVDA,GOOGL");
  const [startDate, setStartDate] = useState("2024-01-01");
  const [endDate, setEndDate] = useState("2024-12-31");
  const [result, setResult] = useState<SignalRankingResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upgradeMessage, setUpgradeMessage] = useState<string | null>(null);
  const canUseQuant = PLAN_RANK[user.plan] >= PLAN_RANK.quant;

  if (!canUseQuant) {
    return (
      <LockedFeature
        title="Signal Ranking is available on Quant"
        description="Rank symbols with a transparent momentum and volatility score before deeper research."
        requiredPlan="quant"
        benefits={["Momentum ranking", "Volatility penalty", "Neutral signal language"]}
      />
    );
  }

  const run = async () => {
    setLoading(true);
    setError(null);
    setUpgradeMessage(null);
    try {
      setResult(await api.rankSignals({
        symbols: symbols.split(",").map((item) => item.trim().toUpperCase()).filter(Boolean),
        start_date: startDate,
        end_date: endDate,
      }));
    } catch (err) {
      if (isUpgradeRequiredError(err)) setUpgradeMessage(err.detail.message);
      else setError(err instanceof Error ? err.message : "Unable to rank signals.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-7">
        <div>
          <div className="flex items-center gap-3"><Signal className="h-6 w-6 text-indigo-primary" /><h1 className="text-4xl font-bold text-[var(--text-primary)]">Signal Ranking</h1></div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">Transparent research scores using trend momentum and realized volatility.</p>
        </div>
        {upgradeMessage && <UpgradePrompt message={upgradeMessage} />}
        {error && <div className="rounded-xl border border-red-negative/25 bg-red-negative/10 px-4 py-3 text-sm text-red-negative">{error}</div>}
        <Card className="rounded-2xl border border-[var(--theme-border)] bg-[var(--surface-card)] py-0 text-[var(--text-primary)] shadow-[var(--shadow-card)]">
          <CardContent className="grid gap-4 p-5 md:grid-cols-[1fr_180px_180px_160px]">
            <Input value={symbols} onChange={(event) => setSymbols(event.target.value)} className="h-11 rounded-xl" />
            <DatePicker aria-label="Start date" value={startDate} onValueChange={setStartDate} />
            <DatePicker aria-label="End date" value={endDate} onValueChange={setEndDate} min={startDate} />
            <Button onClick={run} disabled={loading} className="theme-accent-surface on-accent h-11 rounded-xl">{loading ? "Ranking..." : "Rank"}</Button>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border border-[var(--theme-border)] bg-[var(--surface-card)] py-0 text-[var(--text-primary)] shadow-[var(--shadow-card)]">
          <CardContent className="space-y-3 p-5">
            {result?.rankings.length ? result.rankings.map((rank, index) => (
              <div key={rank.symbol} className="grid gap-3 rounded-xl border border-[var(--theme-border)] bg-[var(--surface-card-hover)] p-4 text-sm md:grid-cols-[44px_1fr_120px_120px_120px] md:items-center">
                <div className="text-lg font-semibold text-[var(--text-muted)]">#{index + 1}</div>
                <div><div className="font-semibold">{rank.symbol}</div><div className="text-xs capitalize text-[var(--text-muted)]">{rank.trend_label}</div></div>
                <Value label="Score" value={rank.score.toFixed(3)} />
                <Value label="60D mom." value={formatPercent(rank.momentum_60d)} />
                <Value label="Volatility" value={formatPercent(rank.volatility_20d)} />
              </div>
            )) : <div className="p-4 text-sm text-[var(--text-muted)]">Run ranking to compare symbols.</div>}
          </CardContent>
        </Card>
        {result && <p className="text-xs leading-5 text-[var(--text-muted)]">{result.disclaimer}</p>}
      </div>
    </div>
  );
}

function Value({ label, value }: { label: string; value: string }) {
  return <div><div className="text-xs text-[var(--text-muted)]">{label}</div><div className={cn("mt-1 font-semibold")}>{value}</div></div>;
}
function formatPercent(value: number) { return `${(value * 100).toFixed(1)}%`; }
