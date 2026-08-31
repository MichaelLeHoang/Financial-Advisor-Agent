"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, BarChart3, BriefcaseBusiness, ChevronRight, CircleAlert, Clock3, Expand, Eye, EyeOff, ListFilter, RefreshCw, Scale, ShieldCheck } from "lucide-react";
import InteractiveMarketChart, { type InteractiveChartPoint } from "@/components/market/InteractiveMarketChart";
import PositionReviewDrawer from "@/components/investment-workspace/PositionReviewDrawer";
import { useInvestmentWorkspace, type InvestmentHoldingRecord, type InvestmentPeriod } from "@/components/investment-workspace/InvestmentWorkspaceProvider";
import type { InvestmentPolicyAlert, InvestmentThesis, MarketQuote } from "@/lib/api";
import { buildInvestmentActivity } from "@/lib/investment-activity";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import WorkspaceSelectMenu from "@/components/ui/workspace-select-menu";
import { isEditableShortcutTarget, keyboardShortcutsEnabled } from "@/lib/keyboard-shortcuts";
import { DataReveal, LoadingRegion, RefreshingIndicator, SkeletonBlock } from "@/components/ui/DataLoading";

type PerformancePoint = InteractiveChartPoint & { benchmark: number; rawValue: number; rawBenchmarkReturn: number };
type ReviewItem = { record: InvestmentHoldingRecord; reasons: string[]; tone: "warning" | "danger" };

const PERIODS: InvestmentPeriod[] = ["1D", "1W", "1M", "3M", "6M", "YTD", "1Y", "ALL"];

