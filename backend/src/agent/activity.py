"""Translate internal progress callbacks into safe, user-visible activity."""

from __future__ import annotations

import hashlib
import re
import time
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlparse

from src.models.agent_activity import (
    AgentActivityError,
    AgentActivityEvent,
    AgentActivitySource,
    AgentActivityStepSummary,
    AgentActivityTrace,
    AgentPlannedStep,
    AgentToolSummary,
)

_SENSITIVE_KEY = re.compile(
    r"(?:authorization|cookie|credential|password|secret|token|api[_-]?key|prompt|system)",
    re.IGNORECASE,
)
_TOOL_INPUT_ALLOWLIST: dict[str, set[str]] = {
    "get_stock_info": {"ticker", "symbol"},
    "research_market": {"ticker", "symbol", "query"},
    "search_financial_news": {"ticker", "symbol", "query", "limit"},
    "analyze_sentiment": {"ticker", "symbol", "headlines"},
    "predict_stock_price": {"ticker", "symbol", "model"},
    "optimize_portfolio_tool": {"tickers", "symbols", "method", "risk_tolerance"},
    "market_search": {"query"},
    "market_quote": {"ticker", "symbol"},
    "build_data_snapshot": {"ticker"},
}


def _compact_text(value: Any, limit: int) -> str:
    text = " ".join(str(value or "").split())
    return text[:limit]


def _safe_url(value: Any) -> str | None:
    text = _compact_text(value, 2048)
    if not text:
        return None
    parsed = urlparse(text)
    return text if parsed.scheme in {"http", "https"} and parsed.netloc else None


def sanitize_tool_input(tool_name: str, value: Any) -> dict[str, Any] | None:
    if not isinstance(value, dict):
        return None
    allowed = _TOOL_INPUT_ALLOWLIST.get(tool_name, set())
    result: dict[str, Any] = {}
    for key, item in value.items():
        normalized = str(key)
        if normalized not in allowed or _SENSITIVE_KEY.search(normalized):
            continue
        if isinstance(item, (str, int, float, bool)) or item is None:
            result[normalized] = (
                _compact_text(item, 240) if isinstance(item, str) else item
            )
        elif isinstance(item, list):
            result[normalized] = [
                _compact_text(entry, 120)
                for entry in item[:12]
                if isinstance(entry, (str, int, float, bool))
            ]
    return result or None


def sanitize_output_summary(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, dict):
        safe_parts = []
        for key, item in value.items():
            if _SENSITIVE_KEY.search(str(key)):
                continue
            if isinstance(item, (str, int, float, bool)):
                safe_parts.append(f"{key}: {item}")
            if len(safe_parts) >= 6:
                break
        return _compact_text("; ".join(safe_parts), 500) or None
    return _compact_text(value, 500) or None


def sanitize_error(value: Any, *, retryable: bool = False) -> AgentActivityError:
    message = _compact_text(value, 500) or "The activity could not be completed."
    message = re.sub(r"(?i)(?:bearer\s+)?[a-z0-9_-]{24,}", "[redacted]", message)
    return AgentActivityError(message=message, retryable=retryable)


def sanitize_source(value: Any) -> AgentActivitySource | None:
    if not isinstance(value, dict):
        return None
    title = _compact_text(
        value.get("title") or value.get("label") or value.get("source"), 240
    )
    provider = _compact_text(
        value.get("provider") or value.get("source") or "Market evidence", 120
    )
    if not title:
        return None
    url = _safe_url(value.get("url"))
    identity = url or f"{provider}:{title}"
    source_id = hashlib.sha256(identity.encode("utf-8")).hexdigest()[:24]
    return AgentActivitySource(
        source_id=source_id,
        title=title,
        provider=provider,
        url=url,
        published_at=_compact_text(
            value.get("published_at") or value.get("timestamp"), 120
        )
        or None,
        preview=_compact_text(value.get("preview") or value.get("detail"), 320) or None,
    )


def activity_category(name: str) -> str:
    normalized = name.casefold()
    if any(token in normalized for token in ("news", "sentiment", "social")):
        return "news"
    if any(token in normalized for token in ("risk", "downside", "volatility")):
        return "risk"
    if any(
        token in normalized for token in ("portfolio", "allocation", "optimize", "pm")
    ):
        return "portfolio"
    if any(
        token in normalized
        for token in ("technical", "predict", "quant_analyst", "data_scientist")
    ):
        return "technical"
    if any(token in normalized for token in ("consensus", "aggregate")):
        return "consensus"
    if any(token in normalized for token in ("synthesis", "final", "compose")):
        return "synthesis"
    if any(
        token in normalized
        for token in ("market", "stock", "quote", "research", "snapshot")
    ):
        return "market"
    return "system"


