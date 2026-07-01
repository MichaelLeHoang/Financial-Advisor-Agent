from __future__ import annotations

import hashlib
from collections import defaultdict
from datetime import datetime, timezone

from src.api.news_routes import CATEGORY_MAP, NewsArticle, NewsResponse, get_news
from src.market_intelligence.models import (
    InsightSource,
    MarketIntelligenceResponse,
    NewsBriefCard,
    ResearchReport,
    TodayPickCard,
)
from src.market_intelligence.scoring import (
    confidence_score,
    impact_breakdown,
    keyword_sentiment,
    parse_datetime,
    risk_flags,
    risk_level,
)


def _stable_id(prefix: str, *parts: str) -> str:
    raw = ":".join(parts)
    digest = hashlib.sha256(raw.encode()).hexdigest()[:16]
    return f"{prefix}_{digest}"


def _category_label(category: str) -> str:
    return CATEGORY_MAP.get(category, {}).get("label", category.replace("_", " ").title())


def _clean_tickers(tickers: list[str]) -> list[str]:
    cleaned = []
    for ticker in tickers:
        symbol = ticker.strip().upper()
        if not symbol or symbol in cleaned:
            continue
        cleaned.append(symbol)
    return cleaned[:6]


def _source_from_article(article: NewsArticle) -> InsightSource:
    return InsightSource(
        title=article.title,
        url=article.url or None,
        publisher=article.publisher or None,
        published_at=parse_datetime(article.published_at),
    )


def _editorial_summary(article: NewsArticle, sentiment: str, categories: list[str]) -> str:
    if article.summary.strip():
        return article.summary.strip()
    category_text = ", ".join(categories) if categories else "market"
    return (
        f"{article.title.strip()} The item is being tracked as a {sentiment} catalyst for the "
        f"{category_text} tape until stronger source evidence confirms or rejects the setup."
    )


def _why_it_matters(article: NewsArticle, tickers: list[str], sentiment: str) -> str:
    if tickers:
        ticker_text = ", ".join(tickers[:4])
        return (
            f"This may affect {ticker_text} because the headline can change near-term expectations, "
            f"positioning, or risk appetite. Treat the {sentiment} read as provisional until price action and additional sources confirm it."
        )
    return (
        "This is relevant to the selected market themes because it may influence sector positioning, liquidity, or macro risk appetite. "
        "Ticker-level impact is less certain because the source did not identify a focused symbol set."
    )


def build_briefing_cards(news: NewsResponse) -> list[NewsBriefCard]:
    cards: list[NewsBriefCard] = []
    for article in news.articles:
        text = f"{article.title} {article.summary}"
        sentiment, sentiment_strength = keyword_sentiment(text)
        flags = risk_flags(text)
        published_at = parse_datetime(article.published_at)
        tickers = _clean_tickers(article.tickers)
        categories = [_category_label(article.category)] if article.category else []
        summary = _editorial_summary(article, sentiment, categories)
        breakdown = impact_breakdown(
            published_at=published_at,
            publisher=article.publisher,
            url=article.url,
            tickers=tickers,
            categories=categories,
            summary=summary,
            sentiment_strength=sentiment_strength,
            risk_count=len(flags),
        )
        cards.append(
            NewsBriefCard(
                id=_stable_id("brief", article.id, article.title),
                headline=article.title,
                summary=summary,
                tickers=tickers,
                categories=categories,
                sentiment=sentiment,
                impact_score=breakdown.final_score,
                confidence=confidence_score(
                    source_count=1,
                    has_summary=bool(article.summary.strip()),
                    has_ticker=bool(tickers),
                    risk_count=len(flags),
                ),
                why_it_matters=_why_it_matters(article, tickers, sentiment),
                risk_flags=flags or ["Single-source read; verify against price action and follow-up reporting."],
                sources=[_source_from_article(article)],
                published_at=published_at,
                score_breakdown=breakdown,
            )
        )

    return sorted(cards, key=lambda card: (card.impact_score, _timestamp(card.published_at)), reverse=True)


def _timestamp(value: datetime | None) -> float:
    if value is None:
        return 0
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.timestamp()