export default function InvestPage() {
  const workspace = useInvestmentWorkspace();
  const {
    portfolios, investmentHoldings, unclassifiedHoldings, theses, decisions, quotes, currencyRates,
    watchlistAssets, events, recurringBuys, policyValidation, preferences, loading, refreshing, quotesLoading,
    saving, error, refreshedAt, setPreference, classifyAsInvestment, saveThesis, recordDecision, refresh,
  } = workspace;
  const [reviewRecord, setReviewRecord] = useState<InvestmentHoldingRecord | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);

  useEffect(() => {
    const togglePrivacy = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "i" || event.metaKey || event.ctrlKey || event.altKey || isEditableShortcutTarget(event.target) || !keyboardShortcutsEnabled()) return;
      event.preventDefault();
      setPreference("privacyMode", !preferences.privacyMode);
    };
    window.addEventListener("keydown", togglePrivacy);
    return () => window.removeEventListener("keydown", togglePrivacy);
  }, [preferences.privacyMode, setPreference]);

  const series = useMemo(() => buildPerformanceSeries(investmentHoldings, quotes, currencyRates, preferences.benchmark, preferences.performanceMode), [currencyRates, investmentHoldings, preferences.benchmark, preferences.performanceMode, quotes]);
  const totalValue = useMemo(() => investmentHoldings.reduce((sum, { holding }) => {
    const quote = quotes.get(holding.symbol.toUpperCase());
    const currency = (quote?.currency || holding.cost_currency || "USD").toUpperCase();
    return sum + holding.quantity * (quote?.price || holding.average_cost) * (currencyRates.get(currency) ?? 1);
  }, 0), [currencyRates, investmentHoldings, quotes]);
  const periodReturn = series.length > 1 ? percentChange(series[0].rawValue, series.at(-1)!.rawValue) : 0;
  const periodReturnAmount = series.length > 1 ? series.at(-1)!.rawValue - series[0].rawValue : 0;
  const benchmarkReturn = series.at(-1)?.rawBenchmarkReturn ?? 0;
  const holdingsWithValue = useMemo(() => investmentHoldings.map((record) => {
    const quote = quotes.get(record.holding.symbol.toUpperCase());
    const currency = (quote?.currency || record.holding.cost_currency || "USD").toUpperCase();
    const value = record.holding.quantity * (quote?.price || record.holding.average_cost) * (currencyRates.get(currency) ?? 1);
    return { record, quote, value, weight: totalValue ? (value / totalValue) * 100 : 0 };
  }), [currencyRates, investmentHoldings, quotes, totalValue]);
  const largest = [...holdingsWithValue].sort((a, b) => b.weight - a.weight)[0];
  const thesisByHolding = useMemo(() => new Map(theses.map((thesis) => [thesis.holding_id, thesis])), [theses]);
  const reviewItems = useMemo(() => buildReviewItems(investmentHoldings, unclassifiedHoldings, thesisByHolding, policyValidation?.alerts ?? []), [investmentHoldings, policyValidation?.alerts, thesisByHolding, unclassifiedHoldings]);
  const healthyTheses = investmentHoldings.filter(({ holding }) => thesisHealth(thesisByHolding.get(holding.id)) === "Healthy").length;
  const policyByHolding = useMemo(() => new Map((policyValidation?.alerts ?? []).flatMap((alert) => (alert.holding_ids ?? []).map((id) => [id, alert] as const))), [policyValidation]);
  const liveReviewRecord = reviewRecord ? workspace.allHoldings.find(({ holding }) => holding.id === reviewRecord.holding.id) ?? reviewRecord : null;
  const selectedReviewValue = liveReviewRecord ? holdingsWithValue.find(({ record }) => record.holding.id === liveReviewRecord.holding.id) : null;

  const openReview = (record: InvestmentHoldingRecord) => {
    setReviewRecord(record);
    setReviewOpen(true);
  };

  const contributors = [...holdingsWithValue].map((item) => ({ ...item, contribution: item.record.holding.quantity * (item.quote?.change ?? 0) })).sort((a, b) => b.contribution - a.contribution);
  const maxDrawdown = maximumDrawdown(series.map((point) => point.rawValue));
  const activity = buildInvestmentActivity(decisions, theses, events, recurringBuys).slice(0, 8);

  return (
    <div className="min-h-full min-w-0 bg-[var(--theme-bg)] px-4 py-4 text-[var(--text-primary)] lg:px-6 xl:px-8">
      <div className="mx-auto min-w-0 max-w-[1840px]">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-heading text-2xl font-semibold">Investment Portfolio</h1>
              <span className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)]"><Clock3 className="size-3.5" /> {refreshedAt ? `Updated ${relativeTime(refreshedAt)}` : "Not synced"}</span>
              <RefreshingIndicator refreshing={refreshing} label="Updating portfolio" />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <WorkspaceSelectMenu
                ariaLabel="Investment portfolio scope"
                value={preferences.portfolioScope}
                options={[{ value: "all", label: "All investment portfolios" }, ...portfolios.map((portfolio) => ({ value: portfolio.id, label: portfolio.name }))]}
                onValueChange={(value) => setPreference("portfolioScope", value)}
                className="h-10 min-w-0 w-full max-w-[min(28rem,calc(100vw-2rem))] sm:w-auto sm:min-w-52"
                contentClassName="min-w-64"
              />
              <WorkspaceSelectMenu
                ariaLabel="Display currency"
                value={preferences.displayCurrency}
                options={[preferences.displayCurrency, "USD", "CAD", "EUR", "GBP"].filter((value, index, values) => values.indexOf(value) === index).map((currency) => ({ value: currency, label: currency }))}
                onValueChange={(value) => setPreference("displayCurrency", value)}
                className="h-10 min-w-24"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" title="Refresh investment data" aria-label="Refresh investment data" onClick={() => void refresh()} disabled={loading || refreshing} className="inline-flex size-10 items-center justify-center rounded-full border border-[var(--theme-border-strong)] hover:bg-[var(--surface-card-hover)] disabled:opacity-45"><RefreshCw className={cn("size-4", (loading || refreshing) && "animate-spin motion-reduce:animate-none")} /></button>
            <Link href="/invest/accounts" className="inline-flex h-10 items-center gap-2 rounded-full border border-[var(--theme-border-strong)] px-4 text-sm font-semibold hover:bg-[var(--surface-card-hover)]"><BriefcaseBusiness className="size-4" /> Connect portfolio</Link>
            <button type="button" disabled={!reviewItems[0]} onClick={() => reviewItems[0] && openReview(reviewItems[0].record)} className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-black disabled:opacity-40"><ShieldCheck className="size-4" /> Run review</button>
          </div>
        </header>

        {error && <div role="alert" className="mt-4 flex items-start gap-2 border border-red-400/25 bg-red-400/8 p-3 text-sm text-red-200"><CircleAlert className="mt-0.5 size-4 shrink-0" />{error}</div>}

        <div className="mt-6 grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,2.35fr)_minmax(320px,0.65fr)]">
          <div className="min-w-0">
            <section id="performance" aria-labelledby="performance-heading" className="w-full min-w-0 max-w-full scroll-mt-16">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                  <p id="performance-heading" className="text-sm font-semibold text-[var(--text-muted)]">Portfolio performance</p>
                  {preferences.privacyMode ? <div className="mt-3"><div className="flex flex-wrap items-center gap-2">{Array.from({ length: 7 }, (_, index) => <span key={index} className="size-7 rounded-full border border-white/25 bg-white/[0.08]" />)}<button type="button" aria-label="Toggle portfolio privacy" aria-pressed="true" onClick={() => setPreference("privacyMode", false)} className="inline-flex size-10 items-center justify-center rounded-full hover:bg-[var(--surface-card-hover)]"><Eye className="size-5 text-[var(--text-muted)]" /></button></div><Link href="/invest/performance" className="mt-5 inline-flex min-h-10 max-w-full flex-wrap items-center gap-2 rounded-full px-3 py-2 text-base font-semibold leading-tight text-[var(--text-secondary)] hover:bg-[var(--surface-card-hover)] hover:text-[var(--text-primary)]">Performance insights <ArrowRight className="size-4 shrink-0" /></Link></div> : <div className="mt-2 min-w-0"><div className="flex min-w-0 flex-wrap items-center gap-3"><LoadingRegion loading={loading} label="Loading portfolio value" skeleton={<SkeletonBlock className="h-12 w-48 rounded-sm" />}><DataReveal ready><p className="break-words font-heading text-4xl font-semibold tabular-nums sm:text-5xl">{formatMoney(totalValue, preferences.displayCurrency)}</p></DataReveal></LoadingRegion><button type="button" aria-label="Toggle portfolio privacy" aria-pressed="false" onClick={() => setPreference("privacyMode", true)} className="inline-flex size-10 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--surface-card-hover)] hover:text-[var(--text-primary)]"><EyeOff className="size-5" /></button></div><Link href="/invest/performance" aria-label="Performance insights" className={cn("mt-2 inline-flex min-h-10 max-w-full flex-wrap items-center gap-2 rounded-full px-2 py-2 text-base font-semibold leading-tight tabular-nums hover:bg-[var(--surface-card-hover)]", periodReturnAmount >= 0 ? "text-emerald-400" : "text-rose-400")}>{formatSignedMoney(periodReturnAmount, preferences.displayCurrency)} past {periodLabel(preferences.period)} <ArrowRight className="size-4 shrink-0" /></Link><p className="mt-1 break-words text-xs text-[var(--text-muted)]">Estimated from current positions · {formatSignedPercent(periodReturn - benchmarkReturn)} vs {preferences.benchmark}</p></div>}
                </div>
                <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
                  <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-emerald-400" />Portfolio</span>
                  <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-slate-400" />{preferences.benchmark}</span>
                </div>
              </div>
              <div className="mt-4 h-[280px] w-full min-w-0 max-w-full overflow-hidden sm:h-[360px]">
              <LoadingRegion loading={quotesLoading && series.length <= 1} label="Loading estimated history" className="h-full w-full" skeleton={<SkeletonBlock className="h-full w-full rounded-lg" />}>{series.length > 1 ? (
                <InteractiveMarketChart data={series} mode="area" color="#34d399" valueKey="price" volume={false} compareMode compareLines={[{ key: "benchmark", color: "#94a3b8", lineWidth: 2 }]} rangeKey={`${preferences.period}-${preferences.performanceMode}-${preferences.benchmark}`} axisFormatter={(value) => preferences.privacyMode ? "•••" : preferences.performanceMode === "value" ? compactMoney(value, preferences.displayCurrency) : `${value.toFixed(1)}%`} timeFormatter={shortChartDate} tooltip={(point) => <div className="space-y-1.5 text-xs"><p className="font-semibold">{point.label}</p>{preferences.privacyMode ? <p className="text-[var(--text-muted)]">Values hidden</p> : <><p className="flex items-center gap-2"><span className="size-2 rounded-full bg-emerald-400" />Portfolio {preferences.performanceMode === "value" ? formatMoney(point.price, preferences.displayCurrency) : formatSignedPercent(point.price)}</p><p className="flex items-center gap-2"><span className="size-2 rounded-full bg-slate-400" />{preferences.benchmark} {preferences.performanceMode === "value" ? formatMoney(point.benchmark, preferences.displayCurrency) : formatSignedPercent(point.benchmark)}</p></>}</div>} tooltipClassName="rounded-lg border border-white/15 bg-black/55 p-3 shadow-2xl backdrop-blur-xl" className="h-full w-full" />
              ) : <div className="flex h-full items-center justify-center border border-dashed border-[var(--theme-border)] text-center text-sm text-[var(--text-muted)]">Add and classify Investment holdings to build an estimated performance view.</div>}</LoadingRegion>
              </div>
              <div className="mt-2 flex flex-col gap-3 border-t border-[var(--theme-border)] pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex max-w-full gap-1 overflow-x-auto pb-1" role="group" aria-label="Performance period">
                  {PERIODS.map((period) => <button key={period} type="button" aria-pressed={preferences.period === period} onClick={() => setPreference("period", period)} className={cn("h-9 shrink-0 rounded-full px-3.5 text-xs font-semibold", preferences.period === period ? "bg-white/[0.11] text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:bg-white/[0.05] hover:text-[var(--text-primary)]")}>{period}</button>)}
                </div>
                <div role="group" aria-label="Performance mode" className="flex h-10 w-fit rounded-full bg-[var(--surface-control)] p-1">
                  {(["value", "returns"] as const).map((mode) => <button key={mode} type="button" aria-pressed={preferences.performanceMode === mode} onClick={() => setPreference("performanceMode", mode)} className={cn("rounded-full px-4 text-xs font-semibold capitalize text-[var(--text-muted)]", preferences.performanceMode === mode && "bg-white/[0.11] text-[var(--text-primary)]")}>{mode}</button>)}
                </div>
              </div>
            </section>

            <section aria-label="Portfolio insights" className="mt-6 grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
              <MetricCard title="Performance insights" icon={<BarChart3 className="size-4" />}>
                <Insight label="Best contributor" value={preferences.privacyMode ? "••••••" : contributors[0] ? `${contributors[0].record.holding.symbol} ${formatSignedMoney(contributors[0].contribution, preferences.displayCurrency)}` : "Not available"} />
                <Insight label="Largest detractor" value={preferences.privacyMode ? "••••••" : contributors.at(-1) && contributors.at(-1)!.contribution < 0 ? `${contributors.at(-1)!.record.holding.symbol} ${formatSignedMoney(contributors.at(-1)!.contribution, preferences.displayCurrency)}` : "No negative move"} />
                <Insight label="Estimated drawdown" value={preferences.privacyMode ? "••••" : formatSignedPercent(-maxDrawdown)} />
              </MetricCard>
              <MetricCard title="Portfolio discipline" icon={<ShieldCheck className="size-4" />}>
                <Insight label="Concentration" value={largest ? `${largest.weight > 10 ? "Elevated" : "Within policy"} · ${largest.record.holding.symbol} ${largest.weight.toFixed(1)}%` : "Not available"} />
                <Insight label="Thesis coverage" value={`${healthyTheses}/${investmentHoldings.length} healthy`} />
                <Insight label="Review queue" value={`${reviewItems.length} positions`} />
              </MetricCard>
            </section>
          </div>

          <aside className="space-y-4 xl:sticky xl:top-16 xl:self-start">
            <section className="rounded-2xl border border-[var(--theme-border)] bg-[var(--surface-card)] p-4">
              <div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">Portfolio review</h2><p className="mt-1 text-xs text-[var(--text-muted)]">{reviewItems.length} positions need attention</p></div><Scale className="size-5 text-amber-300" /></div>
              <div className="mt-4 divide-y divide-[var(--theme-border)]">
                {reviewItems.length ? reviewItems.slice(0, 3).map((item) => <button key={item.record.holding.id} type="button" onClick={() => openReview(item.record)} className="flex w-full items-start justify-between gap-3 py-4 text-left hover:bg-[var(--surface-card-hover)]"><div className="min-w-0"><p className="font-semibold">{item.record.holding.symbol}</p><p className={cn("mt-1 text-xs leading-5", item.tone === "danger" ? "text-rose-300" : "text-amber-200")}>{item.reasons.join(" · ")}</p></div><ChevronRight className="mt-1 size-4 shrink-0 text-[var(--text-muted)]" /></button>) : <div className="py-8 text-center"><ShieldCheck className="mx-auto size-6 text-emerald-400" /><p className="mt-3 text-sm font-semibold">No recorded review issues</p><p className="mt-1 text-xs text-[var(--text-muted)]">Policy and thesis checks are current.</p></div>}
              </div>
              {reviewItems.length > 3 && <button type="button" onClick={() => openReview(reviewItems[0].record)} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-emerald-400">Review portfolio <ArrowRight className="size-4" /></button>}
            </section>
            <HoldingsRail holdings={holdingsWithValue} watchlistAssets={watchlistAssets} quotes={quotes} theses={thesisByHolding} mode={preferences.railMode} sort={preferences.railSort} currency={preferences.displayCurrency} privacy={preferences.privacyMode} onMode={(mode) => setPreference("railMode", mode)} onSort={(sort) => setPreference("railSort", sort)} onReview={openReview} />
          </aside>
        </div>

        <section id="accounts" className="mt-8 scroll-mt-16 border-t border-[var(--theme-border)] pt-6">
          <div className="flex items-end justify-between gap-4"><div><h2 className="text-xl font-semibold">Investment portfolios</h2><p className="mt-1 text-sm text-[var(--text-muted)]">Investment positions only; Trading remains in its own workspace.</p></div><Link href="/portfolio" className="hidden items-center gap-1 text-sm font-semibold text-emerald-400 sm:inline-flex">View complete portfolio picture <ArrowRight className="size-4" /></Link></div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {portfolios.map((portfolio) => {
              const values = holdingsWithValue.filter(({ record }) => record.portfolio.id === portfolio.id);
              const value = values.reduce((sum, item) => sum + item.value, 0);
              return <button key={portfolio.id} type="button" onClick={() => setPreference("portfolioScope", portfolio.id)} className="rounded-2xl border border-[var(--theme-border)] bg-[var(--surface-card)] p-5 text-left hover:bg-[var(--surface-card-hover)]"><div className="flex items-center justify-between gap-3"><p className="font-semibold">{portfolio.name}</p><ArrowRight className="size-4 text-[var(--text-muted)]" /></div><p className="mt-5 text-2xl font-semibold tabular-nums">{preferences.privacyMode ? "••••••" : formatMoney(value, preferences.displayCurrency)}</p><p className="mt-1 text-xs text-[var(--text-muted)]">{values.length} Investment positions · base {portfolio.base_currency}</p></button>;
            })}
            {!portfolios.length && <div className="rounded-lg border border-dashed border-[var(--theme-border)] p-6 text-sm text-[var(--text-muted)]">No saved portfolios yet. Connect or create one in Portfolio Accounts.</div>}
          </div>
        </section>

        <section id="activity" className="mt-10 scroll-mt-16 border-t border-[var(--theme-border)] pt-8">
          <div className="flex items-center justify-between"><div><h2 className="text-xl font-semibold">Recent investment activity</h2><p className="mt-1 text-sm text-[var(--text-muted)]">Portfolio records and owner-authored review events</p></div><Link href="/journal/investments" className="text-sm font-semibold text-emerald-400">Open journal</Link></div>
          <div className="mt-4 divide-y divide-[var(--theme-border)] border-y border-[var(--theme-border)]">
            {activity.length ? activity.map((item) => <div key={item.id} className="grid gap-1 py-4 text-sm sm:grid-cols-[110px_90px_1fr_auto] sm:items-center"><time className="text-[var(--text-muted)]">{formatDate(item.at)}</time><span className="font-semibold">{item.symbol}</span><span>{item.label}</span><span className="text-xs text-[var(--text-muted)]">{preferences.privacyMode && item.kind === "purchase" ? "••••" : item.detail}</span></div>) : <p className="py-8 text-center text-sm text-[var(--text-muted)]">No investment activity recorded yet.</p>}
          </div>
        </section>
      </div>

      <PositionReviewDrawer open={reviewOpen} onOpenChange={setReviewOpen} record={liveReviewRecord} thesis={liveReviewRecord ? thesisByHolding.get(liveReviewRecord.holding.id) ?? null : null} policyAlert={liveReviewRecord ? policyByHolding.get(liveReviewRecord.holding.id) ?? null : null} value={selectedReviewValue?.value ?? 0} weight={selectedReviewValue?.weight ?? 0} currency={preferences.displayCurrency} saving={saving} onClassify={async () => { if (liveReviewRecord) await classifyAsInvestment(liveReviewRecord); }} onSaveThesis={async (payload) => { if (liveReviewRecord) await saveThesis(liveReviewRecord.holding.id, payload); }} onRecordDecision={async (action, rationale, exception) => { if (liveReviewRecord) await recordDecision(liveReviewRecord.holding.id, action, rationale, exception); }} />
    </div>
  );
}

