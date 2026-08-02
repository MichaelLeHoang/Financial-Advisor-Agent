"""Public contracts for user-visible agent activity traces."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal

from pydantic import BaseModel, Field

AgentActivityType = Literal[
    "analysis.planned",
    "analysis.queued",
    "analysis.started",
    "analysis.completed",
    "analysis.failed",
    "step.started",
    "step.completed",
    "step.failed",
    "tool.started",
    "tool.completed",
    "tool.failed",
    "tool.approval_requested",
    "tool.approval_resolved",
    "source.found",
]

AgentActivityCategory = Literal[
    "market",
    "news",
    "technical",
    "risk",
    "portfolio",
    "consensus",
    "research",
    "synthesis",
    "system",
]

AgentActivityStatus = Literal["pending", "active", "complete", "error", "warning"]


class AgentPlannedStep(BaseModel):
    step_id: str = Field(min_length=1, max_length=80)
    category: AgentActivityCategory
    label: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=280)
    order: int = Field(ge=0)


class AgentActivitySource(BaseModel):
    source_id: str = Field(min_length=1, max_length=160)
    step_id: str | None = Field(default=None, max_length=80)
    title: str = Field(min_length=1, max_length=240)
    provider: str = Field(min_length=1, max_length=120)
    url: str | None = Field(default=None, max_length=2048)
    published_at: str | None = Field(default=None, max_length=120)
    preview: str | None = Field(default=None, max_length=320)


class AgentActivityError(BaseModel):
    code: str = Field(default="activity_error", max_length=80)
    message: str = Field(min_length=1, max_length=500)
    retryable: bool = False


class AgentActivityEvent(BaseModel):
    run_id: str = Field(min_length=1, max_length=160)
    sequence: int = Field(ge=0)
    occurred_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    type: AgentActivityType
    mode: str | None = Field(default=None, max_length=40)
    category: AgentActivityCategory | None = None
    step_id: str | None = Field(default=None, max_length=80)
    tool_call_id: str | None = Field(default=None, max_length=160)
    tool_name: str | None = Field(default=None, max_length=120)
    label: str | None = Field(default=None, max_length=160)
    description: str | None = Field(default=None, max_length=500)
    status: AgentActivityStatus | None = None
    queue_position: int | None = Field(default=None, ge=1)
    planned_steps: list[AgentPlannedStep] = Field(default_factory=list)
    tool_input: dict[str, Any] | None = None
    output_summary: str | None = Field(default=None, max_length=500)
    duration_ms: int | None = Field(default=None, ge=0)
    error: AgentActivityError | None = None
    source: AgentActivitySource | None = None
    approval_outcome: Literal["approved", "denied"] | None = None


class AgentActivityStepSummary(BaseModel):
    step_id: str
    category: AgentActivityCategory
    label: str
    description: str | None = None
    status: AgentActivityStatus
    duration_ms: int | None = None


class AgentToolSummary(BaseModel):
    tool_call_id: str
    step_id: str | None = None
    tool_name: str
    label: str
    status: AgentActivityStatus
    tool_input: dict[str, Any] | None = None
    output_summary: str | None = None
    error: AgentActivityError | None = None
    duration_ms: int | None = None


class AgentActivityTrace(BaseModel):
    run_id: str
    mode: str
    status: Literal["completed", "failed", "cancelled"] = "completed"
    steps: list[AgentActivityStepSummary] = Field(default_factory=list)
    tools: list[AgentToolSummary] = Field(default_factory=list)
    sources: list[AgentActivitySource] = Field(default_factory=list)
    started_at: datetime | None = None
    finished_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
