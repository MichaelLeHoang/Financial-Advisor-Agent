"""Mandatory runtime grounding for market-sensitive chat prompts."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

from src.agent.market_grounding import resolve_market_entity
from src.data.market_data_service import NormalizedMarketSnapshot, market_data_service


_TEMPORAL_TERMS = re.compile(
    r"\b(today|now|current|currently|latest|recent|recently|news|update|"
    r"this week|this month|earnings|guidance|filing|announced|happened|happening)\b",
    re.IGNORECASE,
)
_DECISION_TERMS = re.compile(
    r"\b(should i|buy|sell|hold|invest|investment|trade|position|risk|valuation|outlook)\b",
    re.IGNORECASE,
)
_MARKET_TERMS = re.compile(
    r"\b(stock|share|ticker|market|nasdaq|nyse|etf|index|price|quote|portfolio|"
    r"company|sector|industry|ipo|merger|acquisition|spin[- ]?off|delist)\b",
    re.IGNORECASE,
)
_PLATFORM_HELP_TERMS = re.compile(
    r"\b(how (?:do|can) i|subscription|billing|settings|keyboard shortcut|"
    r"paper trading|research mode|quanfora|this app|the platform)\b",
    re.IGNORECASE,
)
_BROAD_MARKET_TERMS = re.compile(
    r"\b(market (?:today|now|pulse|overview|outlook)|broad market|wall street|"
    r"s&p 500|nasdaq 100|dow jones|russell 2000)\b",
    re.IGNORECASE,
)
_TICKER_STOP_WORDS = {
    "AI",
    "API",
    "BUY",
    "CEO",
    "CFO",
    "ETF",
    "GDP",
    "HOLD",
    "IPO",
    "LLM",
    "NEWS",
    "NOW",
    "RISK",
    "SEC",
    "SELL",
    "TODAY",
    "USD",
}


@dataclass(frozen=True)
class GroundingSource:
    label: str
    source: str
    url: str | None = None
    published_at: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "label": self.label,
            "source": self.source,
            "url": self.url,
            "published_at": self.published_at,
        }


@dataclass
class CurrentMarketContext:
    required: bool
    status: str
    retrieved_at: str
    reasons: list[str] = field(default_factory=list)
    entity: str | None = None
    ticker: str | None = None
    company_name: str | None = None
    as_of: str | None = None
    facts: dict[str, Any] = field(default_factory=dict)
    sources: list[GroundingSource] = field(default_factory=list)
    limitations: list[str] = field(default_factory=list)

    @classmethod
    def not_required(cls) -> "CurrentMarketContext":
        return cls(
            required=False,
            status="not_required",
            retrieved_at=datetime.now(UTC).isoformat(),
        )

    def metadata(self) -> dict[str, Any]:
        return {
            "grounding": {
                "required": self.required,
                "status": self.status,
                "retrieved_at": self.retrieved_at,
                "as_of": self.as_of,
                "entity": self.entity,
                "ticker": self.ticker,
                "company_name": self.company_name,
                "reasons": self.reasons,
                "sources": [source.to_dict() for source in self.sources],
                "limitations": self.limitations,
            }
        }

    def prompt_block(self) -> str:
        if not self.required:
            return ""
        if self.status != "grounded":
            details = "; ".join(self.limitations) or "No current provider evidence was available."
            return (
                "CURRENT MARKET GROUNDING\n"
                f"Status: unavailable\nRetrieved at: {self.retrieved_at}\n"
                f"Limitations: {details}\n"
                "Instruction: Do not answer current market, company-status, price, news, or investment claims "
                "from model memory. State that current evidence could not be verified and identify what data is missing."
            )

        fact_lines = [
            f"- {key.replace('_', ' ').title()}: {_display_value(value)}"
            for key, value in self.facts.items()
            if value is not None and value != [] and value != {}
        ]
        source_lines = []
        for source in self.sources:
            label = f"{source.source}: {source.label}"
            if source.published_at:
                label += f" ({source.published_at})"
            if source.url:
                label += f" — {source.url}"
            source_lines.append(f"- {label}")
        limitation_lines = [f"- {item}" for item in self.limitations]
        return "\n".join(
            [
                "CURRENT MARKET GROUNDING",
                "This block was fetched at runtime and takes precedence over model memory.",
                "Status: grounded",
                f"Retrieved at: {self.retrieved_at}",
                f"Evidence as of: {self.as_of or self.retrieved_at}",
                f"Entity: {self.company_name or self.entity or 'Unavailable'}",
                f"Ticker: {self.ticker or 'Unavailable'}",
                "Facts:",
                *(fact_lines or ["- No normalized facts available."]),
                "Sources:",
                *(source_lines or ["- Configured market data service (URL unavailable)."]),
                "Limitations:",
                *(limitation_lines or ["- None reported by configured providers."]),
                "Instruction: Base all current claims on this evidence or on newer tool output. Include the evidence "
                "timestamp, cite linked sources using markdown links, distinguish latest-available from real-time data, "
                "and disclose limitations. Never override this block with older model knowledge.",
            ]
        )

    def augment(self, message: str) -> str:
        block = self.prompt_block()
        return f"{message}\n\n{block}" if block else message


def requires_fresh_evidence(message: str) -> tuple[bool, list[str]]:
    """Return whether a prompt needs runtime evidence and why."""
    clean = " ".join(message.split())
    if not clean or (_PLATFORM_HELP_TERMS.search(clean) and not _MARKET_TERMS.search(clean)):
        return False, []

    reasons: list[str] = []
    if _TEMPORAL_TERMS.search(clean):
        reasons.append("temporal_language")
    if _DECISION_TERMS.search(clean):
        reasons.append("financial_decision")
    if _MARKET_TERMS.search(clean):
        reasons.append("market_subject")
    if _extract_explicit_ticker(clean):
        reasons.append("ticker_reference")
    return bool(reasons), list(dict.fromkeys(reasons))


def build_current_market_context(message: str) -> CurrentMarketContext:
    """Build a source-aware evidence bundle before market-sensitive reasoning."""
    required, reasons = requires_fresh_evidence(message)
    if not required:
        return CurrentMarketContext.not_required()

    retrieved_at = datetime.now(UTC).isoformat()
    entity = extract_market_entity(message)
    if not entity:
        return CurrentMarketContext(
            required=True,
            status="unavailable",
            retrieved_at=retrieved_at,
            reasons=reasons,
            limitations=["No company, ticker, or broad-market entity could be resolved from the prompt."],
        )

    ticker, resolved_name = _resolve_entity(entity)
    if not ticker:
        return CurrentMarketContext(
            required=True,
            status="unavailable",
            retrieved_at=retrieved_at,
            reasons=reasons,
            entity=entity,
            limitations=[f"No current public-market identity could be verified for {entity}."],
        )

    try:
        snapshot = market_data_service.fetch_snapshot(
            ticker,
            period="1mo",
            interval="1d",
            include_news=True,
            include_sec=True,
            include_fundamentals=True,
        )
    except Exception as exc:
        return CurrentMarketContext(
            required=True,
            status="unavailable",
            retrieved_at=retrieved_at,
            reasons=reasons,
            entity=entity,
            ticker=ticker,
            company_name=resolved_name,
            limitations=[f"Current providers failed for {ticker}: {str(exc)[:180]}"],
        )

    return _context_from_snapshot(
        snapshot,
        entity=entity,
        resolved_name=resolved_name,
        reasons=reasons,
        retrieved_at=retrieved_at,
    )


def context_from_market_quote(grounded: Any) -> CurrentMarketContext:
    """Normalize the existing deterministic quote fast path into grounding metadata."""
    retrieved_at = datetime.now(UTC).isoformat()
    quote = getattr(grounded, "quote", None)
    if quote is None:
        return CurrentMarketContext(
            required=True,
            status="unavailable",
            retrieved_at=retrieved_at,
            reasons=["market_quote"],
            entity=getattr(grounded, "entity", None),
            limitations=["The market quote path returned no verifiable quote."],
        )
    labels = list(dict.fromkeys([*(quote.data_sources or []), *(quote.tool_used or [])]))
    return CurrentMarketContext(
        required=True,
        status="grounded",
        retrieved_at=retrieved_at,
        reasons=["market_quote"],
        entity=getattr(grounded, "entity", None),
        ticker=quote.ticker,
        company_name=quote.company_name,
        as_of=quote.latest_trade_time or retrieved_at,
        facts={
            "latest_price": quote.price,
            "currency": quote.currency,
            "daily_change_percent": quote.daily_change,
            "exchange": quote.exchange,
            "market_status": quote.market_status,
        },
        sources=[GroundingSource(label=label, source=label) for label in labels],
        limitations=(
            []
            if quote.latest_trade_time
            else ["The quote provider did not expose a precise trade timestamp."]
        ),
    )


def extract_market_entity(message: str) -> str | None:
    explicit = _extract_explicit_ticker(message)
    if explicit:
        return explicit
    if _BROAD_MARKET_TERMS.search(message):
        return "SPY"

    patterns = (
        r"\b(?:what happened to|what is happening with|what's happening with)\s+(?:the\s+)?(?P<entity>[A-Za-z][A-Za-z0-9 .&'’-]{1,60}?)(?=\s+(?:recently|today|now|this week|this month)\b|[?.!,]|$)",
        r"\b(?:latest|recent)\s+(?P<entity>[A-Za-z][A-Za-z0-9 .&'’-]{1,60}?)\s+(?:news|earnings|filing|guidance)\b",
        r"\b(?:news|update|outlook|earnings|guidance|price|quote)\s+(?:for|on|about|of)\s+(?P<entity>[A-Za-z][A-Za-z0-9 .&'’-]{1,60}?)(?=[?.!,]|$)",
        r"\b(?:buy|sell|hold|invest in|analyze|research|about|on)\s+(?:the\s+)?(?P<entity>[A-Za-z][A-Za-z0-9.&'’-]{1,40})(?=[?.!,]|\s+(?:stock|shares?|today|now|recently)\b|$)",
        r"\b(?:what is|how is)\s+(?:the\s+)?(?P<entity>[A-Za-z][A-Za-z0-9 .&'’-]{1,60}?)\s+(?:stock|share price|doing)\b",
    )
    for pattern in patterns:
        match = re.search(pattern, message, re.IGNORECASE)
        if match:
            entity = " ".join(match.group("entity").strip().split())
            if entity:
                return entity
    return None


def _extract_explicit_ticker(message: str) -> str | None:
    cash = re.search(r"\$([A-Za-z][A-Za-z0-9.-]{0,9})\b", message)
    if cash:
        return cash.group(1).upper()
    for candidate in re.findall(r"\b[A-Z][A-Z0-9.-]{1,5}\b", message):
        if candidate not in _TICKER_STOP_WORDS:
            return candidate
    return None


def _resolve_entity(entity: str) -> tuple[str | None, str | None]:
    if re.fullmatch(r"[A-Z][A-Z0-9.-]{0,5}", entity):
        return entity, entity
    candidates = resolve_market_entity(entity)
    # A provider name containing the query plus public-equity/exchange metadata
    # scores 0.50. That is enough for pre-answer grounding, where the fetched
    # snapshot is verified again before any claim reaches the model.
    if not candidates or candidates[0].confidence < 0.50:
        return None, None
    return candidates[0].ticker, candidates[0].name


def _context_from_snapshot(
    snapshot: NormalizedMarketSnapshot,
    *,
    entity: str,
    resolved_name: str | None,
    reasons: list[str],
    retrieved_at: str,
) -> CurrentMarketContext:
    sources = _snapshot_sources(snapshot)
    limitations = list(snapshot.source_quality.get("limitations") or [])
    quote_timestamp = getattr(snapshot, "quote_timestamp", None)
    if not quote_timestamp:
        limitations.append("The quote provider did not expose a precise trade timestamp; price is latest available, not guaranteed real-time.")
    filings = list(snapshot.filing_context.get("recent_filings") or [])[:6]
    news = [
        {
            "title": item.title,
            "publisher": item.publisher or item.source,
            "published_at": item.published_at,
            "url": item.url,
        }
        for item in snapshot.news_items[:6]
    ]
    facts = {
        "company_name": snapshot.company_name or resolved_name,
        "ticker": snapshot.ticker,
        "exchange": snapshot.exchange,
        "latest_price": snapshot.latest_price,
        "currency": snapshot.currency,
        "daily_change_percent": snapshot.daily_change,
        "volume": snapshot.volume,
        "market_cap": snapshot.market_cap,
        "sector": snapshot.sector,
        "industry": snapshot.industry,
        "recent_news": news,
        "recent_sec_filings": filings,
        "sec_identity": {
            key: snapshot.filing_context.get(key)
            for key in ("entity_name", "tickers", "exchanges", "former_names")
            if snapshot.filing_context.get(key)
        },
        "data_sources": snapshot.data_sources,
    }
    has_evidence = any(
        value is not None and value != [] and value != {}
        for key, value in facts.items()
        if key not in {"company_name", "ticker", "data_sources"}
    )
    return CurrentMarketContext(
        required=True,
        status="grounded" if has_evidence else "unavailable",
        retrieved_at=retrieved_at,
        reasons=reasons,
        entity=entity,
        ticker=snapshot.ticker,
        company_name=snapshot.company_name or resolved_name,
        as_of=quote_timestamp or snapshot.source_quality.get("generated_at") or retrieved_at,
        facts=facts,
        sources=sources,
        limitations=list(dict.fromkeys(limitations)) if has_evidence else [
            *list(dict.fromkeys(limitations)),
            f"Configured providers returned no current evidence for {snapshot.ticker}.",
        ],
    )


def _snapshot_sources(snapshot: NormalizedMarketSnapshot) -> list[GroundingSource]:
    sources: list[GroundingSource] = []
    for item in snapshot.evidence_items:
        sources.append(GroundingSource(item.label, item.source, item.url, item.timestamp))
    for item in snapshot.news_items[:6]:
        sources.append(
            GroundingSource(
                label=item.title,
                source=item.publisher or item.source,
                url=item.url,
                published_at=item.published_at,
            )
        )
    seen: set[tuple[str, str | None]] = set()
    deduped: list[GroundingSource] = []
    for source in sources:
        key = (source.label.casefold(), source.url)
        if key not in seen:
            seen.add(key)
            deduped.append(source)
    return deduped[:12]


def _display_value(value: Any) -> str:
    if isinstance(value, float):
        return f"{value:,.4f}".rstrip("0").rstrip(".")
    return str(value)
