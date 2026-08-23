"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, BriefcaseBusiness, CircleAlert, Database, LineChart, MessageSquareText, RefreshCw, ShieldAlert, WalletCards } from "lucide-react";
import { Metric, Panel, PanelHeading, PrimaryLink, SecondaryLink, Status, WorkspacePage } from "@/components/workspace/WorkspaceUI";
import { usePortfolioBooks } from "@/components/portfolio/PortfolioBooksProvider";
import { useInvestmentPolicy } from "@/components/investment-policy/InvestmentPolicyProvider";
import type { Holding, InvestmentPolicyAlert, MarketQuote, PositionBook } from "@/lib/api";
import { fetchQuotes } from "@/lib/quote-cache";
import { isKeyedRequestPending } from "@/lib/loading-state";
import { greetingForDate, millisecondsUntilNextGreeting } from "@/lib/time-greeting";
import { LoadingRegion, RefreshingIndicator, SkeletonBlock } from "@/components/ui/DataLoading";

export default function HomePage() {
  const { portfolio, holdings, summary, events, loading: booksLoading, refreshing: booksRefreshing, error: booksError, refreshedAt, refresh } = usePortfolioBooks();
  const { policy, validation, loading: policyLoading, refreshing: policyRefreshing, error: policyError, refresh: refreshPolicy } = useInvestmentPolicy();
  const [quotes, setQuotes] = useState<Map<string, MarketQuote>>(new Map());
  const [settledQuoteTickerKey, setSettledQuoteTickerKey] = useState("");
  const [greeting, setGreeting] = useState("Welcome back");
  const tickerKey = useMemo(() => holdings.map((holding) => holding.symbol.toUpperCase()).sort().join(","), [holdings]);

  useEffect(() => {
    let timer: number | undefined;
    const syncGreeting = () => {
      window.clearTimeout(timer);
      const now = new Date();
      setGreeting(greetingForDate(now));
      timer = window.setTimeout(syncGreeting, millisecondsUntilNextGreeting(now));
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") syncGreeting();
    };

    syncGreeting();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (booksLoading || !tickerKey) {
      setQuotes(new Map());
      setSettledQuoteTickerKey("");
      return () => { active = false; };
    }
    void fetchQuotes(tickerKey.split(","), "5d", "1d").then((nextQuotes) => {
      if (active) {
        setQuotes(nextQuotes);
        setSettledQuoteTickerKey(tickerKey);
      }
    });
    return () => { active = false; };
  }, [booksLoading, tickerKey]);

  const investment = summary?.books.find((book) => book.book_type === "investment");
  const trading = summary?.books.find((book) => book.book_type === "trading");
  const unresolved = holdings.filter((holding) => holding.book_type === "unclassified");
  const currency = summary?.base_currency ?? "USD";
  const quoteCoverage = holdings.filter((holding) => quotes.has(holding.symbol.toUpperCase())).length;
  const totalValue = estimatedValue(holdings, quotes);
  const investmentValue = estimatedValue(holdings.filter((holding) => holding.book_type === "investment"), quotes);
  const tradingValue = estimatedValue(holdings.filter((holding) => holding.book_type === "trading"), quotes);
  const dayChange = holdings.reduce((sum, holding) => sum + (quotes.get(holding.symbol.toUpperCase())?.change ?? 0) * holding.quantity, 0);
  const quotedValue = holdings.reduce((sum, holding) => sum + (quotes.get(holding.symbol.toUpperCase())?.price ?? 0) * holding.quantity, 0);
  const previousQuotedValue = quotedValue - dayChange;
  const dayChangePercent = previousQuotedValue ? (dayChange / previousQuotedValue) * 100 : null;
  const alerts = useMemo(() => buildAttentionAlerts(validation?.alerts ?? [], unresolved), [unresolved, validation?.alerts]);
  const risk = portfolioRiskLabel({ booksError, booksLoading, policyError, policyLoading, policyConfigured: Boolean(policy), alerts, compliant: validation?.compliant });
  const hasPortfolioData = Boolean(summary);
  const quoteValuesLoading = isKeyedRequestPending(tickerKey, settledQuoteTickerKey);
  const monetaryValuesLoading = booksLoading || quoteValuesLoading;
  const totalValueLabel = monetaryValuesLoading ? "Loading" : booksError && !hasPortfolioData ? "Unavailable" : formatMoney(totalValue, currency);
  const totalValueDetail = monetaryValuesLoading
    ? "Fetching current market quotes"
    : quoteCoverage === holdings.length && holdings.length
      ? "Estimated market value across current positions"
      : quoteCoverage
        ? `${quoteCoverage} of ${holdings.length} live quotes · remainder at cost basis`
        : "Recorded cost basis across all books";
  const todayValue = monetaryValuesLoading ? "Loading" : quoteCoverage ? formatSignedMoney(dayChange, currency) : "Unavailable";
  const todayDetail = monetaryValuesLoading
    ? "Waiting for current quote coverage"
    : quoteCoverage
      ? `${dayChangePercent === null ? "Return unavailable" : formatSignedPercent(dayChangePercent)} · ${quoteCoverage} of ${holdings.length} positions quoted`
      : "No current quotes available";
  const recentEvents = [...events].sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at)).slice(0, 3);
  const nextStep = buildNextStep(unresolved, alerts, holdings, portfolio?.name);

  return (
    <WorkspacePage
      eyebrow="Command center"
      title={greeting}
      description="One view of your long-term capital, active risk, and the decisions that need attention today."
      actions={<><SecondaryLink href="/ai">Ask AI Desk</SecondaryLink><PrimaryLink href="/portfolio">Review portfolio</PrimaryLink></>}
      contextBar={<HomeContextBar portfolioName={portfolio?.name} currency={currency} positionCount={holdings.length} quoteCoverage={quoteCoverage} loading={booksLoading} refreshing={booksRefreshing || policyRefreshing} error={Boolean(booksError)} refreshedAt={refreshedAt} />}
    >
      <div className="grid gap-4 md:grid-cols-4">
        <Metric label="Total portfolio" value={totalValueLabel} detail={totalValueDetail} />
        <Metric label="Today" value={todayValue} detail={todayDetail} tone={!monetaryValuesLoading && quoteCoverage ? dayChange >= 0 ? "positive" : "negative" : "neutral"} />
        <Metric label="Tracked positions" value={booksLoading ? "Loading" : booksError && !hasPortfolioData ? "Unavailable" : String(holdings.length)} detail={portfolio ? `${portfolio.name} · ${currency}` : "No connected portfolio"} />
        <Metric label="Portfolio status" value={risk.value} detail={risk.detail} tone={risk.tone} />
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <WorkspaceSummary href="/invest" icon={BriefcaseBusiness} title="Investment Book" value={monetaryValuesLoading ? "Loading" : booksError && !hasPortfolioData ? "Unavailable" : formatMoney(investmentValue, currency)} result={monetaryValuesLoading ? "Waiting for quotes" : `${totalValue ? ((investmentValue / totalValue) * 100).toFixed(1) : "0.0"}% allocated`} detail={`${investment?.holding_count ?? 0} classified holding${investment?.holding_count === 1 ? "" : "s"}`} accent="emerald" />
        <WorkspaceSummary href="/trade" icon={LineChart} title="Trading Book" value={monetaryValuesLoading ? "Loading" : booksError && !hasPortfolioData ? "Unavailable" : formatMoney(tradingValue, currency)} result={monetaryValuesLoading ? "Waiting for quotes" : `${totalValue ? ((tradingValue / totalValue) * 100).toFixed(1) : "0.0"}% allocated`} detail={`${trading?.holding_count ?? 0} active book position${trading?.holding_count === 1 ? "" : "s"}`} accent="sky" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
        <Panel>
          <PanelHeading title="Requires attention" detail="Saved portfolio and policy checks" action={<ShieldAlert className="size-4 text-amber-300" />} />
          <LoadingRegion loading={booksLoading} label="Loading portfolio checks" skeleton={<div className="space-y-3 py-5"><SkeletonBlock className="h-12 w-full rounded-lg" /><SkeletonBlock className="h-12 w-5/6 rounded-lg" /></div>}>
            <div className="divide-y divide-[var(--theme-border)]">
              {alerts.slice(0, 4).map((alert) => <Attention key={alert.key} href={alert.href} title={alert.title} detail={alert.detail} tone={alert.tone} />)}
              {!alerts.length && <div className="py-8 text-center"><p className="text-sm font-semibold">No recorded issues need attention</p><p className="mt-1 text-xs text-[var(--text-muted)]">New classification and policy alerts will appear here.</p></div>}
            </div>
          </LoadingRegion>
        </Panel>
        <Panel>
          <PanelHeading title="Portfolio brief" detail={new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date())} />
          <p className="text-sm leading-6 text-[var(--text-secondary)]">{portfolioBrief({ booksLoading, booksError, summary, investmentCount: investment?.holding_count ?? 0, tradingCount: trading?.holding_count ?? 0 })}</p>
          <Link href="/portfolio" className="mt-5 inline-flex h-10 items-center gap-2 rounded-full px-3 text-sm font-semibold text-indigo-primary transition-colors hover:bg-[var(--surface-accent-soft)]">Open portfolio details <ArrowRight className="size-4" /></Link>
        </Panel>
      </div>
      {(booksError || policyError) && <div role="alert" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-400/25 bg-rose-400/[0.06] px-4 py-3 text-sm text-rose-200"><span className="inline-flex items-center gap-2"><CircleAlert className="size-4 shrink-0" />Some portfolio data is unavailable. Saved values are shown where possible.</span><button type="button" onClick={() => void Promise.all([refresh(), refreshPolicy()])} className="inline-flex h-9 items-center gap-2 rounded-full border border-rose-300/25 px-3 font-semibold hover:bg-rose-300/10"><RefreshCw className="size-3.5" /> Retry</button></div>}

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Panel>
          <PanelHeading title="Recent decisions" detail="Investment and trading timeline" action={<BookOpen className="size-4 text-[var(--text-muted)]" />} />
          {recentEvents.length ? recentEvents.map((event) => <div key={event.id} className="border-t border-[var(--theme-border)] py-3 first:border-0"><div className="flex justify-between gap-3"><p className="text-sm font-semibold">{event.symbol} · Classified as {bookLabel(event.new_book_type)}</p><Status tone={event.new_book_type === "investment" ? "positive" : event.new_book_type === "trading" ? "neutral" : "warning"}>{bookLabel(event.new_book_type)}</Status></div><p className="mt-1 text-xs text-[var(--text-muted)]">Changed from {bookLabel(event.previous_book_type)} · {formatRelativeTime(event.created_at)}</p></div>) : <p className="py-6 text-sm text-[var(--text-muted)]">No portfolio classification decisions have been recorded yet.</p>}
          <SecondaryLink href="/journal">Open journal</SecondaryLink>
        </Panel>
        <Panel>
          <PanelHeading title="Next portfolio step" detail="Based on current saved data" action={<MessageSquareText className="size-4 text-[var(--text-muted)]" />} />
          <p className="text-sm font-semibold">{nextStep.title}</p><p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{nextStep.detail}</p>
          <div className="mt-5"><PrimaryLink href={nextStep.href}>{nextStep.action}</PrimaryLink></div>
        </Panel>
      </div>
    </WorkspacePage>
  );
}

