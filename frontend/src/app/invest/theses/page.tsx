"use client";

import Link from "next/link";
import { FileText } from "lucide-react";
import { useWorkspacePrototype } from "@/components/workspace/WorkspacePrototypeProvider";
import { Panel, PanelHeading, Status, WorkspacePage } from "@/components/workspace/WorkspaceUI";

export default function InvestmentThesesPage() {
  const { state } = useWorkspacePrototype();
  return <WorkspacePage eyebrow="Investment workspace" title="Theses" description="Review the ownership case, evidence state, and next checkpoint for each investment position."><Panel><PanelHeading title="Position theses" detail="Illustrative workspace records" /><div className="divide-y divide-[var(--theme-border)]"><Link href="/invest/positions/nvda" className="grid gap-3 py-4 sm:grid-cols-[100px_1fr_auto]"><strong>NVDA</strong><span className="text-sm text-[var(--text-muted)]">{state.thesis || "Ownership thesis has not been recorded."}</span><Status tone={state.thesisStatus === "healthy" ? "positive" : "warning"}>{state.thesisStatus}</Status></Link><div className="grid gap-3 py-4 sm:grid-cols-[100px_1fr_auto]"><strong>MSFT</strong><span className="text-sm text-[var(--text-muted)]">Durable cloud economics and recurring enterprise distribution support long-horizon ownership.</span><Status tone="positive">healthy</Status></div></div></Panel></WorkspacePage>;
}

