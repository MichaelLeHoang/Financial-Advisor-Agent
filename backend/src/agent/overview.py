from __future__ import annotations

import re
from typing import Any

from src.agent.consensus import ConsensusResult, Verdict
from src.agent.market_grounding import MarketGroundingResult
from src.models.equity_research import (
    EquityResearchReport,
    EquityResearchRun,
    EquityResearchSnapshot,
)
from src.models.overview import (
    Overview,
    OverviewAssetAssessment,
    OverviewMetric,
    OverviewPoint,
    OverviewSource,
)

DISCLAIMER = "This is AI-generated analysis, not professional financial advice."

_DECISION_TERMS = (
    "should i buy",
    "should i sell",
    "should i hold",
    "buy",
    "sell",
    "hold",
    "invest",
    "investment",
    "stock",
)


def overview_to_metadata(overview: Overview | None) -> dict[str, Any] | None:
    return {"overview": overview.model_dump()} if overview else None


def build_market_quote_overview(
    message: str, grounded: MarketGroundingResult
) -> Overview | None:
    quote = grounded.quote
    if not quote:
        return None
    change = quote.daily_change
    verdict = (
        "bullish"
        if isinstance(change, (int, float)) and change > 1
        else (
            "bearish" if isinstance(change, (int, float)) and change < -1 else "neutral"
        )
    )
    price = _money(quote.price, quote.currency)
    move = _pct(change)
    title = f"{quote.company_name} ({quote.ticker})"
    summary = (
        f"{title} is trading at {price}"
        + (f", with a latest daily move of {move}" if move != "Unavailable" else "")
        + ". This is a market snapshot, not a buy or sell recommendation."
    )
    return Overview(
        title=title,
        verdict=verdict,
        summary=summary,
        metrics=[
            OverviewMetric(label="Price", value=price, tone="neutral"),
            OverviewMetric(
                label="Daily Move", value=move, tone=_tone_for_number(change)
            ),
            OverviewMetric(
                label="Market Status", value=quote.market_status, tone="info"
            ),
            OverviewMetric(
                label="Exchange", value=quote.exchange or "Unavailable", tone="neutral"
            ),
        ],
        catalysts=[
            OverviewPoint(
                title="Latest quote resolved",
                detail=f"The answer used the current public ticker {quote.ticker} and latest available quote data.",
                sources=_sources_from_labels(quote.data_sources or quote.tool_used),
                tone="info",
            )
        ],
        risks=[
            OverviewPoint(
                title="Limited decision context",
                detail="A quote-only answer does not include valuation, fundamentals, news, sentiment, or portfolio fit.",
                tone="neutral",
            )
        ],
        sources=_sources_from_labels(quote.data_sources or quote.tool_used),
        next_questions=[
            f"Should I buy, sell, or hold {quote.ticker}?",
            f"What catalysts could move {quote.ticker} next?",
            f"Compare {quote.ticker} with its closest peers.",
        ],
        disclaimer=DISCLAIMER,
    )


def build_single_response_overview(
    message: str, response_text: str, messages: list[Any]
) -> Overview | None:
    if not _is_stock_overview_intent(message):
        return None
    evidence_text = "\n".join(_message_content(item) for item in messages)
    combined = f"{evidence_text}\n{response_text}"
    ticker = _extract_ticker(combined) or _extract_ticker(message)
    if not ticker:
        return None
    company = _extract_line(combined, r"Company:\s*([^\n]+)") or ticker
    if company.upper() == ticker:
        title = ticker
    else:
        title = f"{company} ({ticker})"
    verdict = _verdict_from_text(response_text)
    decision_prompt = _is_decision_prompt(message)
    explicit_decision = _has_explicit_decision_language(response_text)
    if (
        decision_prompt
        and not explicit_decision
        and verdict
        in {
            "neutral",
            "bullish",
            "bearish",
        }
    ):
        verdict = "hold"
    summary = (
        _first_readable_paragraph(response_text)
        or f"{title} has mixed evidence based on the available tools."
    )
    if decision_prompt and not _summary_answers_decision(summary):
        summary = _decision_summary(title, verdict)
    metrics = _metrics_from_text(combined)
    sources = _sources_from_text(combined)
    catalysts = _points_from_text(
        response_text, positive=True, fallback_sources=sources
    )
    risks = _points_from_text(response_text, positive=False, fallback_sources=sources)
    if not catalysts:
        catalysts = [
            OverviewPoint(
                title="Evidence gathered",
                detail="The answer used available quote, news, sentiment, prediction, or market data before forming the response.",
                sources=sources[:2],
                tone="info",
            )
        ]
    if not risks:
        risks = [
            OverviewPoint(
                title="Decision still depends on fresh data",
                detail="The view can change with earnings, guidance, valuation shifts, technical breakdowns, or new company-specific news.",
                tone="neutral",
            )
        ]
    return Overview(
        title=title,
        verdict=verdict,
        summary=summary,
        metrics=metrics,
        catalysts=catalysts[:4],
        risks=risks[:4],
        sources=sources,
        next_questions=[
            f"What would make {ticker} a clearer buy?",
            f"What are the biggest risks for {ticker} over the next 12 months?",
            f"Compare {ticker} against its closest peers.",
        ],
        disclaimer=DISCLAIMER,
    )


