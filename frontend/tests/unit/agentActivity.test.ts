import test from "node:test";
import assert from "node:assert/strict";

import {
  activityElapsedMs,
  activityFromTrace,
  activeActivityStep,
  completedActivityCount,
  emptyActivity,
  formatActivityDuration,
  mergeSources,
  reduceActivity,
  researchActivityEvents,
  visibleActivitySteps,
} from "../../src/lib/agent-activity.ts";
import type { AgentActivityEvent, EquityResearchEvent } from "../../src/lib/api.ts";

const occurredAt = "2026-08-02T12:00:00Z";

function activityEvent(event: Partial<AgentActivityEvent> & Pick<AgentActivityEvent, "type">): AgentActivityEvent {
  return {
    run_id: "run-1",
    sequence: 1,
    occurred_at: occurredAt,
    ...event,
  };
}

test("reduces planned, tool, source, and completion events into a live trace", () => {
  let activity = emptyActivity("run-1", "single");
  activity = reduceActivity(activity, activityEvent({
    type: "analysis.planned",
    planned_steps: [
      { step_id: "news", category: "news", label: "Reviewing recent news", order: 0 },
    ],
  }));
  activity = reduceActivity(activity, activityEvent({
    type: "step.started",
    step_id: "news",
    category: "news",
    label: "Reviewing recent news",
    status: "active",
  }));
  activity = reduceActivity(activity, activityEvent({
    type: "tool.started",
    step_id: "news",
    tool_call_id: "news-1",
    tool_name: "search_financial_news",
    label: "Financial news search",
    status: "active",
    tool_input: { ticker: "NVDA" },
  }));
  activity = reduceActivity(activity, activityEvent({
    type: "source.found",
    source: {
      source_id: "source-1",
      title: "NVIDIA results",
      provider: "Investor Relations",
      url: "https://investor.nvidia.com/results",
    },
  }));
  activity = reduceActivity(activity, activityEvent({
    type: "analysis.completed",
    status: "complete",
  }));

  assert.equal(activity.status, "completed");
  assert.equal(activity.steps[0].status, "complete");
  assert.equal(activity.tools[0].status, "complete");
  assert.deepEqual(activity.tools[0].tool_input, { ticker: "NVDA" });
  assert.equal(activity.sources[0].provider, "Investor Relations");
});

test("shows only phases that have actually started", () => {
  const activity = {
    ...emptyActivity("run-1", "single"),
    status: "running" as const,
    steps: [
      { step_id: "market", category: "market" as const, label: "Collecting evidence", status: "complete" as const },
      { step_id: "risk", category: "risk" as const, label: "Evaluating risk", status: "active" as const },
      { step_id: "portfolio", category: "portfolio" as const, label: "Comparing portfolio impact", status: "pending" as const },
    ],
  };

  assert.deepEqual(visibleActivitySteps(activity).map((step) => step.step_id), ["market", "risk"]);
  assert.equal(activeActivityStep(activity)?.step_id, "risk");
  assert.equal(completedActivityCount(activity), 1);
});

test("provides a truthful fallback when a completed run has no phase events", () => {
  const activity = { ...emptyActivity("run-1", "single"), status: "completed" as const };

  assert.equal(visibleActivitySteps(activity)[0].label, "Response prepared");
  assert.equal(completedActivityCount(activity), 1);
});

test("normalizes stale active phases when loading a terminal trace", () => {
  const activity = activityFromTrace({
    ...emptyActivity("run-1", "single"),
    status: "completed",
    steps: [{ step_id: "synthesis", category: "synthesis", label: "Preparing response", status: "active" }],
  });

  assert.equal(activity?.steps[0].status, "complete");
});

test("formats elapsed activity time from real timestamps", () => {
  const activity = {
    started_at: "2026-08-02T12:00:00.000Z",
    finished_at: "2026-08-02T12:01:12.000Z",
  };

  assert.equal(activityElapsedMs(activity), 72_000);
  assert.equal(formatActivityDuration(activityElapsedMs(activity)), "1m 12s");
  assert.equal(formatActivityDuration(350), "<1s");
});

test("translates research evidence into source events and a terminal trace", () => {
  const sourceEvent: EquityResearchEvent = {
    event_id: "event-1",
    run_id: "research-1",
    timestamp: occurredAt,
    event_type: "source",
    label: "Quarterly results",
    content: "Primary earnings evidence",
    source_url: "https://example.com/results",
    source_provider: "Example IR",
  };
  const finalEvent: EquityResearchEvent = {
    event_id: "event-2",
    run_id: "research-1",
    timestamp: occurredAt,
    event_type: "final",
    label: "Final investment view",
    content: "Synthesis complete",
    agent_key: "pm",
    agent_name: "Portfolio Manager",
  };

  const source = researchActivityEvents(sourceEvent, 3);
  const completed = researchActivityEvents(finalEvent, 4);

  assert.equal(source[0].type, "source.found");
  assert.equal(source[0].source?.url, "https://example.com/results");
  assert.deepEqual(completed.map((event) => event.type), ["step.completed", "analysis.completed"]);
});

test("merges duplicate citations by URL", () => {
  const source = {
    source_id: "source-1",
    title: "Results",
    provider: "Example IR",
    url: "https://example.com/results",
  };

  assert.equal(mergeSources([source], [{ ...source, source_id: "source-2" }]).length, 1);
});
