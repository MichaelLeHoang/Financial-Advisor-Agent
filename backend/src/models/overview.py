from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

OverviewTone = Literal["positive", "neutral", "negative", "info"]
OverviewVerdict = Literal[
    "buy",
    "hold",
    "sell",
    "bullish",
    "neutral",
    "bearish",
    "insufficient_data",
]


class OverviewMetric(BaseModel):
    label: str
    value: str
    tone: OverviewTone = "neutral"


class OverviewSource(BaseModel):
    label: str
    source: str
    url: str | None = None


class OverviewPoint(BaseModel):
    title: str
    detail: str
    sources: list[OverviewSource] = Field(default_factory=list)
    tone: OverviewTone = "neutral"


class Overview(BaseModel):
    title: str
    verdict: OverviewVerdict = "neutral"
    summary: str
    metrics: list[OverviewMetric] = Field(default_factory=list)
    catalysts: list[OverviewPoint] = Field(default_factory=list)
    risks: list[OverviewPoint] = Field(default_factory=list)
    sources: list[OverviewSource] = Field(default_factory=list)
    next_questions: list[str] = Field(default_factory=list)
    disclaimer: str = (
        "This is AI-generated analysis, not professional financial advice."
    )
