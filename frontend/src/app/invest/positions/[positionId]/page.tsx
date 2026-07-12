"use client";

import { useParams } from "next/navigation";
import { FileText, Scale } from "lucide-react";
import { Metric, Panel, PanelHeading, SecondaryLink, Status, WorkspacePage } from "@/components/workspace/WorkspaceUI";
import { useWorkspacePrototype } from "@/components/workspace/WorkspacePrototypeProvider";

export default function InvestmentPositionPage() {
  const params = useParams<{ positionId: string }>();
  const { state } = useWorkspacePrototype();
  return <WorkspacePage eyebrow="Investment position" title={params.positionId.toUpperCase()} description="Ownership purpose, thesis evidence, risk, and decision history remain attached to the position." actions={<SecondaryLink href="/invest">Back to Invest</SecondaryLink>}><div className="grid gap-4 md:grid-cols-4"><Metric label="Portfolio weight" value="12.8%" /><Metric label="Policy maximum" value={state.maximumPositionWeight ? `${state.maximumPositionWeight}%` : "Not set"} tone={state.maximumPositionWeight && state.maximumPositionWeight < 12.8 ? "warning" : "neutral"} /><Metric label="Thesis status" value={state.thesisStatus === "healthy" ? "Healthy" : "Missing"} /><Metric label="Next review" value="Jul 24" /></div><div className="mt-7 grid gap-5 lg:grid-cols-2"><Panel><PanelHeading title="Investment thesis" action={<FileText className="size-4 text-emerald-400" />} /><p className="text-sm leading-6 text-[var(--text-secondary)]">{state.thesis || "No ownership thesis has been recorded. Return to Invest to complete the guided review."}</p></Panel><Panel><PanelHeading title="Policy and risk" action={<Scale className="size-4 text-amber-300" />} /><div className="space-y-3 text-sm"><div className="flex justify-between"><span className="text-[var(--text-muted)]">Purpose</span><Status tone={state.positionBook === "investment" ? "positive" : "warning"}>{state.positionBook}</Status></div><div className="flex justify-between"><span className="text-[var(--text-muted)]">Concentration</span><span>Elevated</span></div><div className="flex justify-between"><span className="text-[var(--text-muted)]">Upcoming catalyst</span><span>Earnings · Aug 20</span></div></div></Panel></div></WorkspacePage>;
}
