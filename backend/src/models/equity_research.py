from __future__ import annotations

import re
from datetime import date, datetime, timezone
from enum import Enum
from typing import Any, Literal
from uuid import UUID, uuid4

from pydantic import BaseModel, Field, field_validator


DISCLAIMER = "Not investment advice. For educational and informational use only."


class ResearchDepth(str, Enum):
    SHALLOW = "shallow"
    MEDIUM = "medium"
    DEEP = "deep"


class SourceSurface(str, Enum):
    INTRODUCTION = "introduction"
    RESEARCH = "research"
    MARKET = "market"
    AI_ADVISOR = "ai_advisor"
    SHARED = "shared"


class ResearchRunStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class AgentStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


class Recommendation(str, Enum):
    BUY = "buy"
    HOLD = "hold"
    SELL = "sell"
    INSUFFICIENT_DATA = "insufficient_data"


class ResearchEventType(str, Enum):
    REASONING = "reasoning"
    TOOL = "tool"
    REPORT = "report"
    STATUS = "status"
    FINAL = "final"
    ERROR = "error"


AnalystKey = Literal["market", "social", "news", "fundamentals"]


class EvidenceReference(BaseModel):
    label: str
    source: str
    detail: str | None = None
    url: str | None = None


class EquityResearchRunCreate(BaseModel):
    ticker: str = Field(min_length=1, max_length=20)
    analysis_date: date | None = None
    selected_analysts: list[AnalystKey] = Field(default_factory=lambda: ["market", "social", "news", "fundamentals"])
    research_depth: ResearchDepth = ResearchDepth.SHALLOW
    quick_model: str = "default-fast"
    deep_model: str = "default-research"
    source_surface: SourceSurface = SourceSurface.RESEARCH

    @field_validator("ticker")
    @classmethod
    def normalize_ticker(cls, value: str) -> str:
        normalized = value.strip().upper()
        if not re.fullmatch(r"[A-Z][A-Z0-9.-]{0,14}", normalized):
            raise ValueError("Ticker must use letters, numbers, dots, or dashes.")
        return normalized

    @field_validator("selected_analysts")
    @classmethod
    def require_analysts(cls, value: list[AnalystKey]) -> list[AnalystKey]:
        unique = list(dict.fromkeys(value))
        if not unique:
            raise ValueError("Select at least one analyst.")
        return unique


class EquityResearchSnapshot(BaseModel):
    snapshot_id: UUID = Field(default_factory=uuid4)
    run_id: UUID
    ticker: str
    company_name: str | None = None
    exchange: str | None = None
    analysis_date: date
    price_data_window: str = "6mo"
    latest_price: float | None = None
    previous_close: float | None = None
    daily_change: float | None = None
    volume: float | None = None
    market_cap: float | None = None
    fundamentals: dict[str, Any] = Field(default_factory=dict)
    technical_indicators: dict[str, Any] = Field(default_factory=dict)
    news_items: list[dict[str, Any]] = Field(default_factory=list)
    rag_context: list[dict[str, Any]] = Field(default_factory=list)
    sentiment_summary: dict[str, Any] = Field(default_factory=dict)
    risk_metrics: dict[str, Any] = Field(default_factory=dict)
    data_sources: list[str] = Field(default_factory=list)
    source_quality: dict[str, Any] = Field(default_factory=dict)
    provider_status: list[dict[str, Any]] = Field(default_factory=list)
    evidence_items: list[dict[str, Any]] = Field(default_factory=list)
    analyst_context: dict[str, Any] = Field(default_factory=dict)
    filing_context: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class EquityResearchReport(BaseModel):
    report_id: UUID = Field(default_factory=uuid4)
    run_id: UUID
    agent_key: str
    agent_name: str
    team: str
    status: AgentStatus = AgentStatus.PENDING
    title: str
    markdown: str
    summary_points: list[str] = Field(default_factory=list)
    evidence: list[EvidenceReference] = Field(default_factory=list)
    confidence: float = Field(ge=0, le=1, default=0.5)
    risk_flags: list[str] = Field(default_factory=list)
    started_at: datetime | None = None
    completed_at: datetime | None = None
    token_input: int | None = None
    token_output: int | None = None


class EquityResearchEvent(BaseModel):
    event_id: UUID = Field(default_factory=uuid4)
    run_id: UUID
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    agent_key: str | None = None
    agent_name: str | None = None
    event_type: ResearchEventType
    label: str
    content: str
    tool_name: str | None = None
    tool_args: dict[str, Any] | None = None
    token_input: int | None = None
    token_output: int | None = None


class EquityResearchRun(BaseModel):
    run_id: UUID = Field(default_factory=uuid4)
    user_id: UUID | None = None
    ticker: str
    company_name: str | None = None
    exchange: str | None = None
    analysis_date: date
    status: ResearchRunStatus = ResearchRunStatus.QUEUED
    recommendation: Recommendation = Recommendation.INSUFFICIENT_DATA
    confidence: float = Field(ge=0, le=1, default=0)
    research_depth: ResearchDepth = ResearchDepth.SHALLOW
    selected_analysts: list[str] = Field(default_factory=list)
    quick_model: str = "default-fast"
    deep_model: str = "default-research"
    source_surface: SourceSurface = SourceSurface.RESEARCH
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: datetime | None = None
    share_slug: str | None = None
    error_message: str | None = None
    disclaimer: str = DISCLAIMER
    data_snapshot_id: UUID | None = None
    final_summary: str | None = None
    main_upside: str | None = None
    main_risk: str | None = None


class EquityResearchRunDetail(BaseModel):
    run: EquityResearchRun
    snapshot: EquityResearchSnapshot | None = None
    reports: list[EquityResearchReport] = Field(default_factory=list)
    latest_events: list[EquityResearchEvent] = Field(default_factory=list)


class EquityResearchShareUpdate(BaseModel):
    shared: bool = True


class PublicEquityResearchReport(BaseModel):
    run: EquityResearchRun
    reports: list[EquityResearchReport]
    snapshot: EquityResearchSnapshot | None = None
