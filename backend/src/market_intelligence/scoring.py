from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal

from src.market_intelligence.models import ImpactScoreBreakdown


Sentiment = Literal["bullish", "neutral", "bearish"]
RiskLevel = Literal["low", "medium", "high", "critical"]

BULLISH_TERMS = {
    "beat",
    "beats",
    "bullish",
    "gain",
    "gains",
    "growth",
    "higher",
    "jump",
    "jumps",
    "profit",
    "rally",
    "record",
    "raises",
    "surge",
    "upgraded",
    "upgrade",
}

BEARISH_TERMS = {
    "bearish",
    "cuts",
    "downgrade",
    "downgraded",
    "drop",
    "falls",
    "fraud",
    "lawsuit",
    "miss",
    "probe",
    "recall",
    "risk",
    "slump",
    "warning",
    "weak",
}

RISK_TERMS = {
    "antitrust": "Regulatory scrutiny",
    "bankruptcy": "Solvency risk",
    "cuts": "Guidance or estimate cuts",
    "debt": "Balance sheet pressure",
    "default": "Credit stress",
    "delay": "Execution delay",
    "downgrade": "Analyst downgrade pressure",
    "fraud": "Fraud allegation",
    "investigation": "Investigation risk",
    "lawsuit": "Legal exposure",
    "layoffs": "Demand or margin pressure",
    "miss": "Earnings miss",
    "probe": "Regulatory or legal probe",
    "recall": "Product quality risk",
    "recession": "Macro demand risk",
    "volatility": "Elevated volatility",
    "warning": "Management or market warning",
}

HIGH_QUALITY_PUBLISHERS = {
    "associated press",
    "barrons.com",
    "bloomberg",
    "cnbc",
    "dow jones",
    "financial times",
    "marketwatch",
    "reuters",
    "the wall street journal",
    "yahoo finance",
}


def clamp(value: float, lower: float = 0, upper: float = 100) -> float:
    return max(lower, min(upper, value))


def parse_datetime(value: str | datetime | None) -> datetime | None:
    if isinstance(value, datetime):
        return value
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def keyword_sentiment(text: str) -> tuple[Sentiment, float]:
    normalized = text.lower()
    bullish_hits = sum(1 for term in BULLISH_TERMS if term in normalized)
    bearish_hits = sum(1 for term in BEARISH_TERMS if term in normalized)
    if bullish_hits > bearish_hits:
        return "bullish", min(1, (bullish_hits - bearish_hits) / 3)
    if bearish_hits > bullish_hits:
        return "bearish", min(1, (bearish_hits - bullish_hits) / 3)
    return "neutral", 0.25 if bullish_hits or bearish_hits else 0


def risk_flags(text: str) -> list[str]:
    normalized = text.lower()
    flags = []
    for term, label in RISK_TERMS.items():
        if term in normalized and label not in flags:
            flags.append(label)
    return flags[:5]


def freshness_score(published_at: datetime | None) -> float:
    if published_at is None:
        return 42
    now = datetime.now(timezone.utc)
    if published_at.tzinfo is None:
        published_at = published_at.replace(tzinfo=timezone.utc)
    age_hours = max((now - published_at).total_seconds() / 3600, 0)
    if age_hours <= 6:
        return 100
    if age_hours <= 24:
        return 84
    if age_hours <= 72:
        return 68
    if age_hours <= 168:
        return 52
    return 35


def source_quality_score(publisher: str | None, url: str | None) -> float:
    publisher_key = (publisher or "").strip().lower()
    if publisher_key in HIGH_QUALITY_PUBLISHERS:
        return 88
    if url:
        return 70
    return 48


def relevance_score(tickers: list[str], categories: list[str], summary: str) -> float:
    score = 45
    if tickers:
        score += min(len(tickers), 4) * 10
    if categories:
        score += min(len(categories), 2) * 7
    if len(summary.strip()) > 80:
        score += 8
    return clamp(score)


def impact_breakdown(
    *,
    published_at: datetime | None,
    publisher: str | None,
    url: str | None,
    tickers: list[str],
    categories: list[str],
    summary: str,
    sentiment_strength: float,
    risk_count: int,
) -> ImpactScoreBreakdown:
    freshness = freshness_score(published_at)
    relevance = relevance_score(tickers, categories, summary)
    sentiment = 50 + sentiment_strength * 35
    price_volume = 45 + min(len(tickers), 3) * 8
    source_quality = source_quality_score(publisher, url)
    risk_penalty = min(risk_count * 7, 28)
    final_score = clamp(
        freshness * 0.22
        + relevance * 0.28
        + sentiment * 0.16
        + price_volume * 0.12
        + source_quality * 0.16
        - risk_penalty
        + 6
    )
    return ImpactScoreBreakdown(
        freshness=round(freshness, 1),
        relevance=round(relevance, 1),
        sentiment=round(sentiment, 1),
        price_volume=round(price_volume, 1),
        source_quality=round(source_quality, 1),
        risk_penalty=round(risk_penalty, 1),
        final_score=round(final_score, 1),
    )


def confidence_score(*, source_count: int, has_summary: bool, has_ticker: bool, risk_count: int) -> float:
    score = 48 + min(source_count, 4) * 8
    if has_summary:
        score += 10
    if has_ticker:
        score += 10
    if risk_count:
        score -= min(risk_count * 2, 8)
    return round(clamp(score, 30, 92), 1)


def risk_level(flags: list[str], sentiment: Sentiment, score: float) -> RiskLevel:
    if len(flags) >= 4 or (sentiment == "bearish" and score >= 82):
        return "critical"
    if len(flags) >= 2 or sentiment == "bearish":
        return "high"
    if flags or score < 58:
        return "medium"
    return "low"
