"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Info } from "lucide-react";
import { useInvestmentWorkspace, type InvestmentPeriod } from "@/components/investment-workspace/InvestmentWorkspaceProvider";
import { cn } from "@/lib/utils";
import WorkspaceSelectMenu from "@/components/ui/workspace-select-menu";

const PERIODS: InvestmentPeriod[] = ["1D", "1W", "1M", "3M", "6M", "YTD", "1Y", "ALL"];

export default function InvestmentPerformancePage() {
  const { investmentHoldings, theses, quotes, currencyRates, portfolios, preferences, setPreference } = useInvestmentWorkspace();
  const metrics = useMemo(() => {
    const positions = investmentHoldings.map(({ holding }) => {
      const quote = quotes.get(holding.symbol.toUpperCase());
      const rate = currencyRates.get((quote?.currency || holding.cost_currency || "USD").toUpperCase()) ?? 1;
      const current = holding.quantity * (quote?.price || holding.average_cost) * rate;
      const start = holding.quantity * (quote?.history[0]?.price || holding.average_cost) * rate;
      return { symbol: holding.symbol, holdingId: holding.id, current, start, contribution: current - start };
    });
    const value = positions.reduce((sum, item) => sum + item.current, 0);
    const periodStart = positions.reduce((sum, item) => sum + item.start, 0);
    const returnAmount = value - periodStart;
    const returnPercent = periodStart ? (returnAmount / periodStart) * 100 : 0;
    const benchmark = quotes.get(preferences.benchmark.toUpperCase());
    const benchmarkStart = benchmark?.history[0]?.price ?? 0;
    const benchmarkReturn = benchmarkStart && benchmark ? ((benchmark.price - benchmarkStart) / benchmarkStart) * 100 : 0;
    return { value, periodStart, returnAmount, returnPercent, benchmarkReturn, positions: positions.sort((a, b) => b.contribution - a.contribution) };
  }, [currencyRates, investmentHoldings, preferences.benchmark, quotes]);
  const healthy = investmentHoldings.filter(({ holding }) => {
    const thesis = theses.find((item) => item.holding_id === holding.id);
    return thesis?.status === "active" && (!thesis.next_review_at || new Date(thesis.next_review_at) >= new Date());
  }).length;
  const hidden = preferences.privacyMode;

  return (
    <div className="min-h-full bg-[var(--theme-bg)] px-4 py-4 text-[var(--text-primary)] lg:px-6 xl:px-8">
      <div className="mx-auto max-w-[1380px]">
        <div className="flex items-center justify-between gap-3">
          <Link href="/invest" className="inline-flex h-10 items-center gap-2 rounded-full px-3 text-sm font-semibold hover:bg-[var(--surface-card-hover)]"><ArrowLeft className="size-4" /> Back</Link>
          <button type="button" aria-label="Toggle portfolio privacy" aria-pressed={hidden} onClick={() => setPreference("privacyMode", !hidden)} className="inline-flex h-10 items-center gap-2 rounded-full border border-[var(--theme-border-strong)] bg-[var(--surface-control)] px-4 text-sm font-semibold hover:bg-[var(--surface-card-hover)]">{hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}{hidden ? "Show values" : "Hide values"}</button>
        </div>

        <header className="mt-6">
          <WorkspaceSelectMenu
            ariaLabel="Performance portfolio scope"
            value={preferences.portfolioScope}
            options={[{ value: "all", label: "All investment portfolios" }, ...portfolios.map((portfolio) => ({ value: portfolio.id, label: portfolio.name }))]}
            onValueChange={(value) => setPreference("portfolioScope", value)}
            className="h-9 max-w-full border-transparent bg-transparent px-0 shadow-none hover:bg-transparent"
            contentClassName="min-w-64"
          />
          <h1 className="mt-2 font-heading text-3xl font-semibold">Performance insights</h1>
          <p className="mt-5 font-heading text-4xl font-semibold tabular-nums">{hidden ? "••••••" : formatMoney(metrics.value, preferences.displayCurrency)}</p>
          <p className="mt-2 text-sm text-[var(--text-muted)]">Estimated from current positions; historical contributions and realized lots are not reconstructed.</p>
          <dl className="mt-6 grid gap-4 border-b border-[var(--theme-border)] pb-6 sm:grid-cols-3">
            <TopMetric label={`${preferences.period} estimated start`} value={hidden ? "••••••" : formatMoney(metrics.periodStart, preferences.displayCurrency)} />
            <TopMetric label={`${preferences.period} estimated return`} value={hidden ? "••••••" : formatSignedMoney(metrics.returnAmount, preferences.displayCurrency)} tone={metrics.returnAmount >= 0 ? "positive" : "negative"} />
            <TopMetric label={`${preferences.benchmark} relative return`} value={hidden ? "••••" : formatSignedPercent(metrics.returnPercent - metrics.benchmarkReturn)} tone={metrics.returnPercent >= metrics.benchmarkReturn ? "positive" : "negative"} />
          </dl>
        </header>

        <section className="mt-7">
          <div className="flex flex-wrap items-center justify-between gap-4"><h2 className="font-heading text-2xl font-semibold">Overview</h2><WorkspaceSelectMenu ariaLabel="Performance period" value={preferences.period} options={PERIODS.map((period) => ({ value: period, label: period }))} onValueChange={(value) => setPreference("period", value as InvestmentPeriod)} className="min-w-28" align="end" /></div>
          <div className="mt-4 rounded-2xl border border-[var(--theme-border)] p-5">
            <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-[var(--text-muted)]">Estimated total return</p><p className={cn("mt-2 text-2xl font-semibold tabular-nums", metrics.returnAmount >= 0 ? "text-emerald-400" : "text-rose-400")}>{hidden ? "••••••" : formatSignedMoney(metrics.returnAmount, preferences.displayCurrency)}</p></div><Info className="size-4 text-[var(--text-muted)]" /></div>
            <dl className="mt-8 space-y-4"><DetailMetric label="Estimated return rate" value={hidden ? "••••" : formatSignedPercent(metrics.returnPercent)} tone={metrics.returnPercent >= 0 ? "positive" : "negative"} /><DetailMetric label={`${preferences.benchmark} return`} value={hidden ? "••••" : formatSignedPercent(metrics.benchmarkReturn)} tone={metrics.benchmarkReturn >= 0 ? "positive" : "negative"} /></dl>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-[var(--theme-border)] p-6"><h3 className="font-semibold">Position contribution</h3><div className="mt-5 space-y-4">{metrics.positions.slice(0, 5).map((item) => <div key={item.holdingId} className="flex items-center justify-between gap-4"><span>{item.symbol}</span><span className={cn("font-semibold tabular-nums", item.contribution >= 0 ? "text-emerald-400" : "text-rose-400")}>{hidden ? "••••" : formatSignedMoney(item.contribution, preferences.displayCurrency)}</span></div>)}</div><Link href="/invest/holdings" className="mt-6 inline-flex h-10 items-center gap-2 rounded-full px-3 font-semibold hover:bg-[var(--surface-card-hover)]">View all <ArrowRight className="size-4" /></Link></div>
            <div className="rounded-2xl border border-[var(--theme-border)] p-6"><h3 className="font-semibold">Investment discipline</h3><dl className="mt-5 space-y-4"><DetailMetric label="Thesis coverage" value={`${healthy}/${investmentHoldings.length} healthy`} /><DetailMetric label="Tracked positions" value={String(investmentHoldings.length)} /><DetailMetric label="Portfolio scopes" value={String(portfolios.length)} /></dl><Link href="/invest/theses" className="mt-6 inline-flex h-10 items-center gap-2 rounded-full px-3 font-semibold hover:bg-[var(--surface-card-hover)]">Review theses <ArrowRight className="size-4" /></Link></div>
          </div>
        </section>

        <section className="mt-10"><h2 className="font-heading text-2xl font-semibold">Data coverage</h2><div className="mt-4 grid gap-4 sm:grid-cols-2"><CoverageCard label="Historical allocation" value="Not reconstructed" detail="Requires transaction and contribution history" /><CoverageCard label="Realized returns and dividends" value="Not connected" detail="Requires brokerage activity synchronization" /></div></section>
      </div>
    </div>
  );
}

