"use client";

import { useEffect, useMemo, useState } from "react";
import type { DynamicToolUIPart } from "ai";
import {
  BarChart3,
  Check,
  ChevronDown,
  ChevronRight,
  CircleDashed,
  FileSearch,
  Newspaper,
  PieChart,
  Search,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ThinkingOrb, type OrbState } from "thinking-orbs";
import { Source, Sources, SourcesContent, SourcesTrigger } from "@/components/ai-elements/sources";
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from "@/components/ai-elements/tool";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  activeActivityStep,
  activityElapsedMs,
  completedActivityCount,
  formatActivityDuration,
  visibleActivitySteps,
  type LiveAgentActivity,
} from "@/lib/agent-activity";
import type { AgentActivityCategory, AgentActivitySource, AgentActivityStep, AgentToolActivity } from "@/lib/api";
import { cn } from "@/lib/utils";

const icons = {
  market: BarChart3,
  news: Newspaper,
  technical: FileSearch,
  risk: ShieldCheck,
  portfolio: PieChart,
  consensus: Search,
  research: FileSearch,
  synthesis: Sparkles,
  system: CircleDashed,
} satisfies Record<AgentActivityCategory, typeof BarChart3>;

function orbState(activity: LiveAgentActivity): OrbState {
  const active = activeActivityStep(activity);
  if (activity.status === "queued") return "listening";
  if (active?.category === "market" || active?.category === "news" || active?.category === "research") return "searching";
  if (active?.category === "synthesis") return "composing";
  if (activity.mode === "consensus") return "solving";
  return "working";
}

function toolState(tool: AgentToolActivity): DynamicToolUIPart["state"] {
  if (tool.status === "active") return "input-available";
  if (tool.status === "complete") return "output-available";
  if (tool.status === "error") return "output-error";
  if (tool.status === "warning") return "output-denied";
  return "input-streaming";
}