type HomeAttention = { key: string; href: string; title: string; detail: string; tone: "warning" | "danger" };

function estimatedValue(holdings: Holding[], quotes: Map<string, MarketQuote>) {
  return holdings.reduce((sum, holding) => sum + holding.quantity * (quotes.get(holding.symbol.toUpperCase())?.price ?? holding.average_cost), 0);
}

function buildAttentionAlerts(policyAlerts: InvestmentPolicyAlert[], unresolved: Holding[]): HomeAttention[] {
  const alerts = policyAlerts.map((alert): HomeAttention => ({
    key: `policy-${alert.code}-${alert.symbol ?? "portfolio"}`,
    href: alert.code === "unclassified_position" ? "/invest" : "/invest/policy",
    title: alert.message,
    detail: policyAlertDetail(alert),
    tone: alert.severity === "breach" ? "danger" : "warning",
  }));
  const symbolsWithAlerts = new Set(policyAlerts.filter((alert) => alert.code === "unclassified_position").map((alert) => alert.symbol));
  unresolved.forEach((holding) => {
    if (symbolsWithAlerts.has(holding.symbol)) return;
    alerts.push({ key: `unclassified-${holding.id}`, href: "/invest", title: `${holding.symbol} is ready to classify`, detail: "Assign a portfolio purpose before creating an investment thesis.", tone: "warning" });
  });
  return alerts;
}

