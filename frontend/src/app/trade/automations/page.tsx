"use client";

import { Workflow } from "lucide-react";
import { WorkspaceDestination } from "@/components/workspace/WorkspaceDestination";
export default function TradeAutomationsPage() { return <WorkspaceDestination eyebrow="Trading workspace" title="Automations" description="Paper automations will run approved strategy versions through deterministic schedules and risk controls." icon={Workflow} requiredPlan="trader" emptyDescription="No paper automations have been configured." />; }
