"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, CircleAlert, FileText, Scale, ShieldCheck } from "lucide-react";
import { Metric, Panel, PanelHeading, PrimaryLink, SecondaryLink, Status, WorkspacePage } from "@/components/workspace/WorkspaceUI";
import { useWorkspacePrototype, type DecisionAction } from "@/components/workspace/WorkspacePrototypeProvider";

export default function InvestPage() {
  const { state, classifyPosition, saveThesis, setMaximumPositionWeight, recordInvestmentDecision } = useWorkspacePrototype();
  const [thesis, setThesis] = useState(state.thesis || "NVDA's accelerated computing platform can compound earnings as AI infrastructure demand expands, supported by software-led switching costs.");
  const [limit, setLimit] = useState(String(state.maximumPositionWeight ?? 10));
  const [pendingDecision, setPendingDecision] = useState<DecisionAction | null>(null);
  const violation = state.maximumPositionWeight !== null && 12.8 > state.maximumPositionWeight;

  return (
    <WorkspacePage eyebrow="Investment workspace" title="Build conviction, then manage concentration" description="Keep ownership purpose, thesis evidence, portfolio policy, and each capital-allocation decision in one review path." actions={<><SecondaryLink href="/invest/research">Open research</SecondaryLink><PrimaryLink href="/invest/policy">Investment policy</PrimaryLink></>}>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Investment Book" value="$94,300" detail="75.5% of total portfolio" />
        <Metric label="Year to date" value="+12.4%" detail="Benchmark +9.1%" tone="positive" />
        <Metric label="Concentration" value="Elevated" detail="NVDA is 12.8%" tone="warning" />
        <Metric label="Thesis health" value={state.thesisStatus === "healthy" ? "6 healthy" : "5 healthy"} detail={state.thesisStatus === "healthy" ? "1 review upcoming" : "1 thesis missing"} />
      </div>

      <div className="mt-8 grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
        <Panel>
          <PanelHeading title="Holdings" detail="Purpose and policy are visible beside performance" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-[var(--theme-border)] text-xs text-[var(--text-muted)]"><tr><th className="pb-3 font-medium">Symbol</th><th className="pb-3 font-medium">Value</th><th className="pb-3 font-medium">Weight</th><th className="pb-3 font-medium">Purpose</th><th className="pb-3 font-medium">Thesis</th><th className="pb-3 font-medium">Action</th></tr></thead>
              <tbody>
                <tr className="border-b border-[var(--theme-border)]"><td className="py-4 font-semibold">NVDA<div className="text-xs font-normal text-[var(--text-muted)]">NVIDIA Corp.</div></td><td>$15,978</td><td>12.8%</td><td><Status tone={state.positionBook === "investment" ? "positive" : "warning"}>{state.positionBook}</Status></td><td>{state.thesisStatus === "healthy" ? <Status tone="positive">Healthy</Status> : <Status tone="warning">Missing</Status>}</td><td><Link href="/invest/positions/nvda" className="inline-flex items-center gap-1 font-semibold text-emerald-400">Review <ArrowRight className="size-3.5" /></Link></td></tr>
                <tr><td className="py-4 font-semibold">MSFT<div className="text-xs font-normal text-[var(--text-muted)]">Microsoft Corp.</div></td><td>$14,480</td><td>11.6%</td><td><Status tone="positive">investment</Status></td><td><Status tone="positive">Healthy</Status></td><td><span className="text-[var(--text-subtle)]">Reviewed</span></td></tr>
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel>
          <PanelHeading title="Guided NVDA review" detail="Complete each control before recording a decision" />
          <ol className="space-y-5">
            <Step number="1" title="Classify the holding" complete={state.positionBook === "investment"}>
              <p className="mb-3 text-xs text-[var(--text-muted)]">Unclassified positions cannot use purpose-specific policy.</p>
              <button type="button" onClick={() => classifyPosition("investment")} className="h-9 border border-[var(--theme-border-strong)] px-3 text-xs font-semibold hover:bg-[var(--surface-card-hover)]">Classify as Investment</button>
            </Step>
            <Step number="2" title="Create the ownership thesis" complete={state.thesisStatus === "healthy"}>
              <textarea value={thesis} onChange={(event) => setThesis(event.target.value)} rows={4} disabled={state.positionBook !== "investment"} className="w-full resize-none border border-[var(--theme-border-strong)] bg-[var(--surface-control)] p-3 text-sm outline-none focus:ring-2 focus:ring-emerald-400/40 disabled:opacity-45" />
              <button type="button" disabled={state.positionBook !== "investment" || !thesis.trim()} onClick={() => saveThesis(thesis)} className="mt-2 h-9 bg-emerald-400 px-3 text-xs font-semibold text-black disabled:opacity-40">Save thesis</button>
            </Step>
            <Step number="3" title="Set maximum position weight" complete={state.maximumPositionWeight !== null}>
              <div className="flex items-center gap-2"><input aria-label="Maximum position weight" type="number" min="1" max="25" value={limit} onChange={(event) => setLimit(event.target.value)} disabled={state.thesisStatus !== "healthy"} className="h-9 w-24 border border-[var(--theme-border-strong)] bg-[var(--surface-control)] px-3 text-sm outline-none" /><span className="text-sm text-[var(--text-muted)]">%</span><button type="button" disabled={state.thesisStatus !== "healthy"} onClick={() => setMaximumPositionWeight(Math.max(1, Math.min(25, Number(limit))))} className="h-9 border border-[var(--theme-border-strong)] px-3 text-xs font-semibold disabled:opacity-40">Apply policy</button></div>
            </Step>
          </ol>
        </Panel>
      </div>

      <Panel className="mt-5">
        <PanelHeading title="Decision review" detail="The action remains reversible until confirmation" action={violation ? <Status tone="warning">Policy violation</Status> : <ShieldCheck className="size-5 text-emerald-400" />} />
        {state.maximumPositionWeight === null ? <p className="text-sm text-[var(--text-muted)]">Set a position limit to evaluate NVDA against policy.</p> : <div className="grid gap-5 lg:grid-cols-[1fr_auto]"><div className="flex gap-3"><CircleAlert className={violation ? "mt-0.5 size-5 text-amber-300" : "mt-0.5 size-5 text-emerald-400"} /><div><p className="text-sm font-semibold">{violation ? `NVDA exceeds the ${state.maximumPositionWeight}% maximum by ${(12.8 - state.maximumPositionWeight).toFixed(1)} points.` : "NVDA is within the current position limit."}</p><p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">The long-term thesis remains healthy. Policy suggests trimming concentration; holding requires an explicit exception review.</p></div></div><div className="flex gap-2"><button type="button" onClick={() => setPendingDecision("hold")} className="h-10 border border-[var(--theme-border-strong)] px-4 text-sm font-semibold">Hold</button><button type="button" onClick={() => setPendingDecision("trim")} className="h-10 bg-emerald-400 px-4 text-sm font-semibold text-black">Trim</button></div></div>}
        {pendingDecision && <div role="dialog" aria-label="Confirm investment decision" className="mt-5 border-t border-[var(--theme-border)] pt-5"><p className="text-sm font-semibold">Confirm {pendingDecision} decision</p><p className="mt-1 text-xs text-[var(--text-muted)]">This prototype records the rationale in the Decision Journal. It does not place an order.</p><div className="mt-3 flex gap-2"><button type="button" onClick={() => setPendingDecision(null)} className="h-9 border border-[var(--theme-border-strong)] px-3 text-xs font-semibold">Cancel</button><button type="button" onClick={() => { recordInvestmentDecision(pendingDecision); setPendingDecision(null); }} className="h-9 bg-white px-3 text-xs font-semibold text-black">Record decision</button></div></div>}
      </Panel>
    </WorkspacePage>
  );
}

function Step({ number, title, complete, children }: { number: string; title: string; complete: boolean; children: React.ReactNode }) {
  return <li className="grid grid-cols-[28px_1fr] gap-3"><span className={complete ? "flex size-7 items-center justify-center bg-emerald-400 text-black" : "flex size-7 items-center justify-center border border-[var(--theme-border-strong)] text-xs text-[var(--text-muted)]"}>{complete ? <Check className="size-4" /> : number}</span><div><h3 className="mb-2 text-sm font-semibold">{title}</h3>{children}</div></li>;
}
