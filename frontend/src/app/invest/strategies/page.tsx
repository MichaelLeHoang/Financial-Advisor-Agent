"use client";

import Link from "next/link";
import { Layers3 } from "lucide-react";
import { WorkspaceDestination } from "@/components/workspace/WorkspaceDestination";

export default function InvestmentStrategiesPage() {
  return <WorkspaceDestination eyebrow="Investment workspace" title="Investment Strategies" description="Test long-horizon allocation rules with the existing deterministic strategy engine." icon={Layers3} requiredPlan="trader"><div className="border border-[var(--theme-border)] bg-[var(--surface-card)] p-6"><Layers3 className="size-5 text-emerald-400" /><h2 className="mt-5 text-lg font-semibold">Shared Strategy Studio</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">Investment mode is scheduled for the Strategy Studio milestone. Existing reproducible backtests remain available in the current strategy engine.</p><Link href="/trade/strategies" className="mt-5 inline-flex h-10 items-center bg-white px-4 text-sm font-semibold text-black">Open strategies</Link></div></WorkspaceDestination>;
}