def build_consensus_overview(query: str, result: ConsensusResult) -> Overview:
    if result.asset_results:
        symbols = [asset.symbol for asset in result.asset_results]
        title = " vs ".join(symbols)
    else:
        ticker = _extract_ticker(query) or "the asset"
        title = ticker if ticker == "the asset" else ticker.upper()
    verdict = _verdict_from_consensus(result.verdict)
    risk_flags = _unique([str(flag) for flag in result.risk_flags or []])
    opinions = list(result.opinions or [])
    catalysts = []
    risks = []
    for opinion in opinions:
        point = OverviewPoint(
            title=opinion.agent_name.replace("_", " ").title(),
            detail=_compact(opinion.reasoning, 280),
            tone=_tone_from_verdict_text(opinion.verdict.value),
        )
        if opinion.verdict == Verdict.BULLISH:
            catalysts.append(point)
        elif opinion.verdict == Verdict.BEARISH:
            risks.append(point)
        elif len(catalysts) <= len(risks):
            catalysts.append(point)
        else:
            risks.append(point)
    risks.extend(
        OverviewPoint(title="Risk flag", detail=flag, tone="negative")
        for flag in risk_flags[:3]
    )
    summary = result.summary or (
        f"Quanfora 2.0 rates {title} as {result.verdict.value.replace('_', ' ').title()} "
        f"with {result.confidence:.0%} confidence and {result.agreement_ratio:.0%} exact-verdict agreement."
    )
    if result.dissenting_agents:
        summary += f" Dissent came from {', '.join(result.dissenting_agents[:3])}."
    asset_assessments = [_asset_assessment(item) for item in result.asset_results]
    actual_sources = _overview_sources_from_assets(result.asset_results)
    return Overview(
        title=title,
        verdict=verdict,
        summary=summary,
        metrics=[
            OverviewMetric(
                label="Verdict",
                value=result.verdict.value.replace("_", " ").title(),
                tone=_tone_from_verdict_text(result.verdict.value),
            ),
            OverviewMetric(
                label="Confidence", value=f"{result.confidence:.0%}", tone="info"
            ),
            OverviewMetric(
                label="Exact agreement",
                value=f"{result.agreement_ratio:.0%}",
                tone="info",
            ),
            OverviewMetric(
                label="Evidence",
                value=result.evidence_status.replace("_", " ").title(),
                tone="info" if result.evidence_status == "complete" else "neutral",
            ),
        ],
        catalysts=catalysts[:4],
        risks=risks[:4]
        or [
            OverviewPoint(
                title="Risk review",
                detail="No severe consensus risk flag was returned, but the view should be refreshed as market data changes.",
                tone="neutral",
            )
        ],
        sources=actual_sources,
        asset_assessments=asset_assessments,
        limitations=_unique(result.limitations),
        next_questions=[
            f"What would change the consensus view on {title}?",
            f"Show the bull and bear case for {title}.",
            f"Generate a full Quanfora 2.1 research report for {title}.",
        ],
        disclaimer="This is AI-generated analysis from Quanfora 2.0's multi-agent consensus system, not professional financial advice.",
    )


