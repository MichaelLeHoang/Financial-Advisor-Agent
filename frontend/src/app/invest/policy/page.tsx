"use client";

import { useState } from "react";
import { Panel, PanelHeading, SecondaryLink, WorkspacePage } from "@/components/workspace/WorkspaceUI";
import { useWorkspacePrototype } from "@/components/workspace/WorkspacePrototypeProvider";

export default function InvestmentPolicyPage() {
  const { state, setMaximumPositionWeight } = useWorkspacePrototype();
  const [limit, setLimit] = useState(state.maximumPositionWeight ?? 10);
  return <WorkspacePage eyebrow="Investment policy" title="Define the boundaries before the decision" description="These prototype controls generate deterministic alerts and never change positions automatically." actions={<SecondaryLink href="/invest">Back to Invest</SecondaryLink>}><Panel className="max-w-3xl"><PanelHeading title="Position and portfolio limits" detail="Illustrative policy · account scoped" /><label className="block text-sm font-semibold">Maximum single-position weight<div className="mt-2 flex items-center gap-2"><input type="number" min="1" max="25" value={limit} onChange={(event) => setLimit(Number(event.target.value))} className="h-10 w-28 border border-[var(--theme-border-strong)] bg-[var(--surface-control)] px-3 outline-none" /><span className="text-[var(--text-muted)]">%</span></div></label><div className="mt-6 grid gap-4 sm:grid-cols-2"><PolicyField label="Cash requirement" value="8% minimum" /><PolicyField label="Sector maximum" value="35%" /><PolicyField label="Drawdown tolerance" value="18%" /><PolicyField label="Rebalance cadence" value="Quarterly" /></div><button type="button" onClick={() => setMaximumPositionWeight(Math.max(1, Math.min(25, limit)))} className="mt-7 h-10 bg-white px-4 text-sm font-semibold text-black">Save policy</button></Panel></WorkspacePage>;
}

function PolicyField({ label, value }: { label: string; value: string }) { return <div className="border-t border-[var(--theme-border)] pt-3"><p className="text-xs text-[var(--text-muted)]">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div>; }
