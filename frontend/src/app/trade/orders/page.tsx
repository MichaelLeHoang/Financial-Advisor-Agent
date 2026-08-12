"use client";
import { ClipboardList } from "lucide-react";
import { WorkspaceDestination } from "@/components/workspace/WorkspaceDestination";
import { useWorkspacePrototype } from "@/components/workspace/WorkspacePrototypeProvider";
import { Panel, Status } from "@/components/workspace/WorkspaceUI";
export default function TradeOrdersPage() { const { state } = useWorkspacePrototype(); return <WorkspaceDestination eyebrow="Trading workspace" title="Orders" description="Review paper-order status separately from live brokerage execution." icon={ClipboardList} emptyDescription="No paper orders have been reviewed in this session.">{state.paperOrderStatus !== "draft" ? <Panel><div className="grid gap-4 sm:grid-cols-[100px_1fr_1fr_auto]"><strong>AMD</strong><span className="text-sm text-[var(--text-muted)]">Buy 100 · market · day</span><span className="text-sm text-[var(--text-muted)]">Illustrative entry $170.00</span><Status tone={state.paperOrderStatus === "filled" ? "positive" : "neutral"}>{state.paperOrderStatus}</Status></div></Panel> : undefined}</WorkspaceDestination>; }

