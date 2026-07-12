"use client";
import { CandlestickChart } from "lucide-react";
import { WorkspaceDestination } from "@/components/workspace/WorkspaceDestination";
import { useWorkspacePrototype } from "@/components/workspace/WorkspacePrototypeProvider";
import { Panel, Status } from "@/components/workspace/WorkspaceUI";
export default function TradePositionsPage() { const { state } = useWorkspacePrototype(); return <WorkspaceDestination eyebrow="Trading workspace" title="Positions" description="Monitor open paper positions against their original plan and portfolio-risk budget." icon={CandlestickChart} emptyDescription="No paper positions are open.">{state.paperOrderStatus === "filled" ? <Panel><div className="grid gap-4 sm:grid-cols-[100px_1fr_1fr_auto]"><strong>AMD</strong><span className="text-sm text-[var(--text-muted)]">100 shares · illustrative $170.00 entry</span><span className="text-sm text-[var(--text-muted)]">Planned max loss $600</span><Status tone="positive">paper open</Status></div></Panel> : undefined}</WorkspaceDestination>; }

