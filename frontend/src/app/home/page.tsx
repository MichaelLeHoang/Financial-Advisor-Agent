"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, BriefcaseBusiness, LineChart, MessageSquareText, ShieldAlert } from "lucide-react";
import { Metric, Panel, PanelHeading, PrimaryLink, SecondaryLink, Status, WorkspacePage } from "@/components/workspace/WorkspaceUI";
import { useWorkspacePrototype } from "@/components/workspace/WorkspacePrototypeProvider";
import { usePortfolioBooks } from "@/components/portfolio/PortfolioBooksProvider";
import { useInvestmentPolicy } from "@/components/investment-policy/InvestmentPolicyProvider";

export default function HomePage() {
  const { state } = useWorkspacePrototype();
  const { holdings, summary, loading: booksLoading, error: booksError, refreshedAt } = usePortfolioBooks();
  const { policy, validation } = useInvestmentPolicy();
  const investment = summary?.books.find((book) => book.book_type === "investment");
  const trading = summary?.books.find((book) => book.book_type === "trading");
  const unresolved = holdings.find((holding) => holding.book_type === "unclassified");
  const largestWeight = summary?.risk.largest_position_weight ?? 0;
  const positionLimit = policy?.max_position_weight ?? state.maximumPositionWeight;
  const policyIssue = positionLimit !== null && largestWeight > positionLimit;
  const currency = summary?.base_currency ?? "USD";

  return (
    <WorkspacePage eyebrow="Command center" title="Good morning" description="One view of your long-term capital, active risk, and the decisions that need attention today." actions={<><SecondaryLink href="/ai">Ask AI Desk</SecondaryLink><PrimaryLink href="/portfolio">Review portfolio</PrimaryLink></>}>
      <div className="grid gap-4 md:grid-cols-4">
        <Metric label="Total portfolio" value={booksLoading ? "Loading" : formatMoney(summary?.total_cost_basis ?? 0, currency)} detail="Recorded cost basis across all books" />
        <Metric label="Today" value="+$842" detail="+0.68%" tone="positive" />
        <Metric label="Available cash" value="$14,520" detail="11.6% of portfolio" />
        <Metric label="Total portfolio risk" value={summary?.risk.unclassified_count ? "Review" : "Moderate"} detail={summary?.risk.unclassified_count ? `${summary.risk.unclassified_count} position${summary.risk.unclassified_count === 1 ? "" : "s"} need a book` : "All positions classified"} tone={summary?.risk.unclassified_count ? "warning" : "neutral"} />
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <WorkspaceSummary href="/invest" icon={BriefcaseBusiness} title="Investment Book" value={formatMoney(investment?.cost_basis ?? 0, currency)} result={`${(investment?.portfolio_weight ?? 0).toFixed(1)}% allocated`} detail={`${investment?.holding_count ?? 0} classified holdings`} accent="emerald" />
        <WorkspaceSummary href="/trade" icon={LineChart} title="Trading Book" value={formatMoney(trading?.cost_basis ?? 0, currency)} result={`${(trading?.portfolio_weight ?? 0).toFixed(1)}% allocated`} detail={`${trading?.holding_count ?? 0} active book positions`} accent="sky" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
        <Panel>
          <PanelHeading title="Requires attention" detail="Material changes only" action={<ShieldAlert className="size-4 text-amber-300" />} />
          <div className="divide-y divide-[var(--theme-border)]">
            {(policyIssue || unresolved) && <Attention href="/invest" title={policyIssue ? "Largest position exceeds its policy" : `${unresolved?.symbol ?? "Position"} is ready to classify`} detail={policyIssue ? `${largestWeight.toFixed(1)}% current weight versus ${positionLimit}% maximum` : "Assign a portfolio purpose before creating a thesis"} tone="warning" />}
            {validation?.alerts.find((alert) => alert.code === "minimum_cash_weight") && <Attention href="/invest/policy" title="Cash is below the investment policy minimum" detail="Review the deterministic policy evidence before allocating more capital" tone="warning" />}
            <Attention href="/trade" title="AMD is approaching its planned stop" detail="Review the plan before the next session" tone="neutral" />
            <Attention href="/trade/strategies" title="Momentum strategy generated a paper signal" detail="No order has been submitted" tone="neutral" />
          </div>
        </Panel>
        <Panel>
          <PanelHeading title="Daily brief" detail="Saturday, July 11" />
          <p className="text-sm leading-6 text-[var(--text-secondary)]">Semiconductors remain constructive but crowded. Portfolio concentration is the main constraint; active trade risk remains inside the paper policy.</p>
          <Link href="/discover/markets" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-sky-300">Open market context <ArrowRight className="size-4" /></Link>
        </Panel>
      </div>
      {(booksError || refreshedAt) && <p role={booksError ? "alert" : undefined} className={`mt-4 text-xs ${booksError ? "text-rose-300" : "text-[var(--text-subtle)]"}`}>{booksError ?? `Portfolio data refreshed ${new Date(refreshedAt as string).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}</p>}

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Panel>
          <PanelHeading title="Recent decisions" detail="Investment and trading timeline" action={<BookOpen className="size-4 text-[var(--text-muted)]" />} />
          {state.journal.length ? state.journal.slice(0, 3).map((event) => <div key={event.id} className="border-t border-[var(--theme-border)] py-3 first:border-0"><div className="flex justify-between gap-3"><p className="text-sm font-semibold">{event.symbol} · {event.title}</p><Status tone={event.workspace === "investment" ? "positive" : "neutral"}>{event.workspace}</Status></div><p className="mt-1 text-xs text-[var(--text-muted)]">{event.detail}</p></div>) : <p className="py-6 text-sm text-[var(--text-muted)]">Decisions from Invest and Trade will appear here.</p>}
          <SecondaryLink href="/journal">Open journal</SecondaryLink>
        </Panel>
        <Panel>
          <PanelHeading title="Continue where you left off" detail="Your active paper workflow" action={<MessageSquareText className="size-4 text-[var(--text-muted)]" />} />
          <p className="text-sm font-semibold">Build an AMD trade plan</p><p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">Entry, stop, target, and risk stay together through review and simulated fill.</p>
          <div className="mt-5"><PrimaryLink href="/trade">Continue in Trade</PrimaryLink></div>
        </Panel>
      </div>
    </WorkspacePage>
  );
}

function formatMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  }
}

function WorkspaceSummary({ href, icon: Icon, title, value, result, detail, accent }: { href: string; icon: typeof BriefcaseBusiness; title: string; value: string; result: string; detail: string; accent: "emerald" | "sky" }) {
  return <Link href={href} className="group border border-[var(--theme-border)] bg-[var(--surface-card)] p-6 transition-colors hover:bg-[var(--surface-card-hover)]"><div className="flex items-center justify-between"><Icon className={accent === "emerald" ? "size-5 text-emerald-400" : "size-5 text-sky-300"} /><ArrowRight className="size-4 text-[var(--text-subtle)] transition-transform group-hover:translate-x-1" /></div><p className="mt-8 text-sm font-semibold">{title}</p><div className="mt-2 flex items-baseline gap-3"><span className="text-3xl font-semibold">{value}</span><span className={accent === "emerald" ? "text-sm text-emerald-400" : "text-sm text-sky-300"}>{result}</span></div><p className="mt-3 text-xs text-[var(--text-muted)]">{detail}</p></Link>;
}

function Attention({ href, title, detail, tone }: { href: string; title: string; detail: string; tone: "warning" | "neutral" }) {
  return <Link href={href} className="flex items-center justify-between gap-4 py-4 hover:text-white"><div><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs text-[var(--text-muted)]">{detail}</p></div><Status tone={tone}>{tone === "warning" ? "Review" : "Monitor"}</Status></Link>;
}