function policyAlertDetail(alert: InvestmentPolicyAlert) {
  if (alert.observed != null && alert.limit != null) return `${alert.observed.toFixed(1)}% observed · ${alert.limit.toFixed(1)}% limit`;
  return alert.severity === "breach" ? "This policy check is blocking." : "Review the saved policy evidence.";
}

function portfolioRiskLabel({ booksError, booksLoading, policyError, policyLoading, policyConfigured, alerts, compliant }: { booksError: string | null; booksLoading: boolean; policyError: string | null; policyLoading: boolean; policyConfigured: boolean; alerts: HomeAttention[]; compliant?: boolean }) {
  if ((booksError || policyError) && !policyConfigured) return { value: "Unavailable", detail: "Policy data could not be loaded", tone: "neutral" as const };
  if (booksLoading || policyLoading) return { value: "Loading", detail: "Checking saved policy", tone: "neutral" as const };
  if (alerts.length) return { value: "Review", detail: `${alerts.length} recorded alert${alerts.length === 1 ? "" : "s"}`, tone: alerts.some((alert) => alert.tone === "danger") ? "warning" as const : "warning" as const };
  if (!policyConfigured) return { value: "Not configured", detail: "Add an investment policy", tone: "neutral" as const };
  return { value: compliant ? "Within policy" : "Review", detail: compliant ? "No current policy breaches" : "Policy review required", tone: compliant ? "positive" as const : "warning" as const };
}