def build_today_picks(briefing: list[NewsBriefCard]) -> list[TodayPickCard]:
    by_ticker: dict[str, list[NewsBriefCard]] = defaultdict(list)
    for card in briefing:
        for ticker in card.tickers:
            by_ticker[ticker].append(card)

    picks: list[TodayPickCard] = []
    for ticker, cards in by_ticker.items():
        if ticker.startswith("^"):
            continue
        avg_score = sum(card.impact_score for card in cards) / len(cards)
        confidence = sum(card.confidence for card in cards) / len(cards)
        risks = []
        for card in cards:
            for flag in card.risk_flags:
                if flag not in risks:
                    risks.append(flag)
        sentiment_counts = {value: sum(1 for card in cards if card.sentiment == value) for value in ("bullish", "neutral", "bearish")}
        dominant_sentiment = max(sentiment_counts, key=sentiment_counts.get)
        label = _pick_label(dominant_sentiment, avg_score, risks)
        evidence = [card.headline for card in sorted(cards, key=lambda card: card.impact_score, reverse=True)[:4]]
        thesis = _pick_thesis(ticker, dominant_sentiment, label, cards)
        sources = []
        for card in cards:
            for source in card.sources:
                if source.url not in {existing.url for existing in sources}:
                    sources.append(source)

        picks.append(
            TodayPickCard(
                id=_stable_id("pick", ticker, ",".join(card.id for card in cards)),
                ticker=ticker,
                thesis=thesis,
                label=label,
                opportunity_score=round(min(avg_score + min(len(cards), 4) * 3, 96), 1),
                confidence=round(min(confidence + min(len(cards), 3) * 3, 94), 1),
                risk_level=risk_level(risks, dominant_sentiment, avg_score),
                key_evidence=evidence,
                risk_flags=risks[:5] or ["Needs confirmation from additional sources and market response."],
                related_news_count=len(cards),
                sources=sources[:6],
            )
        )

    return sorted(picks, key=lambda pick: (pick.opportunity_score, pick.confidence), reverse=True)[:8]


def _pick_label(sentiment: str, score: float, risks: list[str]) -> str:
    if risks and sentiment == "bearish":
        return "Risk elevated"
    if score >= 76 and sentiment == "bullish":
        return "Momentum setup"
    if score >= 68:
        return "Research opportunity"
    if sentiment == "neutral":
        return "Needs confirmation"
    return "Watchlist candidate"


def _pick_thesis(ticker: str, sentiment: str, label: str, cards: list[NewsBriefCard]) -> str:
    theme = cards[0].categories[0] if cards and cards[0].categories else "selected market theme"
    return (
        f"{ticker} is flagged as a {label.lower()} because recent {theme} coverage has a {sentiment} evidence balance "
        f"across {len(cards)} related source item(s). This is a research queue item, not a trade instruction."
    )


def build_reports(briefing: list[NewsBriefCard], picks: list[TodayPickCard]) -> list[ResearchReport]:
    reports: list[ResearchReport] = []
    for pick in picks[:5]:
        related = [card for card in briefing if pick.ticker in card.tickers]
        if not related:
            continue
        top = related[0]
        risks = pick.risk_flags[:5]
        sources = pick.sources[:8]
        sections = {
            "what_happened": " ".join(card.summary for card in related[:3]),
            "why_it_matters": top.why_it_matters,
            "signal_summary": (
                f"Opportunity score {pick.opportunity_score:.1f}/100, confidence {pick.confidence:.1f}/100, "
                f"risk level {pick.risk_level}. Label: {pick.label}."
            ),
            "what_to_watch_next": (
                "Watch whether follow-up reporting confirms the catalyst, whether the ticker holds its opening reaction, "
                "and whether broader sector or index moves support the same thesis."
            ),
        }
        reports.append(
            ResearchReport(
                id=_stable_id("report", pick.id, pick.ticker),
                title=f"{pick.ticker} Market Intelligence Memo",
                executive_summary=pick.thesis,
                affected_tickers=[pick.ticker],
                sections=sections,
                bull_case=[
                    "Multiple source items point to a tradable catalyst worth deeper review.",
                    "A confirmed market reaction could improve the quality of the setup.",
                    "Related category momentum may support the thesis if breadth remains constructive.",
                ],
                bear_case=[
                    "The evidence may be single-day news flow rather than durable fundamental change.",
                    "Headline risk can reverse quickly if follow-up reporting contradicts the initial read.",
                    "The setup should be rejected if price action fails to confirm the catalyst.",
                ],
                risk_flags=risks,
                signal_summary={
                    "label": pick.label,
                    "opportunity_score": pick.opportunity_score,
                    "confidence": pick.confidence,
                    "risk_level": pick.risk_level,
                    "related_news_count": pick.related_news_count,
                },
                sources=sources,
                what_to_watch_next=[
                    "Confirm whether additional reputable sources report the same catalyst.",
                    "Check price, volume, and sector breadth before treating the setup as actionable.",
                    "Escalate to Quanfora 2.1 deep analysis for a full evidence review.",
                ],
            )
        )
    return reports


def build_market_intelligence_from_news(news: NewsResponse) -> MarketIntelligenceResponse:
    briefing = build_briefing_cards(news)
    picks = build_today_picks(briefing)
    reports = build_reports(briefing, picks)
    return MarketIntelligenceResponse(
        briefing=briefing,
        picks=picks,
        reports=reports,
        categories_fetched=news.categories_fetched,
        total_sources=len(news.articles),
        sources_attempted=news.sources_attempted,
        sources_succeeded=news.sources_succeeded,
        sources_failed=news.sources_failed,
    )


async def build_market_intelligence(categories: list[str], limit: int = 30) -> MarketIntelligenceResponse:
    raw_news = await get_news(categories=",".join(categories), limit=min(max(limit, 1), 50))
    return build_market_intelligence_from_news(raw_news)
