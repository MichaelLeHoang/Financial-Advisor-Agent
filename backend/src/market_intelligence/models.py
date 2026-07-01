from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal

from pydantic import BaseModel, Field


class InsightSource(BaseModel):
    title: str
    url: str | None = None
    publisher: str | None = None
    published_at: datetime | None = None


class ImpactScoreBreakdown(BaseModel):
    freshness: float
    relevance: float
    sentiment: float
    price_volume: float
    source_quality: float
    risk_penalty: float
    final_score: float


class NewsBriefCard(BaseModel):
    id: str
    headline: str
    summary: str
    tickers: list[str]
    categories: list[str]
    sentiment: Literal["bullish", "neutral", "bearish"]
    impact_score: float
    confidence: float
    why_it_matters: str
    risk_flags: list[str]
    sources: list[InsightSource]
    published_at: datetime | None = None
    score_breakdown: ImpactScoreBreakdown | None = None


class TodayPickCard(BaseModel):
    id: str
    ticker: str
    company_name: str | None = None
    current_price: float | None = None
    daily_change_pct: float | None = None
    thesis: str
    label: str
    opportunity_score: float
    confidence: float
    risk_level: Literal["low", "medium", "high", "critical"]
    key_evidence: list[str]
    risk_flags: list[str]
    related_news_count: int
    sources: list[InsightSource]


class ResearchReport(BaseModel):
    id: str
    title: str
    executive_summary: str
    affected_tickers: list[str]
    sections: dict[str, str]
    bull_case: list[str]
    bear_case: list[str]
    risk_flags: list[str]
    signal_summary: dict[str, Any] = Field(default_factory=dict)
    sources: list[InsightSource]
    what_to_watch_next: list[str] = Field(default_factory=list)
    disclaimer: str = (
        "This report is informational market research, not financial advice or a recommendation to buy or sell securities."
    )
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class MarketIntelligenceResponse(BaseModel):
    briefing: list[NewsBriefCard]
    picks: list[TodayPickCard]
    reports: list[ResearchReport]
    categories_fetched: list[str]
    total_sources: int
    sources_attempted: int = 0
    sources_succeeded: int = 0
    sources_failed: int = 0
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