function portfolioBrief({ booksLoading, booksError, summary, investmentCount, tradingCount }: { booksLoading: boolean; booksError: string | null; summary: ReturnType<typeof usePortfolioBooks>["summary"]; investmentCount: number; tradingCount: number }) {
  if (booksLoading) return "Loading your recorded portfolio books and policy checks.";
  if (booksError && !summary) return "Portfolio data could not be loaded. Retry when the backend is available; no sample holdings or returns are being substituted.";
  if (!summary) return "No portfolio is connected yet. Add holdings to build a command-center summary.";
  const unclassified = summary.risk.unclassified_count;
  return `${investmentCount} Investment position${investmentCount === 1 ? "" : "s"}, ${tradingCount} Trading position${tradingCount === 1 ? "" : "s"}, and ${unclassified} unclassified position${unclassified === 1 ? "" : "s"} are recorded. The largest position represents ${summary.risk.largest_position_weight.toFixed(1)}% of recorded cost basis.`;
}

function buildNextStep(unresolved: Holding[], alerts: HomeAttention[], holdings: Holding[], portfolioName?: string) {
  if (unresolved[0]) return { title: `Classify ${unresolved[0].symbol}`, detail: "This saved position does not yet belong to the Investment or Trading book.", href: "/invest", action: "Review position" };
  if (alerts[0]) return { title: alerts[0].title, detail: alerts[0].detail, href: alerts[0].href, action: "Review policy" };
  if (holdings.length) return { title: `Review ${portfolioName ?? "your portfolio"}`, detail: `${holdings.length} position${holdings.length === 1 ? " is" : "s are"} recorded with no current classification issue.`, href: "/portfolio", action: "Open portfolio" };
  return { title: "Add your first holding", detail: "Connect or create a portfolio to replace the empty command center with your own positions.", href: "/portfolio/holdings", action: "Add holding" };
}