def _asset_assessment(asset: Any) -> OverviewAssetAssessment:
    metrics = asset.metrics or {}
    trend = str(metrics.get("trend_label") or "unavailable").replace("_", " ").title()
    sources = [
        OverviewSource(
            label=str(item.get("label") or item.get("source") or "Market evidence"),
            source=str(item.get("source") or "unknown"),
            url=item.get("url"),
        )
        for item in asset.sources
    ]
    return OverviewAssetAssessment(
        symbol=asset.symbol,
        company_name=asset.company_name,
        verdict=_verdict_from_consensus(asset.verdict),
        confidence=asset.confidence,
        agreement=asset.agreement_ratio,
        evidence_status=asset.evidence_status,
        evidence_coverage=asset.evidence_coverage,
        as_of=asset.as_of,
        metrics=[
            OverviewMetric(label="Price", value=_money(metrics.get("latest_price"))),
            OverviewMetric(
                label="20-day momentum",
                value=_pct(metrics.get("momentum_20d")),
                tone=_tone_for_number(metrics.get("momentum_20d")),
            ),
            OverviewMetric(
                label="60-day momentum",
                value=_pct(metrics.get("momentum_60d")),
                tone=_tone_for_number(metrics.get("momentum_60d")),
            ),
            OverviewMetric(
                label="Realized volatility",
                value=_pct(metrics.get("annualized_volatility")),
                tone="negative"
                if metrics.get("annualized_volatility", 0) >= 0.6
                else "neutral",
            ),
            OverviewMetric(
                label="Max drawdown",
                value=_pct(metrics.get("max_drawdown")),
                tone="negative",
            ),
            OverviewMetric(label="Trend", value=trend, tone="info"),
        ],
        risks=[
            OverviewPoint(title="Measured risk", detail=flag, tone="negative")
            for flag in asset.risk_flags
        ],
        limitations=_unique(asset.limitations),
        sources=sources,
    )


def _overview_sources_from_assets(assets: list[Any]) -> list[OverviewSource]:
    sources: list[OverviewSource] = []
    seen: set[tuple[str, str | None]] = set()
    for asset in assets:
        for item in asset.sources:
            source = str(item.get("source") or "unknown")
            url = item.get("url")
            key = (source.casefold(), url)
            if key in seen:
                continue
            seen.add(key)
            sources.append(
                OverviewSource(
                    label=str(item.get("label") or source),
                    source=source,
                    url=url,
                )
            )
    return sources[:12]


def build_research_overview(
    run: EquityResearchRun,
    snapshot: EquityResearchSnapshot,
    reports: list[EquityResearchReport],
    *,
    label: str,
    summary: str,
) -> Overview:
    ticker = run.ticker
    title = f"{snapshot.company_name or run.company_name or ticker} ({ticker})"
    fundamentals = snapshot.fundamentals
    tech = snapshot.technical_indicators
    sentiment = snapshot.sentiment_summary
    risk_flags = _unique([flag for report in reports for flag in report.risk_flags])
    sources = _sources_from_snapshot(snapshot)
    catalysts = _research_points(snapshot, reports, positive=True, sources=sources)
    risks = _research_points(snapshot, reports, positive=False, sources=sources)
    return Overview(
        title=title,
        verdict=_verdict_from_text(label),
        summary=summary,
        metrics=[
            OverviewMetric(
                label="Verdict", value=label, tone=_tone_from_verdict_text(label)
            ),
            OverviewMetric(
                label="Price", value=_money(snapshot.latest_price), tone="neutral"
            ),
            OverviewMetric(
                label="Daily Move",
                value=_pct(snapshot.daily_change),
                tone=_tone_for_number(snapshot.daily_change),
            ),
            OverviewMetric(
                label="Market Cap", value=_money(snapshot.market_cap), tone="neutral"
            ),
            OverviewMetric(
                label="P/E", value=_fmt(fundamentals.get("trailing_pe")), tone="neutral"
            ),
            OverviewMetric(label="RSI", value=_fmt(tech.get("rsi_14")), tone="neutral"),
            OverviewMetric(
                label="Sentiment",
                value=str(sentiment.get("signal", "limited")).title(),
                tone="info",
            ),
            OverviewMetric(
                label="Risk Flags",
                value=str(len(risk_flags)),
                tone="negative" if risk_flags else "positive",
            ),
        ],
        catalysts=catalysts,
        risks=risks,
        sources=sources,
        next_questions=[
            f"What would make {ticker} a stronger buy?",
            f"What would invalidate the {label.lower()} view on {ticker}?",
            f"Compare {ticker} against its closest peers.",
            f"Show the technical levels to watch for {ticker}.",
        ],
        disclaimer=run.disclaimer,
    )