def _activity_description(update: dict[str, Any]) -> str | None:
    return (
        _compact_text(update.get("activity_detail") or update.get("message"), 500)
        or None
    )


def planned_steps_for(kind: str) -> list[AgentPlannedStep]:
    if kind == "consensus":
        labels = [
            ("quant_researcher", "market", "Collecting market evidence"),
            ("quant_analyst", "technical", "Evaluating technical signals"),
            ("data_scientist", "technical", "Running predictive checks"),
            ("risk_analyst", "risk", "Evaluating downside risk"),
            ("portfolio_analytics", "portfolio", "Comparing portfolio impact"),
            ("consensus_synthesis", "synthesis", "Preparing the final investment view"),
        ]
    else:
        labels = [
            ("single_scope", "system", "Understanding the request"),
            ("single_synthesis", "synthesis", "Preparing the response"),
        ]
    return [
        AgentPlannedStep(
            step_id=step_id,
            category=category,
            label=label,
            order=index,
        )
        for index, (step_id, category, label) in enumerate(labels)
    ]


class ActivityEventCollector:
    """Stateful adapter for the existing progress callback shape."""

    def __init__(
        self, run_id: str, mode: str, planned_steps: list[dict[str, Any]] | None = None
    ):
        self.run_id = run_id
        self.mode = mode
        self.planned_steps = [
            AgentPlannedStep.model_validate(step)
            for step in (
                planned_steps or [item.model_dump() for item in planned_steps_for(mode)]
            )
        ]
        self.events: list[AgentActivityEvent] = []
        self._active_tool: str | None = None
        self._started: set[str] = set()
        self._completed: set[str] = set()
        self._tool_calls: dict[str, str] = {}
        self._step_started_at: dict[str, float] = {}
        self.started_at = datetime.now(timezone.utc)

    def _emit(self, event_type: str, **fields: Any) -> AgentActivityEvent:
        event = AgentActivityEvent(
            run_id=self.run_id,
            sequence=len(self.events) + 1,
            occurred_at=datetime.now(timezone.utc),
            type=event_type,
            mode=self.mode,
            **fields,
        )
        self.events.append(event)
        return event

    def planned_event(self) -> AgentActivityEvent:
        return self._emit(
            "analysis.planned",
            label="Analysis plan ready",
            planned_steps=self.planned_steps,
        )

    def consume(self, update: dict[str, Any]) -> list[AgentActivityEvent]:
        before = len(self.events)
        active = str(update.get("active_tool") or "") or None
        completed = {str(item) for item in (update.get("completed_tools") or [])}
        warning = (
            sanitize_error(update.get("tool_warning"), retryable=False)
            if update.get("tool_warning")
            else None
        )
        completed_summaries = (
            update.get("completed_summaries")
            if isinstance(update.get("completed_summaries"), dict)
            else {}
        )

        for name in completed - self._completed:
            self._completed.add(name)
            started_at = self._step_started_at.pop(name, None)
            duration_ms = (
                max(0, int((time.monotonic() - started_at) * 1000))
                if started_at is not None
                else None
            )
            completed_summary = (
                _compact_text(
                    completed_summaries.get(name)
                    or update.get("activity_detail")
                    or update.get("message"),
                    500,
                )
                or None
            )
            self._emit(
                "step.completed",
                step_id=name,
                category=activity_category(name),
                label=_compact_text(
                    (
                        update.get("active_label")
                        if name == active
                        else name.replace("_", " ").title()
                    ),
                    160,
                ),
                description=completed_summary,
                status="warning" if warning else "complete",
                duration_ms=duration_ms,
                error=warning,
            )
            call_id = self._tool_calls.get(name)
            if call_id:
                self._emit(
                    "tool.completed",
                    step_id=name,
                    category=activity_category(name),
                    tool_call_id=call_id,
                    tool_name=name,
                    label=name.replace("_", " ").title(),
                    status="warning" if warning else "complete",
                    output_summary=sanitize_output_summary(update.get("tool_output")),
                    duration_ms=duration_ms,
                    error=warning,
                )

        if update.get("tool_error"):
            failed_name = active or self._active_tool or "analysis"
            error = sanitize_error(update.get("tool_error"), retryable=False)
            started_at = self._step_started_at.pop(failed_name, None)
            duration_ms = (
                max(0, int((time.monotonic() - started_at) * 1000))
                if started_at is not None
                else None
            )
            self._emit(
                "step.failed",
                step_id=failed_name,
                category=activity_category(failed_name),
                label=_compact_text(
                    update.get("active_label") or failed_name.replace("_", " ").title(),
                    160,
                ),
                description=error.message,
                status="error",
                duration_ms=duration_ms,
                error=error,
            )
            call_id = self._tool_calls.get(failed_name)
            if call_id:
                self._emit(
                    "tool.failed",
                    step_id=failed_name,
                    category=activity_category(failed_name),
                    tool_call_id=call_id,
                    tool_name=failed_name,
                    label=failed_name.replace("_", " ").title(),
                    status="error",
                    duration_ms=duration_ms,
                    error=error,
                )

        if active and active != self._active_tool:
            self._active_tool = active
            if active not in self._started:
                self._started.add(active)
                self._step_started_at[active] = time.monotonic()
                label = _compact_text(
                    update.get("active_label") or active.replace("_", " ").title(), 160
                )
                self._emit(
                    "step.started",
                    step_id=active,
                    category=activity_category(active),
                    label=label,
                    description=_activity_description(update),
                    status="active",
                )
                safe_input = sanitize_tool_input(active, update.get("tool_input"))
                if update.get("tool_input") is not None:
                    call_id = f"{active}-{len(self._tool_calls) + 1}"
                    self._tool_calls[active] = call_id
                    self._emit(
                        "tool.started",
                        step_id=active,
                        category=activity_category(active),
                        tool_call_id=call_id,
                        tool_name=active,
                        label=label,
                        status="active",
                        tool_input=safe_input,
                    )
        elif active is None:
            self._active_tool = None

        for item in update.get("sources") or []:
            source = sanitize_source(item)
            if source and not any(
                event.source and event.source.source_id == source.source_id
                for event in self.events
            ):
                self._emit(
                    "source.found",
                    step_id=active,
                    category=activity_category(active or "market"),
                    label=source.title,
                    source=source.model_copy(update={"step_id": active}),
                )

        return self.events[before:]

    def trace(self, status: str = "completed") -> AgentActivityTrace:
        steps: dict[str, AgentActivityStepSummary] = {}
        tools: dict[str, AgentToolSummary] = {}
        sources: dict[str, AgentActivitySource] = {}
        for event in self.events:
            if event.step_id and event.type.startswith("step."):
                steps[event.step_id] = AgentActivityStepSummary(
                    step_id=event.step_id,
                    category=event.category or "system",
                    label=event.label or event.step_id.replace("_", " ").title(),
                    description=event.description,
                    status=event.status or "pending",
                    duration_ms=event.duration_ms,
                )
            if (
                event.tool_call_id
                and event.type.startswith("tool.")
                and event.tool_name
            ):
                previous = tools.get(event.tool_call_id)
                tools[event.tool_call_id] = AgentToolSummary(
                    tool_call_id=event.tool_call_id,
                    step_id=event.step_id,
                    tool_name=event.tool_name,
                    label=event.label or event.tool_name.replace("_", " ").title(),
                    status=event.status or (previous.status if previous else "pending"),
                    tool_input=(
                        event.tool_input
                        if event.tool_input is not None
                        else (previous.tool_input if previous else None)
                    ),
                    output_summary=(
                        event.output_summary
                        if event.output_summary is not None
                        else (previous.output_summary if previous else None)
                    ),
                    error=(
                        event.error
                        if event.error is not None
                        else (previous.error if previous else None)
                    ),
                    duration_ms=(
                        event.duration_ms
                        if event.duration_ms is not None
                        else (previous.duration_ms if previous else None)
                    ),
                )
            if event.source:
                sources[event.source.source_id] = event.source
        if not steps:
            steps["response"] = AgentActivityStepSummary(
                step_id="response",
                category="synthesis",
                label="Prepared the response",
                status="complete" if status == "completed" else "error",
            )
        return AgentActivityTrace(
            run_id=self.run_id,
            mode=self.mode,
            status=status,
            steps=list(steps.values())[:32],
            tools=list(tools.values())[:20],
            sources=list(sources.values())[:24],
            started_at=self.started_at,
        )
