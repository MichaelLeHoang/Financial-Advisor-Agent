"use client";

import { useMemo, useState } from "react";
import { BookOpenCheck, Filter, ListChecks, NotebookPen, Repeat2 } from "lucide-react";
import { useInvestmentWorkspace } from "@/components/investment-workspace/InvestmentWorkspaceProvider";
import { buildInvestmentActivity, type InvestmentActivityItem } from "@/lib/investment-activity";
import { cn } from "@/lib/utils";

type ActivityFilter = "all" | InvestmentActivityItem["kind"];
const FILTERS: Array<{ id: ActivityFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "purchase", label: "Purchases" },
  { id: "decision", label: "Decisions" },
  { id: "thesis", label: "Theses" },
  { id: "classification", label: "Classifications" },
];

export default function InvestmentActivityPage() {
  const { decisions, theses, events, recurringBuys } = useInvestmentWorkspace();
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const activity = useMemo(() => buildInvestmentActivity(decisions, theses, events, recurringBuys), [decisions, events, recurringBuys, theses]);
  const visible = filter === "all" ? activity : activity.filter((item) => item.kind === filter);

  return (
    <div className="min-h-full bg-[var(--theme-bg)] px-4 py-4 text-[var(--text-primary)] lg:px-6 xl:px-8">
      <div className="mx-auto max-w-[1840px]">
        <header>
          <h1 className="font-heading text-2xl font-semibold">Investment Activity</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Purchases, position classifications, thesis changes, and recorded decisions.</p>
        </header>

        <div className="mt-5 flex gap-2 overflow-x-auto border-b border-[var(--theme-border)] pb-3" role="group" aria-label="Activity filters">
          <Filter className="mr-1 mt-2 size-4 shrink-0 text-[var(--text-muted)]" />
          {FILTERS.map((item) => <button key={item.id} type="button" aria-pressed={filter === item.id} onClick={() => setFilter(item.id)} className={cn("h-8 shrink-0 rounded-full px-3 text-xs font-semibold", filter === item.id ? "bg-[var(--surface-control-active)] text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:bg-[var(--surface-card-hover)] hover:text-[var(--text-primary)]")}>{item.label}</button>)}
        </div>

        <section aria-label="Investment activity list" className="mt-2">
          {visible.map((item) => <div key={item.id} className="grid gap-3 border-b border-[var(--theme-border)] py-3.5 sm:grid-cols-[40px_110px_80px_minmax(0,1fr)_auto] sm:items-center">
            <span className="inline-flex size-9 items-center justify-center rounded-md bg-[var(--surface-control)] text-[var(--text-muted)]">{activityIcon(item.kind)}</span>
            <time className="text-sm text-[var(--text-muted)]">{formatDate(item.at)}</time>
            <span className="font-semibold">{item.symbol}</span>
            <span className="text-sm">{item.label}</span>
            <span className="text-xs text-[var(--text-muted)]">{item.detail}</span>
          </div>)}
          {!visible.length && <div className="py-20 text-center"><ListChecks className="mx-auto size-7 text-[var(--text-muted)]" /><h2 className="mt-4 font-semibold">No matching activity</h2><p className="mt-2 text-sm text-[var(--text-muted)]">Recorded Investment events will appear here.</p></div>}
        </section>
      </div>
    </div>
  );
}

function activityIcon(kind: InvestmentActivityItem["kind"]) {
  if (kind === "purchase") return <Repeat2 className="size-4" />;
  if (kind === "decision") return <BookOpenCheck className="size-4" />;
  if (kind === "thesis") return <NotebookPen className="size-4" />;
  return <ListChecks className="size-4" />;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}