def _research_points(
    snapshot: EquityResearchSnapshot,
    reports: list[EquityResearchReport],
    *,
    positive: bool,
    sources: list[OverviewSource],
) -> list[OverviewPoint]:
    agent_keys = (
        ("bull", "fundamentals", "news", "market")
        if positive
        else ("bear", "safe", "neutral", "risky")
    )
    points = [
        point
        for key in agent_keys
        for report in reports
        if report.agent_key == key
        for point in report.summary_points
    ]
    if positive:
        points.extend(
            item.get("title", "")
            for item in snapshot.news_items[:2]
            if item.get("title")
        )
    else:
        points.extend(flag for report in reports for flag in report.risk_flags)
    return [
        OverviewPoint(
            title=_point_title(text, "Catalyst" if positive else "Risk"),
            detail=_compact(text, 260),
            sources=sources[:2],
            tone="positive" if positive else "negative",
        )
        for text in _unique([str(item) for item in points if item])[:4]
    ] or [
        OverviewPoint(
            title="Evidence gap" if positive else "Risk context",
            detail="The available snapshot has limited source-backed items for this section.",
            tone="neutral",
        )
    ]


def _metrics_from_text(text: str) -> list[OverviewMetric]:
    candidates = [
        (
            "Price",
            _extract_line(text, r"(?:Latest Price|Current price):\s*\$?([0-9,.]+)"),
            "neutral",
        ),
        ("Daily Move", _extract_line(text, r"Daily Change:\s*([+-]?[0-9,.]+%?)"), None),
        ("Market Mood", _extract_line(text, r"Market Mood:\s*([A-Z ]+)"), "info"),
        ("Sentiment", _extract_line(text, r"Signal:\s*([A-Za-z_ -]+)"), "info"),
        ("Final Signal", _extract_line(text, r"Final Signal:\s*([^\n]+)"), None),
        ("Confidence", _extract_line(text, r"Confidence:\s*([^\n.]+)"), "info"),
        (
            "Valuation Target",
            _extract_line(text, r"Valuation Target:\s*\$?([0-9,.]+)"),
            "neutral",
        ),
    ]
    metrics: list[OverviewMetric] = []
    for label, value, tone in candidates:
        if not value:
            continue
        display = (
            f"${value}"
            if label in {"Price", "Valuation Target"} and not value.startswith("$")
            else value
        )
        metrics.append(
            OverviewMetric(
                label=label,
                value=display.strip(),
                tone=tone or _tone_from_verdict_text(value),
            )
        )
    return metrics[:8]


def _points_from_text(
    text: str, *, positive: bool, fallback_sources: list[OverviewSource]
) -> list[OverviewPoint]:
    keywords = (
        ("upside", "growth", "bull", "positive", "support", "strong", "buy", "catalyst")
        if positive
        else (
            "risk",
            "bear",
            "downside",
            "weak",
            "sell",
            "negative",
            "warning",
            "caveat",
        )
    )
    points = []
    for raw in re.split(r"\n+|(?<=\.)\s+", text):
        line = re.sub(r"^[\-*#\d.\s]+", "", raw).strip()
        if len(line) < 35 or not any(keyword in line.lower() for keyword in keywords):
            continue
        points.append(
            OverviewPoint(
                title=_point_title(line, "Catalyst" if positive else "Risk"),
                detail=_compact(line, 260),
                sources=fallback_sources[:2],
                tone="positive" if positive else "negative",
            )
        )
        if len(points) >= 4:
            break
    return points


