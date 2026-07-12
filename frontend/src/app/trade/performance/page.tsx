"use client";

import { ChartNoAxesCombined } from "lucide-react";
import { WorkspaceDestination } from "@/components/workspace/WorkspaceDestination";
export default function TradePerformancePage() { return <WorkspaceDestination eyebrow="Trading workspace" title="Performance" description="Completed paper trades will roll into setup, risk, and execution-quality reviews." icon={ChartNoAxesCombined} requiredPlan="trader" emptyDescription="Close a paper position to create the first performance review." />; }
