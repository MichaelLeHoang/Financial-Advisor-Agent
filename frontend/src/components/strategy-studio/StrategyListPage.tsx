"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, FlaskConical, History, Layers3, Plus, ShieldCheck } from "lucide-react";
import { LockedFeature } from "@/components/LockedFeature";
import { useAuth } from "@/components/auth/AuthProvider";
import { useStrategyStudio } from "@/components/strategy-studio/StrategyStudioProvider";
import type { StrategyMode } from "@/components/strategy-studio/types";
import { Panel, Status, WorkspacePage } from "@/components/workspace/WorkspaceUI";

const PLAN_RANK = { free: 0, pro: 1, trader: 2, quant: 3, execution_addon: 4 } as const;

export default function StrategyListPage({ mode }: { mode: StrategyMode }) {
  const router = useRouter();
  const { user } = useAuth();
  const { state, createStrategy } = useStrategyStudio();
  const drafts = state.drafts.filter((draft) => draft.mode === mode);
  const basePath = mode === "investment" ? "/invest/strategies" : "/trade/strategies";
  const investment = mode === "investment";

  if (PLAN_RANK[user.plan] < PLAN_RANK.trader) {
    return <LockedFeature title="Strategy Studio is available on Trader" description="Build inspectable rules, validate assumptions, and connect supported definitions to deterministic backtests." requiredPlan="trader" benefits={["Structured strategy drafts", "Version review", "Reproducible backtest handoff"]} />;
  }

  const start = () => {
    const draft = createStrategy(mode);
    router.push(`${basePath}/${draft.id}`);
  };

  return (
    <WorkspacePage
      eyebrow={`${investment ? "Investment" : "Trading"} workspace`}
      title={`${investment ? "Investment" : "Trading"} Strategies`}
      description={investment ? "Define allocation and review rules with explicit evidence, risk limits, and schedules." : "Turn a trading idea into inspectable entry, exit, sizing, and risk rules before testing it."}
      actions={<>
        {!investment && <Link href="/trade/strategies/backtest" className="inline-flex h-10 items-center gap-2 border border-[var(--theme-border-strong)] px-4 text-sm font-semibold"><FlaskConical className="size-4" /> Backtest Lab</Link>}
        <button type="button" onClick={start} className="inline-flex h-10 items-center gap-2 bg-white px-4 text-sm font-semibold text-black"><Plus className="size-4" /> New strategy</button>
      </>}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        {drafts.map((draft) => (
          <Link key={draft.id} href={`${basePath}/${draft.id}`} className="group border border-[var(--theme-border)] bg-[var(--surface-card)] p-5 transition-colors hover:bg-[var(--surface-card-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/45">
            <div className="flex items-start justify-between gap-4">
              <span className={`flex size-10 items-center justify-center border ${investment ? "border-emerald-400/25 bg-emerald-400/8 text-emerald-400" : "border-sky-300/25 bg-sky-300/8 text-sky-300"}`}><Layers3 className="size-5" /></span>
              <Status tone={draft.status === "paper" ? "positive" : "neutral"}>{draft.status === "paper" ? "Paper active" : "Draft"}</Status>
            </div>
            <h2 className="mt-6 text-lg font-semibold">{draft.name}</h2>
            <p className="mt-2 text-sm text-[var(--text-muted)]">{draft.nodes.length} top-level rules · {draft.symbols.join(", ")}</p>
            <div className="mt-6 flex items-center gap-4 border-t border-[var(--theme-border)] pt-4 text-xs text-[var(--text-muted)]">
              <span className="inline-flex items-center gap-1.5"><History className="size-3.5" /> {draft.versions.length} versions</span>
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="size-3.5" /> Deterministic checks</span>
              <ArrowRight className="ml-auto size-4 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>
        ))}
      </div>
      {drafts.length === 0 && <Panel className="text-center"><Layers3 className="mx-auto size-5 text-[var(--text-subtle)]" /><h2 className="mt-4 text-base font-semibold">No {mode} strategies</h2><button type="button" onClick={start} className="mt-5 h-10 bg-white px-4 text-sm font-semibold text-black">Create strategy</button></Panel>}
    </WorkspacePage>
  );
}