def _sources_from_snapshot(snapshot: EquityResearchSnapshot) -> list[OverviewSource]:
    sources = []
    for item in snapshot.evidence_items[:6]:
        sources.append(
            OverviewSource(
                label=str(item.get("label") or item.get("source") or "Evidence"),
                source=str(item.get("source") or "snapshot"),
                url=item.get("url"),
            )
        )
    sources.extend(_sources_from_labels(snapshot.data_sources))
    return _dedupe_sources(sources)[:8]


def _sources_from_text(text: str) -> list[OverviewSource]:
    sources = []
    for label in re.findall(r"Data Sources?:\s*([^\n]+)", text, flags=re.IGNORECASE):
        sources.extend(_sources_from_labels(re.split(r",|;", label)))
    for publisher, title, url in re.findall(
        r"\[([^\]]+)\]\s+\[([^\]]+)\]\(([^)]+)\)", text
    ):
        sources.append(OverviewSource(label=title, source=publisher, url=url))
    return _dedupe_sources(sources)[:8]


def _sources_from_labels(labels: list[Any]) -> list[OverviewSource]:
    return _dedupe_sources(
        [
            OverviewSource(
                label=str(label).strip().replace("_", " ").title(),
                source=str(label).strip(),
            )
            for label in labels
            if str(label).strip()
        ]
    )


def _dedupe_sources(sources: list[OverviewSource]) -> list[OverviewSource]:
    seen = set()
    deduped = []
    for source in sources:
        key = (source.label, source.source, source.url)
        if key in seen:
            continue
        seen.add(key)
        deduped.append(source)
    return deduped


def _is_stock_overview_intent(message: str) -> bool:
    lower = message.lower()
    return any(term in lower for term in _DECISION_TERMS) and bool(
        _extract_ticker(message) or re.search(r"\b[A-Z]{2,5}\b", message.upper())
    )


def _is_decision_prompt(message: str) -> bool:
    lower = message.lower()
    return any(
        phrase in lower
        for phrase in (
            "should i buy",
            "should i sell",
            "should i hold",
            "should i invest",
            "is it a buy",
            "buy or sell",
            "buy, sell, or hold",
            "buy sell or hold",
        )
    )


def _summary_answers_decision(summary: str) -> bool:
    lower = summary.lower().lstrip()
    direct_openers = (
        "yes",
        "no",
        "hold",
        "wait",
        "avoid",
        "sell",
        "buy",
        "insufficient data",
    )
    return lower.startswith(direct_openers) or any(
        phrase in lower[:180]
        for phrase in (
            "looks like a buy",
            "looks like a hold",
            "looks like a sell",
            "does not look like a buy",
            "buy candidate",
            "hold candidate",
            "sell candidate",
            "watchlist",
        )
    )


def _decision_summary(title: str, verdict: str) -> str:
    if verdict in {"buy", "bullish"}:
        return (
            f"Yes, {title} looks like a Buy candidate based on the available "
            "tool-backed evidence, but position sizing should still account for valuation, volatility, and portfolio fit."
        )
    if verdict in {"sell", "bearish"}:
        return (
            f"No, {title} does not look attractive enough to buy here based on the available "
            "tool-backed evidence; review the risks and invalidation points before acting."
        )
    if verdict == "insufficient_data":
        return (
            f"Insufficient data to make a buy or sell call on {title}. The available evidence "
            "does not support a source-backed recommendation yet."
        )
    return (
        f"Hold/Wait on {title} for now: the available evidence is useful, but it does not "
        "establish a clear source-backed buy or sell call."
    )


def _has_explicit_decision_language(text: str) -> bool:
    lower = text.lower()
    return any(
        phrase in lower
        for phrase in (
            "strong buy",
            "compelling buy",
            "looks like a buy",
            "buy candidate",
            "looks like a hold",
            "hold candidate",
            "hold/wait",
            "looks like a sell",
            "sell candidate",
            "avoid buying",
            "do not buy",
            "does not look like a buy",
            "should buy",
            "should sell",
            "should hold",
        )
    )


def _message_content(message: Any) -> str:
    content = getattr(message, "content", None)
    if content is None and isinstance(message, dict):
        content = message.get("content")
    if isinstance(content, list):
        return "\n".join(str(part) for part in content)
    return str(content or "")


