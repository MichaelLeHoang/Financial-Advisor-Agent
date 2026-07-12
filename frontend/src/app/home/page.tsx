"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, BriefcaseBusiness, LineChart, MessageSquareText, ShieldAlert } from "lucide-react";
import { Metric, Panel, PanelHeading, PrimaryLink, SecondaryLink, Status, WorkspacePage } from "@/components/workspace/WorkspaceUI";
import { useWorkspacePrototype } from "@/components/workspace/WorkspacePrototypeProvider";

export default function HomePage() {
  const { state } = useWorkspacePrototype();
  const policyIssue = state.maximumPositionWeight !== null && 12.8 > state.maximumPositionWeight;

  return (
    <WorkspacePage eyebrow="Command center" title="Good morning" description="One view of your long-term capital, active risk, and the decisions that need attention today." actions={<><SecondaryLink href="/ai">Ask AI Desk</SecondaryLink><PrimaryLink href="/portfolio">Review portfolio</PrimaryLink></>}>
      <div className="grid gap-4 md:grid-cols-4">
        <Metric label="Total portfolio" value="$124,820" detail="Across both books" />
        <Metric label="Today" value="+$842" detail="+0.68%" tone="positive" />
        <Metric label="Available cash" value="$14,520" detail="11.6% of portfolio" />
        <Metric label="Total portfolio risk" value="Moderate" detail="Within policy" />
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <WorkspaceSummary href="/invest" icon={BriefcaseBusiness} title="Investment Book" value="$94,300" result="+12.4% YTD" detail="7 holdings · 2 theses need review" accent="emerald" />
        <WorkspaceSummary href="/trade" icon={LineChart} title="Trading Book" value="$30,520" result="+2.1% this month" detail="3 open positions · 3.2% portfolio heat" accent="sky" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
        <Panel>
          <PanelHeading title="Requires attention" detail="Material changes only" action={<ShieldAlert className="size-4 text-amber-300" />} />
          <div className="divide-y divide-[var(--theme-border)]">
            <Attention href="/invest" title={policyIssue ? "NVDA exceeds its position policy" : "NVDA is ready to classify"} detail={policyIssue ? `12.8% current weight versus ${state.maximumPositionWeight}% maximum` : "Assign a portfolio purpose before creating a thesis"} tone="warning" />
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

function WorkspaceSummary({ href, icon: Icon, title, value, result, detail, accent }: { href: string; icon: typeof BriefcaseBusiness; title: string; value: string; result: string; detail: string; accent: "emerald" | "sky" }) {
  return <Link href={href} className="group border border-[var(--theme-border)] bg-[var(--surface-card)] p-6 transition-colors hover:bg-[var(--surface-card-hover)]"><div className="flex items-center justify-between"><Icon className={accent === "emerald" ? "size-5 text-emerald-400" : "size-5 text-sky-300"} /><ArrowRight className="size-4 text-[var(--text-subtle)] transition-transform group-hover:translate-x-1" /></div><p className="mt-8 text-sm font-semibold">{title}</p><div className="mt-2 flex items-baseline gap-3"><span className="text-3xl font-semibold">{value}</span><span className={accent === "emerald" ? "text-sm text-emerald-400" : "text-sm text-sky-300"}>{result}</span></div><p className="mt-3 text-xs text-[var(--text-muted)]">{detail}</p></Link>;
}

function Attention({ href, title, detail, tone }: { href: string; title: string; detail: string; tone: "warning" | "neutral" }) {
  return <Link href={href} className="flex items-center justify-between gap-4 py-4 hover:text-white"><div><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs text-[var(--text-muted)]">{detail}</p></div><Status tone={tone}>{tone === "warning" ? "Review" : "Monitor"}</Status></Link>;
}
