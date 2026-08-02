import type { AgentActivityEvent, AgentActivitySource, AgentActivityTrace, AgentToolActivity, AgentActivityStep, EquityResearchEvent } from "./api";

export type LiveAgentActivity = AgentActivityTrace & {
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  queue_position?: number | null;
};

export function emptyActivity(runId: string, mode: string): LiveAgentActivity {
  return { run_id: runId, mode, status: "queued", steps: [], tools: [], sources: [] };
}

export function activityElapsedMs(
  activity: Pick<AgentActivityTrace, "started_at" | "finished_at">,
  now = Date.now(),
): number | null {
  if (!activity.started_at) return null;
  const startedAt = Date.parse(activity.started_at);
  const finishedAt = activity.finished_at ? Date.parse(activity.finished_at) : now;
  if (!Number.isFinite(startedAt) || !Number.isFinite(finishedAt)) return null;
  return Math.max(0, finishedAt - startedAt);
}

export function formatActivityDuration(durationMs: number | null): string {
  if (durationMs === null) return "a moment";
  if (durationMs < 1000) return "<1s";
  const seconds = Math.round(durationMs / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
}

export function visibleActivitySteps(activity: LiveAgentActivity): AgentActivityStep[] {
  const visible = activity.steps.filter((step) => step.status !== "pending");
  if (visible.length || (activity.status !== "completed" && activity.status !== "failed")) return visible;

  return [{
    step_id: activity.status === "completed" ? "response-prepared" : "analysis-stopped",
    category: "synthesis",
    label: activity.status === "completed" ? "Response prepared" : "Analysis stopped",
    description: activity.status === "completed"
      ? "Prepared the final response."
      : "The run stopped before a phase update was recorded.",
    status: activity.status === "completed" ? "complete" : "error",
  }];
}

export function activeActivityStep(activity: LiveAgentActivity): AgentActivityStep | undefined {
  return [...activity.steps].reverse().find((step) => step.status === "active");
}

export function completedActivityCount(activity: LiveAgentActivity): number {
  return visibleActivitySteps(activity).filter((step) => step.status === "complete" || step.status === "warning").length;
}

function upsert<T>(items: T[], predicate: (item: T) => boolean, value: T): T[] {
  const index = items.findIndex(predicate);
  if (index < 0) return [...items, value];
  const next = [...items];
  next[index] = value;
  return next;
}

export function reduceActivity(
  current: LiveAgentActivity | null,
  event: AgentActivityEvent,
): LiveAgentActivity {
  const state = current ?? emptyActivity(event.run_id, event.mode ?? "single");
  let next: LiveAgentActivity = { ...state, run_id: event.run_id, mode: event.mode ?? state.mode };

  if (event.type === "analysis.planned") {
    const planned = (event.planned_steps ?? []).map<AgentActivityStep>((step) => ({
      step_id: step.step_id,
      category: step.category,
      label: step.label,
      description: step.description,
      status: "pending",
    }));
    next = { ...next, steps: planned };
  } else if (event.type === "analysis.queued") {
    next = { ...next, status: "queued", queue_position: event.queue_position };
  } else if (event.type === "analysis.started") {
    next = { ...next, status: "running", started_at: event.occurred_at };
  } else if (event.type === "analysis.completed") {
    next = {
      ...next,
      status: "completed",
      finished_at: event.occurred_at,
      steps: next.steps.map((step) => step.status === "active" ? { ...step, status: "complete" } : step),
      tools: next.tools.map((tool) => tool.status === "active" ? { ...tool, status: "complete" } : tool),
    };
  } else if (event.type === "analysis.failed") {
    next = {
      ...next,
      status: "failed",
      finished_at: event.occurred_at,
      steps: next.steps.map((step) => step.status === "active" ? { ...step, status: "error" } : step),
      tools: next.tools.map((tool) => tool.status === "active" ? { ...tool, status: "error" } : tool),
    };
  } else if (event.type.startsWith("step.") && event.step_id) {
    const previous = next.steps.find((step) => step.step_id === event.step_id);
    const step: AgentActivityStep = {
      step_id: event.step_id,
      category: event.category ?? previous?.category ?? "system",
      label: event.label ?? previous?.label ?? event.step_id.replaceAll("_", " "),
      description: event.description ?? previous?.description,
      status: event.status ?? previous?.status ?? "pending",
      duration_ms: event.duration_ms ?? previous?.duration_ms,
    };
    next = { ...next, status: next.status === "queued" ? "running" : next.status, steps: upsert(next.steps, (item) => item.step_id === step.step_id, step) };
  } else if (event.type.startsWith("tool.") && event.tool_call_id && event.tool_name) {
    const previous = next.tools.find((tool) => tool.tool_call_id === event.tool_call_id);
    const tool: AgentToolActivity = {
      tool_call_id: event.tool_call_id,
      step_id: event.step_id,
      tool_name: event.tool_name,
      label: event.label ?? previous?.label ?? event.tool_name.replaceAll("_", " "),
      status: event.status ?? previous?.status ?? "pending",
      tool_input: event.tool_input ?? previous?.tool_input,
      output_summary: event.output_summary ?? previous?.output_summary,
      error: event.error ?? previous?.error,
      duration_ms: event.duration_ms ?? previous?.duration_ms,
    };
    next = { ...next, tools: upsert(next.tools, (item) => item.tool_call_id === tool.tool_call_id, tool) };
  } else if (event.type === "source.found" && event.source) {
    const source = { ...event.source, step_id: event.source.step_id ?? event.step_id };
    next = { ...next, sources: upsert(next.sources, (item) => item.source_id === source.source_id, source) };
  }

  return next;
}

function sourceId(event: EquityResearchEvent) {
  const identity = event.source_url || `${event.source_provider ?? "research"}:${event.label}`;
  let hash = 0;
  for (let index = 0; index < identity.length; index += 1) hash = ((hash << 5) - hash + identity.charCodeAt(index)) | 0;
  return `research-${Math.abs(hash)}`;
}

export function researchActivityEvents(
  event: EquityResearchEvent,
  sequence: number,
): AgentActivityEvent[] {
  const base = { run_id: event.run_id, occurred_at: event.timestamp, mode: "research" };
  const agentId = event.agent_key || event.tool_name || "research";
  if (event.event_type === "source") {
    const source: AgentActivitySource = {
      source_id: sourceId(event),
      step_id: agentId,
      title: event.label,
      provider: event.source_provider || "Research evidence",
      url: event.source_url,
      published_at: event.source_published_at,
      preview: event.content,
    };
    return [{ ...base, sequence, type: "source.found", category: "research", step_id: agentId, label: event.label, source }];
  }
  if (event.event_type === "tool") {
    const callId = `${agentId}-${event.event_id}`;
    return [
      { ...base, sequence: sequence * 10, type: "step.started", category: "market", step_id: agentId, label: event.label, description: event.content, status: "active" },
      { ...base, sequence: sequence * 10 + 1, type: "tool.started", category: "market", step_id: agentId, tool_call_id: callId, tool_name: event.tool_name || "research_tool", label: event.label, tool_input: event.tool_args, status: "active" },
    ];
  }
  if (event.event_type === "reasoning") {
    return [{ ...base, sequence, type: "step.started", category: "research", step_id: agentId, label: event.agent_name || event.label, description: event.content, status: "active" }];
  }
  if (event.event_type === "report") {
    return [{ ...base, sequence, type: "step.completed", category: event.agent_key === "pm" ? "portfolio" : "research", step_id: agentId, label: event.agent_name || event.label, description: event.content, status: "complete" }];
  }
  if (event.event_type === "final") {
    return [
      { ...base, sequence: sequence * 10, type: "step.completed", category: "synthesis", step_id: agentId, label: event.agent_name || "Final investment view", description: event.content, status: "complete" },
      { ...base, sequence: sequence * 10 + 1, type: "analysis.completed", label: "Analysis completed", status: "complete" },
    ];
  }
  if (event.event_type === "error") {
    return [{ ...base, sequence, type: "analysis.failed", label: event.label, description: event.content, status: "error", error: { code: "research_failed", message: event.content, retryable: false } }];
  }
  if (event.label === "Snapshot ready") {
    return [{ ...base, sequence, type: "step.completed", category: "market", step_id: "build_data_snapshot", label: "Market snapshot ready", description: event.content, status: "complete" }];
  }
  return [];
}

export function activityFromTrace(trace?: AgentActivityTrace | null): LiveAgentActivity | undefined {
  if (!trace) return undefined;
  const terminalStatus = trace.status === "completed" ? "complete" : trace.status === "failed" ? "error" : null;
  if (!terminalStatus) return { ...trace };
  return {
    ...trace,
    steps: trace.steps.map((step) => step.status === "active" ? { ...step, status: terminalStatus } : step),
    tools: trace.tools.map((tool) => tool.status === "active" ? { ...tool, status: terminalStatus } : tool),
  };
}

export function mergeSources(...groups: Array<AgentActivitySource[] | undefined>): AgentActivitySource[] {
  const result: AgentActivitySource[] = [];
  const seen = new Set<string>();
  for (const source of groups.flatMap((group) => group ?? [])) {
    const identity = source.url || `${source.provider}:${source.title}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    result.push(source);
  }
  return result;
}