function useActivityDuration(activity: LiveAgentActivity) {
  const [now, setNow] = useState(() => Date.now());
  const running = activity.status === "running";

  useEffect(() => {
    if (!running) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [running]);

  return formatActivityDuration(activityElapsedMs(activity, now));
}

function ToolRow({ tool }: { tool: AgentToolActivity }) {
  return (
    <Tool defaultOpen={tool.status === "active" || tool.status === "error" || tool.status === "warning" || Boolean(tool.output_summary)}>
      <ToolHeader type="dynamic-tool" toolName={tool.tool_name} state={toolState(tool)} title={tool.label} />
      <ToolContent>
        {tool.tool_input && <ToolInput input={tool.tool_input} />}
        <ToolOutput output={tool.output_summary ?? null} errorText={tool.error?.message} />
      </ToolContent>
    </Tool>
  );
}

const singleStepCopy: Record<string, { label: string; description: string }> = {
  single_scope: {
    label: "Understand the request",
    description: "Identified the requested assets, timeframe, and decision the response should address.",
  },
  single_synthesis: {
    label: "Synthesize findings",
    description: "Combined the available context, tool results, risks, and caveats into the response.",
  },
  single_final: {
    label: "Finalize response",
    description: "Checked the answer structure and prepared it for delivery.",
  },
};

function activityStepCopy(step: AgentActivityStep) {
  const fallback = singleStepCopy[step.step_id];
  return {
    label: fallback?.label ?? step.label,
    description: fallback?.description ?? step.description,
  };
}

export function AgentSources({ sources, className }: { sources: AgentActivitySource[]; className?: string }) {
  if (!sources.length) return null;
  return (
    <Sources className={className}>
      <SourcesTrigger count={sources.length} />
      <SourcesContent>
        {sources.map((source) => (
          <Source key={source.source_id} href={source.url ?? undefined} title={source.title}>
            <Newspaper className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium text-[var(--text-primary)]">{source.title}</span>
              <span className="block truncate text-[10px] text-[var(--text-subtle)]">
                {source.provider}{source.published_at ? ` · ${source.published_at}` : ""}
              </span>
            </span>
          </Source>
        ))}
      </SourcesContent>
    </Sources>
  );
}

export function AgentActivitySummary({
  activity,
  onOpen,
  className,
}: {
  activity: LiveAgentActivity;
  onOpen: () => void;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const active = activeActivityStep(activity);
  const completed = completedActivityCount(activity);
  const duration = useActivityDuration(activity);
  const isRunning = activity.status === "queued" || activity.status === "running";
  const currentLabel = activity.status === "queued"
    ? `Queued${activity.queue_position ? ` · Position ${activity.queue_position}` : ""}`
    : active?.label || "Working";
  const currentDetail = active?.description;

  return (
    <section className={cn("w-full py-1", className)} aria-label="Analysis activity">
      <button
        type="button"
        onClick={onOpen}
        className="group flex min-h-11 w-full items-start gap-3 rounded-lg px-1 py-2 text-left text-[var(--text-secondary)] transition-colors duration-150 hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50 motion-reduce:transition-none"
        aria-haspopup="dialog"
        data-testid="agent-activity-summary"
      >
        <span className="mt-0.5 grid size-5 shrink-0 place-items-center" aria-hidden="true">
          {isRunning ? (
            reduceMotion
              ? <CircleDashed className="size-4 text-[var(--text-subtle)]" />
              : <ThinkingOrb state={orbState(activity)} size={20} theme="auto" aria-label="Analysis in progress" data-testid="ai-thinking-orb" />
          ) : activity.status === "failed" ? (
            <TriangleAlert className="size-4 text-[var(--color-amber-warning)]" />
          ) : (
            <Check className="size-4 text-[var(--text-subtle)]" />
          )}
        </span>

        <span className={cn("min-w-0", isRunning ? "flex-1" : "shrink-0")}>
          {isRunning ? (
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={active?.step_id || activity.status}
                className="block"
                initial={reduceMotion ? false : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -3 }}
                transition={{ duration: reduceMotion ? 0 : 0.16 }}
              >
                <span className="block truncate text-sm font-medium text-[var(--text-primary)]">{currentLabel}</span>
                {currentDetail && <span className="mt-0.5 block line-clamp-2 text-sm leading-5 text-[var(--text-subtle)]">{currentDetail}</span>}
                {completed > 0 && <span className="mt-1 block text-xs text-[var(--text-subtle)]">{completed} step{completed === 1 ? "" : "s"} completed</span>}
              </motion.span>
            </AnimatePresence>
          ) : (
            <span className="block truncate text-sm font-medium text-[var(--text-secondary)]">
              {activity.status === "completed" ? `Worked for ${duration}` : `Stopped after ${duration}`}
            </span>
          )}
        </span>
        <ChevronRight className="mt-0.5 size-4 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
      </button>
      <span className="sr-only" aria-live="polite">
        {isRunning ? `${currentLabel}. ${currentDetail || ""}` : activity.status === "completed" ? `Analysis completed in ${duration}` : `Analysis stopped after ${duration}`}
      </span>
    </section>
  );
}

function StepStatusIcon({ step }: { step: AgentActivityStep }) {
  const Icon = icons[step.category] ?? CircleDashed;
  if (step.status === "active") return <CircleDashed className="size-4 text-indigo-primary" aria-hidden="true" />;
  if (step.status === "error" || step.status === "warning") return <TriangleAlert className="size-4 text-[var(--color-amber-warning)]" aria-hidden="true" />;
  if (step.status === "complete") return <Check className="size-4 text-[var(--text-subtle)]" aria-hidden="true" />;
  return <Icon className="size-4 text-[var(--text-subtle)]" aria-hidden="true" />;
}

function ActivityPhase({
  step,
  tools,
  sources,
}: {
  step: AgentActivityStep;
  tools: AgentToolActivity[];
  sources: AgentActivitySource[];
}) {
  const copy = activityStepCopy(step);
  const hasDetails = Boolean(copy.description || tools.length || sources.length);
  const defaultOpen = hasDetails;
  const [open, setOpen] = useState(defaultOpen);

  if (!hasDetails) {
    return (
      <div className="flex min-h-12 gap-3 py-3">
        <span className="mt-0.5"><StepStatusIcon step={step} /></span>
        <span className="min-w-0 flex-1 text-sm font-medium text-[var(--text-primary)]">{copy.label}</span>
        {step.duration_ms != null && <span className="text-xs text-[var(--text-subtle)]">{formatActivityDuration(step.duration_ms)}</span>}
      </div>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="group flex min-h-12 w-full items-start gap-3 rounded-lg py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50">
        <span className="mt-0.5"><StepStatusIcon step={step} /></span>
        <span className="min-w-0 flex-1 text-sm font-medium text-[var(--text-primary)]">{copy.label}</span>
        {step.duration_ms != null && <span className="mt-0.5 text-xs text-[var(--text-subtle)]">{formatActivityDuration(step.duration_ms)}</span>}
        <ChevronDown className={cn("mt-0.5 size-4 shrink-0 text-[var(--text-subtle)] transition-transform duration-150 motion-reduce:transition-none", open && "rotate-180")} aria-hidden="true" />
      </CollapsibleTrigger>
      <CollapsibleContent className="ml-[1.625rem] border-l border-[var(--theme-border)] pb-3 pl-4 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0">
        {copy.description && <p className="pb-3 text-sm leading-6 text-[var(--text-secondary)]">{copy.description}</p>}
        <div className="space-y-2">
          {tools.map((tool) => <ToolRow key={tool.tool_call_id} tool={tool} />)}
          {sources.length > 0 && <AgentSources sources={sources} />}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function AgentActivityDrawer({
  activity,
  open,
  onOpenChange,
}: {
  activity: LiveAgentActivity | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const duration = useActivityDuration(activity ?? emptyDrawerActivity);
  const steps = useMemo(() => activity ? visibleActivitySteps(activity) : [], [activity]);
  const assignedToolIds = useMemo(() => new Set(steps.map((step) => step.step_id)), [steps]);
  if (!activity) return null;

  const unassignedTools = activity.tools.filter((tool) => !tool.step_id || !assignedToolIds.has(tool.step_id));
  const unassignedSources = activity.sources.filter((source) => !source.step_id || !assignedToolIds.has(source.step_id));
  const completedSteps = steps.filter((step) => step.status === "complete" || step.status === "warning").length;
  const runSummary = [
    `${completedSteps} of ${steps.length} steps`,
    `${activity.tools.length} tool${activity.tools.length === 1 ? "" : "s"}`,
    `${activity.sources.length} source${activity.sources.length === 1 ? "" : "s"}`,
  ].join(" · ");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!inset-y-0 !left-auto !right-0 !top-0 !h-dvh !max-h-dvh !w-full !max-w-[480px] !translate-x-0 !translate-y-0 !scale-100 !rounded-none border-y-0 border-r-0 transition-[transform] duration-[220ms] ease-[cubic-bezier(0.16,1,0.3,1)] data-[ending-style]:!translate-x-full data-[starting-style]:!translate-x-full motion-reduce:transition-none motion-reduce:data-[ending-style]:!translate-x-0 motion-reduce:data-[starting-style]:!translate-x-0 sm:!w-[min(480px,100vw)]" data-testid="agent-activity-drawer">
        <DialogHeader className="border-b border-[var(--theme-border)] px-5 pb-5 pt-5 pr-16">
          <DialogTitle className="text-lg font-medium">Activity <span className="px-1.5 text-[var(--text-subtle)]">·</span> {duration}</DialogTitle>
          <DialogDescription>{runSummary}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-[0.12em] text-[var(--text-subtle)]">Analysis</h2>
          <div className="divide-y divide-[var(--theme-border)]">
            {steps.map((step) => (
              <ActivityPhase
                key={step.step_id}
                step={step}
                tools={activity.tools.filter((tool) => tool.step_id === step.step_id)}
                sources={activity.sources.filter((source) => source.step_id === step.step_id)}
              />
            ))}
          </div>

          {unassignedTools.length > 0 && (
            <section className="mt-7" aria-labelledby="activity-tools-heading">
              <h2 id="activity-tools-heading" className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-[var(--text-subtle)]">Tools</h2>
              <div className="space-y-2">{unassignedTools.map((tool) => <ToolRow key={tool.tool_call_id} tool={tool} />)}</div>
            </section>
          )}
          {unassignedSources.length > 0 && (
            <section className="mt-7" aria-labelledby="activity-sources-heading">
              <h2 id="activity-sources-heading" className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-[var(--text-subtle)]">Sources</h2>
              <AgentSources sources={unassignedSources} />
            </section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

const emptyDrawerActivity: LiveAgentActivity = {
  run_id: "drawer",
  mode: "single",
  status: "completed",
  steps: [],
  tools: [],
  sources: [],
};