function HomeContextBar({ portfolioName, currency, positionCount, quoteCoverage, loading, refreshing, error, refreshedAt }: { portfolioName?: string; currency: string; positionCount: number; quoteCoverage: number; loading: boolean; refreshing: boolean; error: boolean; refreshedAt: string | null }) {
  return <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-[var(--theme-border)] py-3 text-xs text-[var(--text-muted)]"><span className="inline-flex items-center gap-2 font-semibold text-[var(--text-primary)]"><WalletCards className="size-4" /> {portfolioName ?? "No portfolio"}</span><span>{loading ? "Loading positions" : `${positionCount} position${positionCount === 1 ? "" : "s"}`}</span><span>{currency} books</span><RefreshingIndicator refreshing={refreshing} /><span className="ml-auto inline-flex items-center gap-1.5"><Database className="size-3.5" /> {error ? "Portfolio unavailable" : quoteCoverage ? `${quoteCoverage} live quote${quoteCoverage === 1 ? "" : "s"}` : "Recorded position data"}{refreshedAt ? ` · ${formatRelativeTime(refreshedAt)}` : ""}</span></div>;
}

function formatSignedMoney(value: number, currency: string) {
  const formatted = formatMoney(Math.abs(value), currency);
  return `${value > 0 ? "+" : value < 0 ? "-" : ""}${formatted}`;
}

function formatSignedPercent(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatRelativeTime(value: string) {
  const elapsed = Date.now() - Date.parse(value);
  if (!Number.isFinite(elapsed) || elapsed < 60_000) return "updated just now";
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 60) return `updated ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `updated ${hours}h ago`;
  return `updated ${Math.floor(hours / 24)}d ago`;
}

function bookLabel(book: PositionBook) {
  return book.charAt(0).toUpperCase() + book.slice(1);
}

function formatMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  }
}

function WorkspaceSummary({ href, icon: Icon, title, value, result, detail, accent }: { href: string; icon: typeof BriefcaseBusiness; title: string; value: string; result: string; detail: string; accent: "emerald" | "sky" }) {
  return <Link href={href} className="group rounded-2xl border border-[var(--theme-border)] bg-[var(--surface-card)] p-6 transition-colors hover:bg-[var(--surface-card-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/40"><div className="flex items-center justify-between"><span className={accent === "emerald" ? "inline-flex size-10 items-center justify-center rounded-full bg-emerald-400/10 text-emerald-400" : "inline-flex size-10 items-center justify-center rounded-full bg-sky-400/10 text-sky-300"}><Icon className="size-5" /></span><ArrowRight className="size-4 text-[var(--text-subtle)] transition-transform group-hover:translate-x-1" /></div><p className="mt-7 text-sm font-semibold">{title}</p><div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1"><span className="font-heading text-3xl font-semibold tabular-nums">{value}</span><span className={accent === "emerald" ? "text-sm text-emerald-400" : "text-sm text-sky-300"}>{result}</span></div><p className="mt-3 text-xs text-[var(--text-muted)]">{detail}</p></Link>;
}

function Attention({ href, title, detail, tone }: { href: string; title: string; detail: string; tone: "warning" | "danger" }) {
  return <Link href={href} className="flex items-center justify-between gap-4 rounded-lg px-2 py-4 transition-colors hover:bg-[var(--surface-card-hover)] hover:text-[var(--text-primary)]"><div><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs text-[var(--text-muted)]">{detail}</p></div><Status tone={tone}>{tone === "danger" ? "Resolve" : "Review"}</Status></Link>;
}