function HoldingsRail({ holdings, watchlistAssets, quotes, theses, mode, sort, currency, privacy, onMode, onSort, onReview }: { holdings: Array<{ record: InvestmentHoldingRecord; quote?: MarketQuote; value: number; weight: number }>; watchlistAssets: Array<{ id: string; symbol: string }>; quotes: Map<string, MarketQuote>; theses: Map<string, InvestmentThesis>; mode: "holdings" | "watchlist"; sort: "value" | "weight" | "return" | "thesis"; currency: string; privacy: boolean; onMode: (mode: "holdings" | "watchlist") => void; onSort: (sort: "value" | "weight" | "return" | "thesis") => void; onReview: (record: InvestmentHoldingRecord) => void }) {
  const sorted = [...holdings].sort((a, b) => sort === "weight" ? b.weight - a.weight : sort === "return" ? (b.quote?.change ?? 0) - (a.quote?.change ?? 0) : sort === "thesis" ? thesisHealth(theses.get(a.record.holding.id)).localeCompare(thesisHealth(theses.get(b.record.holding.id))) : b.value - a.value);
  const sortOptions = [
    { value: "return", label: "Today's return" },
    { value: "value", label: "Total value" },
    { value: "weight", label: "Portfolio weight" },
    { value: "thesis", label: "Thesis health" },
  ] as const;
  const sortLabel = sort === "return" ? "1D" : sort === "value" ? "Value" : sort === "weight" ? "Weight" : "Thesis";

  return (
    <section className="min-w-0 rounded-2xl border border-[var(--theme-border)] bg-[var(--surface-card)] p-[16px] sm:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Investment list" className="grid h-10 w-full min-w-0 flex-none grid-cols-2 rounded-full bg-[var(--surface-control)] p-1 sm:min-w-[12.5rem] sm:flex-1">
          {(["holdings", "watchlist"] as const).map((item) => <button key={item} type="button" role="tab" aria-selected={mode === item} onClick={() => onMode(item)} className={cn("min-w-0 rounded-full px-[12px] text-sm font-semibold capitalize sm:px-3", mode === item ? "bg-white/[0.10] text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:bg-white/[0.05]")}>{item}</button>)}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger aria-label={`Sort investment list: ${sortLabel}`} className="inline-flex h-10 items-center overflow-hidden rounded-full bg-white/[0.10] text-sm font-semibold hover:bg-white/[0.14]">
              <span className="px-3.5">{sortLabel}</span>
              <span className="inline-flex h-full items-center border-l border-black/25 px-3"><ListFilter className="size-4" /></span>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="bottom" align="end" sideOffset={8} className="w-72 rounded-[28px] border-white/15 bg-[#232323] p-4">
              <p className="px-2 pb-3 text-base font-semibold">Sort by</p>
              {sortOptions.map((option) => <DropdownMenuItem key={option.value} onClick={() => onSort(option.value)} className="h-12 justify-between rounded-xl px-2 text-base text-[var(--text-primary)]"><span>{option.label}</span><span className={cn("flex size-5 items-center justify-center rounded-full border-2 border-white", sort === option.value && "bg-white")}><span className={cn("size-2 rounded-full bg-[#232323]", sort !== option.value && "hidden")} /></span></DropdownMenuItem>)}
            </DropdownMenuContent>
          </DropdownMenu>
          <Link href={mode === "holdings" ? "/invest/holdings" : "/watchlist"} aria-label={`Expand ${mode}`} title={`Expand ${mode}`} className="inline-flex size-10 items-center justify-center rounded-full bg-white/[0.10] hover:bg-white/[0.14]"><Expand className="size-4" /></Link>
        </div>
      </div>

      <div className="mt-3 divide-y divide-[var(--theme-border)]">
        {mode === "holdings" ? sorted.slice(0, 7).map(({ record, quote, value, weight }) => <button key={record.holding.id} type="button" onClick={() => onReview(record)} className="flex w-full items-center justify-between gap-3 rounded-lg px-1 py-3 text-left hover:bg-white/[0.035]"><div className="flex min-w-0 items-center gap-3"><SymbolMark symbol={record.holding.symbol} /><div className="min-w-0"><p className="text-sm font-semibold">{record.holding.symbol}</p><p className="mt-1 truncate text-xs text-[var(--text-muted)]">{privacy ? "••••••" : `${formatMoney(value, currency)} · ${weight.toFixed(1)}%`} · {thesisHealth(theses.get(record.holding.id))}</p></div></div><span className={cn("shrink-0 text-sm font-semibold tabular-nums", (quote?.change ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400")}>{privacy ? "••••" : formatSignedMoney((quote?.change ?? 0) * record.holding.quantity, currency)}</span></button>) : watchlistAssets.slice(0, 7).map((asset) => { const quote = quotes.get(asset.symbol.toUpperCase()); return <Link key={asset.id} href={`/market?symbol=${encodeURIComponent(asset.symbol)}`} className="flex items-center justify-between gap-3 rounded-lg px-1 py-3 hover:bg-white/[0.035]"><div className="flex min-w-0 items-center gap-3"><SymbolMark symbol={asset.symbol} /><div className="min-w-0"><p className="text-sm font-semibold">{asset.symbol}</p><p className="mt-1 truncate text-xs text-[var(--text-muted)]">{quote?.name || "Watchlist security"}</p></div></div><div className="text-right"><p className="text-sm font-semibold tabular-nums">{privacy ? "••••" : quote ? formatMoney(quote.price, quote.currency || currency) : "—"}</p><p className={cn("mt-1 text-xs", (quote?.change ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400")}>{privacy ? "••••" : quote ? formatSignedMoney(quote.change, quote.currency || currency) : "No quote"}</p></div></Link>; })}
        {(mode === "holdings" ? holdings.length : watchlistAssets.length) === 0 && <p className="py-8 text-center text-sm text-[var(--text-muted)]">No {mode} to show.</p>}
      </div>
      <Link href={mode === "holdings" ? "/invest/holdings" : "/watchlist"} className="mt-3 inline-flex h-9 items-center gap-1 rounded-full px-3 text-sm font-semibold text-emerald-400 hover:bg-emerald-400/10">View all {mode} <ArrowRight className="size-4" /></Link>
    </section>
  );
}