function TopMetric({ label, value, tone }: { label: string; value: string; tone?: "positive" | "negative" }) { return <div><dt className="text-sm font-semibold">{label}</dt><dd className={cn("mt-2 font-semibold tabular-nums", tone === "positive" && "text-emerald-400", tone === "negative" && "text-rose-400")}>{value}</dd></div>; }
function DetailMetric({ label, value, tone }: { label: string; value: string; tone?: "positive" | "negative" }) { return <div className="flex items-center justify-between gap-4"><dt className="text-sm text-[var(--text-muted)]">{label}</dt><dd className={cn("font-semibold tabular-nums", tone === "positive" && "text-emerald-400", tone === "negative" && "text-rose-400")}>{value}</dd></div>; }
function CoverageCard({ label, value, detail }: { label: string; value: string; detail: string }) { return <div className="rounded-2xl border border-[var(--theme-border)] bg-[var(--surface-card)] p-6"><p className="text-sm font-semibold text-[var(--text-muted)]">{label}</p><p className="mt-3 text-xl font-semibold">{value}</p><p className="mt-2 text-xs text-[var(--text-muted)]">{detail}</p></div>; }
function formatMoney(value: number, currency: string) { return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(value || 0); }
function formatSignedMoney(value: number, currency: string) { return `${value >= 0 ? "+" : "-"}${formatMoney(Math.abs(value), currency)}`; }
function formatSignedPercent(value: number) { return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`; }
