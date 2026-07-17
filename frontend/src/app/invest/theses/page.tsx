"use client";

import Link from "next/link";
import { FileText } from "lucide-react";
import { useInvestmentWorkspace } from "@/components/investment-workspace/InvestmentWorkspaceProvider";
import { Panel, PanelHeading, Status, WorkspacePage } from "@/components/workspace/WorkspaceUI";

export default function InvestmentThesesPage() {
  const { investmentHoldings, theses, loading } = useInvestmentWorkspace();
  const byHolding = new Map(theses.map((thesis) => [thesis.holding_id, thesis]));
  return <WorkspacePage dense eyebrow="Investment workspace" title="Theses" description="Review the owner-authored investment case, evidence state, and next checkpoint for each position."><Panel className="p-4"><PanelHeading title="Position theses" detail="Durable Investment records" action={<FileText className="size-4 text-emerald-400" />} /><div className="divide-y divide-[var(--theme-border)]">{investmentHoldings.map(({ holding, portfolio }) => { const thesis = byHolding.get(holding.id); const health = thesisHealth(thesis); return <Link key={holding.id} href={`/invest/positions/${holding.symbol.toLowerCase()}`} className="grid gap-3 py-3 sm:grid-cols-[100px_140px_1fr_auto]"><strong>{holding.symbol}</strong><span className="text-sm text-[var(--text-muted)]">{portfolio.name}</span><span className="line-clamp-2 text-sm text-[var(--text-muted)]">{thesis?.statement || "Ownership thesis has not been recorded."}</span><Status tone={health === "Healthy" ? "positive" : health === "Invalidated" ? "danger" : "warning"}>{health}</Status></Link>; })}{!loading && !investmentHoldings.length && <p className="py-8 text-center text-sm text-[var(--text-muted)]">No Investment holdings are available in this scope.</p>}</div></Panel></WorkspacePage>;
}

function thesisHealth(thesis?: { status: string; next_review_at?: string | null }) { if (!thesis) return "Missing"; if (thesis.status === "invalidated") return "Invalidated"; if (thesis.status === "needs_review" || (thesis.next_review_at && new Date(thesis.next_review_at) < new Date())) return "Needs review"; return "Healthy"; }