function SymbolMark({ symbol }: { symbol: string }) {
  const colors = ["bg-cyan-400/20 text-cyan-200", "bg-emerald-400/20 text-emerald-200", "bg-indigo-400/20 text-indigo-200", "bg-amber-400/20 text-amber-100"];
  const index = symbol.split("").reduce((sum, character) => sum + character.charCodeAt(0), 0) % colors.length;
  return <span aria-hidden="true" className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-full text-[10px] font-bold", colors[index])}>{symbol.slice(0, 4)}</span>;
}

function MetricCard({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) { return <div className="min-w-0 rounded-2xl border border-[var(--theme-border)] bg-[var(--surface-card)] p-[20px] sm:p-5"><div className="flex min-w-0 items-center justify-between gap-3"><h2 className="min-w-0 break-words text-base font-semibold">{title}</h2><span className="shrink-0 text-[var(--text-muted)]">{icon}</span></div><dl className="mt-5 min-w-0 space-y-3">{children}</dl></div>; }
function Insight({ label, value }: { label: string; value: string }) { return <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-[var(--theme-border)] pb-3 last:border-b-0 last:pb-0"><dt className="min-w-0 break-words text-sm text-[var(--text-muted)]">{label}</dt><dd className="min-w-0 break-words text-right text-sm font-semibold tabular-nums">{value}</dd></div>; }

function buildPerformanceSeries(holdings: InvestmentHoldingRecord[], quotes: Map<string, MarketQuote>, rates: Map<string, number>, benchmarkSymbol: string, mode: "value" | "returns"): PerformancePoint[] {
  const histories = holdings.map(({ holding }) => ({ holding, quote: quotes.get(holding.symbol.toUpperCase()) })).filter((item): item is { holding: InvestmentHoldingRecord["holding"]; quote: MarketQuote } => Boolean(item.quote?.history.length));
  const baseHistory = [...histories].sort((a, b) => b.quote.history.length - a.quote.history.length)[0]?.quote.history ?? [];
  if (baseHistory.length < 2) return [];
  const benchmark = quotes.get(benchmarkSymbol.toUpperCase())?.history ?? [];
  const raw = baseHistory.map((point, index) => {
    const ratio = baseHistory.length === 1 ? 0 : index / (baseHistory.length - 1);
    const value = histories.reduce((sum, { holding, quote }) => {
      const quotePoint = quote.history[Math.min(quote.history.length - 1, Math.round(ratio * (quote.history.length - 1)))];
      const rate = rates.get((quote.currency || holding.cost_currency || "USD").toUpperCase()) ?? 1;
      return sum + holding.quantity * quotePoint.price * rate;
    }, 0);
    const benchmarkPoint = benchmark[Math.min(benchmark.length - 1, Math.round(ratio * Math.max(0, benchmark.length - 1)))];
    return { label: point.label, value, benchmarkPrice: benchmarkPoint?.price ?? 0 };
  }).filter((point) => point.value > 0);
  if (raw.length < 2) return [];
  const startValue = raw[0].value;
  const startBenchmark = raw[0].benchmarkPrice || 1;
  return raw.map((point) => {
    const portfolioReturn = percentChange(startValue, point.value);
    const benchmarkReturn = point.benchmarkPrice ? percentChange(startBenchmark, point.benchmarkPrice) : 0;
    return { label: point.label, price: mode === "value" ? point.value : portfolioReturn, benchmark: mode === "value" ? startValue * (1 + benchmarkReturn / 100) : benchmarkReturn, rawValue: point.value, rawBenchmarkReturn: benchmarkReturn };
  });
}

function buildReviewItems(investments: InvestmentHoldingRecord[], unclassified: InvestmentHoldingRecord[], theses: Map<string, InvestmentThesis>, alerts: InvestmentPolicyAlert[]): ReviewItem[] {
  const result = new Map<string, ReviewItem>();
  const add = (record: InvestmentHoldingRecord, reason: string, tone: ReviewItem["tone"] = "warning") => { const current = result.get(record.holding.id); result.set(record.holding.id, { record, reasons: [...(current?.reasons ?? []), reason], tone: current?.tone === "danger" || tone === "danger" ? "danger" : "warning" }); };
  unclassified.forEach((record) => add(record, "Purpose is unclassified"));
  investments.forEach((record) => { const health = thesisHealth(theses.get(record.holding.id)); if (health !== "Healthy") add(record, health === "Missing" ? "Ownership thesis is missing" : `Thesis ${health.toLowerCase()}`, health === "Invalidated" ? "danger" : "warning"); });
  alerts.forEach((alert) => investments.filter(({ holding }) => alert.holding_ids?.includes(holding.id) || (!alert.holding_ids?.length && alert.symbol === holding.symbol)).forEach((record) => add(record, alert.message, alert.severity === "breach" ? "danger" : "warning")));
  return Array.from(result.values());
}

function thesisHealth(thesis?: InvestmentThesis) { if (!thesis) return "Missing"; if (thesis.status === "invalidated") return "Invalidated"; if (thesis.status === "needs_review" || (thesis.next_review_at && new Date(thesis.next_review_at) < new Date())) return "Needs review"; return "Healthy"; }
function percentChange(start: number, end: number) { return start ? ((end - start) / start) * 100 : 0; }
function maximumDrawdown(values: number[]) { let peak = 0; let result = 0; values.forEach((value) => { peak = Math.max(peak, value); if (peak) result = Math.max(result, ((peak - value) / peak) * 100); }); return result; }
function formatMoney(value: number, currency: string) { return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(value || 0); }
function compactMoney(value: number, currency: string) { return new Intl.NumberFormat("en-US", { style: "currency", currency, notation: "compact", maximumFractionDigits: 1 }).format(value || 0); }
function formatSignedMoney(value: number, currency: string) { const formatted = formatMoney(Math.abs(value), currency); return `${value >= 0 ? "+" : "-"}${formatted}`; }
function formatSignedPercent(value: number) { return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`; }
function periodLabel(period: InvestmentPeriod) { return ({ "1D": "day", "1W": "week", "1M": "month", "3M": "3 months", "6M": "6 months", YTD: "year to date", "1Y": "year", ALL: "all time" } as const)[period]; }
function relativeTime(value: string) { const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000)); if (seconds < 60) return "just now"; if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`; return `${Math.floor(seconds / 3600)}h ago`; }
function formatDate(value: string) { return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(value)); }
function shortChartDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date); }