def _extract_ticker(text: str) -> str | None:
    for pattern in (
        r"\(([A-Z][A-Z0-9.-]{0,5})\)",
        r"\b(?:Ticker|Stock):\s*([A-Z][A-Z0-9.-]{0,5})\b",
        r"\b([A-Z]{2,5})\b",
    ):
        match = re.search(pattern, text)
        if match:
            token = match.group(1).upper()
            if token not in {"USD", "AI", "CEO", "EPS", "PE", "ETF"}:
                return token
    return None


def _extract_line(text: str, pattern: str) -> str | None:
    match = re.search(pattern, text, flags=re.IGNORECASE)
    return match.group(1).strip() if match else None


def _first_readable_paragraph(text: str) -> str | None:
    for part in re.split(r"\n{2,}", text):
        clean = re.sub(r"[*_`#>-]", "", part).strip()
        if (
            len(clean) >= 80
            and "not professional financial advice" not in clean.lower()
        ):
            return _compact(clean, 460)
    return None


def _point_title(text: str, fallback: str) -> str:
    clean = re.sub(r"[*_`#>-]", "", text).strip()
    if ":" in clean[:90]:
        return clean.split(":", 1)[0][:80]
    words = clean.split()
    return " ".join(words[:7]).rstrip(".") or fallback


def _verdict_from_consensus(verdict: Verdict) -> str:
    if verdict == Verdict.BULLISH:
        return "bullish"
    if verdict == Verdict.BEARISH:
        return "bearish"
    if verdict == Verdict.HOLD:
        return "hold"
    if verdict == Verdict.INSUFFICIENT_DATA:
        return "insufficient_data"
    if verdict == Verdict.MIXED:
        return "mixed"
    return "neutral"


def _verdict_from_text(text: str) -> str:
    lower = text.lower()
    if "insufficient" in lower or "unavailable" in lower:
        return "insufficient_data"
    if "strong buy" in lower or re.search(r"\bbuy\b", lower) or "bullish" in lower:
        return "buy" if "buy" in lower else "bullish"
    if re.search(r"\bsell\b", lower) or "avoid" in lower or "bearish" in lower:
        return "sell" if "sell" in lower or "avoid" in lower else "bearish"
    if "hold" in lower or "watchlist" in lower:
        return "hold"
    return "neutral"


def _tone_from_verdict_text(text: str) -> str:
    lower = text.lower()
    if any(
        token in lower for token in ("buy", "bullish", "positive", "upside", "strong")
    ):
        return "positive"
    if any(
        token in lower for token in ("sell", "bearish", "avoid", "negative", "risk")
    ):
        return "negative"
    if "unavailable" in lower or "insufficient" in lower:
        return "neutral"
    return "neutral"


def _tone_for_number(value: float | None) -> str:
    if value is None:
        return "neutral"
    return "positive" if value > 0 else "negative" if value < 0 else "neutral"


def _money(value: float | None, currency: str | None = "USD") -> str:
    if value is None:
        return "Unavailable"
    prefix = "$" if (currency or "USD").upper() in {"USD", "CAD"} else ""
    if abs(value) >= 1_000_000_000_000:
        return f"{prefix}{value / 1_000_000_000_000:,.2f}T"
    if abs(value) >= 1_000_000_000:
        return f"{prefix}{value / 1_000_000_000:,.2f}B"
    if abs(value) >= 1_000_000:
        return f"{prefix}{value / 1_000_000:,.2f}M"
    return f"{prefix}{value:,.2f}"


def _pct(value: float | None) -> str:
    if value is None:
        return "Unavailable"
    return f"{value * 100:,.2f}%" if abs(value) <= 1 else f"{value:,.2f}%"


def _fmt(value: Any) -> str:
    return f"{value:,.2f}" if isinstance(value, (int, float)) else "Unavailable"


def _compact(text: str, limit: int) -> str:
    clean = re.sub(r"\s+", " ", str(text or "")).strip()
    return f"{clean[: limit - 3].rstrip()}..." if len(clean) > limit else clean


def _unique(items: list[str]) -> list[str]:
    unique = []
    for item in items:
        compact = _compact(item, 320)
        if compact and compact not in unique:
            unique.append(compact)
    return unique
