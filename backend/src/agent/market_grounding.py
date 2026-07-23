from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, time
from typing import Any, Callable
from zoneinfo import ZoneInfo

from src.data.market_data_service import NormalizedMarketSnapshot, market_data_service

ProgressCallback = Callable[[dict[str, Any]], None]

_QUOTE_INTENT_PATTERNS = [
    re.compile(r"\bstock\s+today\b", re.IGNORECASE),
    re.compile(r"\bprice\s+today\b", re.IGNORECASE),
    re.compile(r"\bwhat(?:'s|\s+is)?\s+(?:the\s+)?[\w .&-]+?\s+stock\b", re.IGNORECASE),
    re.compile(r"\bticker\s+for\s+[\w .&-]+", re.IGNORECASE),
    re.compile(r"\bis\s+[\w .&-]+?\s+(?:public|publicly\s+traded|listed)\b", re.IGNORECASE),
    re.compile(r"\bhow\s+is\s+[\w .&-]+?\s+doing\s+today\b", re.IGNORECASE),
    re.compile(r"\b(?:current|latest)\s+(?:stock\s+)?price\b", re.IGNORECASE),
]

_ENTITY_PATTERNS = [
    re.compile(r"\bticker\s+for\s+(?P<entity>[\w .&-]+)", re.IGNORECASE),
    re.compile(r"\bis\s+(?P<entity>[\w .&-]+?)\s+(?:public|publicly\s+traded|listed)\b", re.IGNORECASE),
    re.compile(r"\bwhat(?:'s|\s+is)?\s+(?:the\s+)?(?P<entity>[\w .&-]+?)\s+(?:stock|stock\s+price|share\s+price)(?:\s+today)?\b", re.IGNORECASE),
    re.compile(r"\bhow\s+is\s+(?P<entity>[\w .&-]+?)\s+doing\s+today\b", re.IGNORECASE),
    re.compile(r"\b(?P<entity>[A-Za-z][\w .&-]{0,80}?)\s+(?:stock|share\s+price|price)(?:\s+(?:today|now|currently))?\b", re.IGNORECASE),
]

_DEEP_ANALYSIS_TERMS = {
    "should i invest",
    "should i buy",
    "should i sell",
    "analyze risk",
    "risk analysis",
    "deep analysis",
    "full analysis",
    "comprehensive analysis",
    "investment thesis",
    "portfolio",
}

_ALIASES = {
    "spacex": "SpaceX",
    "spaceexplorationtechnologies": "SpaceX",
    "spaceexplorationtechnologiescorp": "SpaceX",
    "spaceexplorationtechnologiescorporation": "SpaceX",
}

_MAJOR_EXCHANGES = {
    "nasdaq",
    "nyse",
    "new york stock exchange",
    "nyse american",
    "amex",
    "arcx",
    "tsx",
    "tsx venture",
}

_PUBLIC_QUOTE_TYPES = {
    "commonstock",
    "equity",
    "stock",
    "etf",
    "fund",
    "mutualfund",
    "index",
}
_LOW_CONFIDENCE_THRESHOLD = 0.55


@dataclass
class MarketCandidate:
    ticker: str
    name: str
    exchange: str | None = None
    quote_type: str | None = None
    confidence: float = 0.0
    reasons: list[str] = field(default_factory=list)


@dataclass
class MarketQuoteResult:
    ticker: str
    company_name: str
    price: float
    currency: str | None
    latest_trade_time: str | None
    market_status: str
    data_sources: list[str]
    tool_used: list[str]
    exchange: str | None = None
    daily_change: float | None = None


@dataclass
class MarketGroundingResult:
    handled: bool
    response: str | None = None
    entity: str | None = None
    candidates: list[MarketCandidate] = field(default_factory=list)
    quote: MarketQuoteResult | None = None
    tool_used: list[str] = field(default_factory=list)


def is_market_quote_query(message: str) -> bool:
    lower = message.lower()
    if any(term in lower for term in _DEEP_ANALYSIS_TERMS):
        return False
    if _is_broad_market_query(lower):
        return False
    return any(pattern.search(message) for pattern in _QUOTE_INTENT_PATTERNS)


def ground_market_query(message: str, progress_callback: ProgressCallback | None = None) -> MarketGroundingResult:
    entity = _extract_market_entity(message)
    if not entity:
        return MarketGroundingResult(handled=False)

    display_entity = _canonical_entity(entity)
    tools_used: list[str] = []

    if _looks_like_ticker(entity):
        _progress(progress_callback, "market_quote", [], f"Fetching quote for {entity.upper()}...")
        tools_used.append("market_quote")
        quote = _fetch_quote(entity.upper(), tools_used)
        if quote:
            _progress(progress_callback, None, tools_used, "Market quote completed.")
            return _quote_response(display_entity, quote, tools_used)

    _progress(progress_callback, "market_search", [], f"Resolving market symbol for {display_entity}...")
    tools_used.append("market_search")
    candidates = resolve_market_entity(display_entity)
    if not candidates:
        return _not_public_response(display_entity, tools_used)

    top = candidates[0]
    if top.confidence < _LOW_CONFIDENCE_THRESHOLD:
        return _candidate_response(display_entity, candidates, tools_used)

    _progress(progress_callback, "market_quote", ["market_search"], f"Fetching quote for {top.ticker}...")
    tools_used.append("market_quote")
    quote = _fetch_quote(top.ticker, tools_used)
    if quote:
        _progress(progress_callback, None, tools_used, "Market quote completed.")
        return _quote_response(display_entity, quote, tools_used)

    for candidate in candidates[1:4]:
        if candidate.confidence < _LOW_CONFIDENCE_THRESHOLD:
            continue
        quote = _fetch_quote(candidate.ticker, tools_used)
        if quote:
            _progress(progress_callback, None, tools_used, "Market quote completed.")
            return _quote_response(display_entity, quote, tools_used)

    return _not_public_response(display_entity, tools_used, candidates=candidates)


def resolve_market_entity(entity: str, limit: int = 8) -> list[MarketCandidate]:
    query = _canonical_entity(entity)
    query_norm = _normalize_name(query)
    alias_target = _ALIASES.get(query_norm)
    alias_norm = _normalize_name(alias_target or query)
    rows = market_data_service.search_symbols(alias_target or query, limit)
    candidates = [_score_candidate(row, query_norm, alias_norm) for row in rows if row.get("ticker")]
    return sorted(candidates, key=lambda item: item.confidence, reverse=True)


def _score_candidate(row: dict[str, Any], query_norm: str, alias_norm: str) -> MarketCandidate:
    ticker = str(row.get("ticker") or "").strip().upper()
    name = str(row.get("name") or ticker).strip()
    exchange = row.get("exchange")
    quote_type = row.get("quote_type")
    name_norm = _normalize_name(name)
    ticker_norm = _normalize_name(ticker)
    exchange_norm = _normalize_name(str(exchange or ""))
    quote_type_norm = _normalize_name(str(quote_type or ""))
    score = 0.0
    reasons: list[str] = []

    if ticker_norm == query_norm or ticker_norm == alias_norm:
        score += 0.4
        reasons.append("symbol match")
    if name_norm in {query_norm, alias_norm}:
        score += 0.4
        reasons.append("exact name match")
    elif query_norm and (query_norm in name_norm or name_norm in query_norm or alias_norm in name_norm):
        score += 0.3
        reasons.append("alias/name match")
    if exchange_norm in {_normalize_name(value) for value in _MAJOR_EXCHANGES}:
        score += 0.1
        reasons.append("major exchange")
    if quote_type_norm in _PUBLIC_QUOTE_TYPES:
        score += 0.1
        reasons.append("public quote type")
    if score == 0:
        score = 0.15
        reasons.append("provider candidate")

    return MarketCandidate(
        ticker=ticker,
        name=name,
        exchange=str(exchange) if exchange else None,
        quote_type=str(quote_type) if quote_type else None,
        confidence=round(min(score, 0.99), 2),
        reasons=reasons,
    )


def _fetch_quote(ticker: str, tools_used: list[str]) -> MarketQuoteResult | None:
    try:
        snapshot = market_data_service.fetch_snapshot(
            ticker,
            period="5d",
            interval="1d",
            include_news=False,
            include_sec=False,
            include_fundamentals=False,
        )
    except Exception:
        return None
    price = snapshot.latest_price
    if price is None and snapshot.history:
        price = snapshot.history[-1].price
    if price is None:
        return None
    latest_trade_time = _latest_trade_time(snapshot)
    return MarketQuoteResult(
        ticker=ticker.upper(),
        company_name=snapshot.company_name or ticker.upper(),
        price=round(float(price), 2),
        currency=snapshot.currency,
        latest_trade_time=latest_trade_time,
        market_status=_market_status(latest_trade_time),
        data_sources=list(snapshot.data_sources or []),
        tool_used=list(dict.fromkeys(tools_used)),
        exchange=snapshot.exchange,
        daily_change=snapshot.daily_change,
    )


def _quote_response(entity: str, quote: MarketQuoteResult, tools_used: list[str]) -> MarketGroundingResult:
    today = _format_date(_market_today())
    latest = quote.latest_trade_time or "unavailable"
    currency_symbol = "$" if (quote.currency or "USD").upper() in {"USD", "CAD"} else ""
    price = f"{currency_symbol}{quote.price:,.2f}"
    currency_suffix = f" {quote.currency}" if quote.currency and currency_symbol != "" else (f" {quote.currency}" if quote.currency else "")
    change = f" Daily change: {quote.daily_change:+.2f}%." if quote.daily_change is not None else ""
    source = ", ".join([*tools_used, *quote.data_sources]) or "market data service"
    response = (
        f"{entity} appears to trade as {quote.ticker}. Latest available quote: {price}{currency_suffix}. "
        f"Latest trade: {latest}. Today is {today}; market status: {quote.market_status}.{change} "
        f"Source/tool used: {source}. "
        "This is AI-generated market information, not professional financial advice."
    )
    return MarketGroundingResult(
        handled=True,
        response=response,
        entity=entity,
        quote=quote,
        tool_used=list(dict.fromkeys(tools_used)),
    )


def _candidate_response(entity: str, candidates: list[MarketCandidate], tools_used: list[str]) -> MarketGroundingResult:
    shown = candidates[:5]
    lines = [
        f"I found possible public market matches for {entity}, but confidence is low. Please confirm the ticker before I quote it:",
        *[
            f"- {candidate.ticker}: {candidate.name}"
            + (f" ({candidate.exchange})" if candidate.exchange else "")
            + f" — confidence {candidate.confidence:.0%}"
            for candidate in shown
        ],
        f"Source/tool used: {', '.join(tools_used)}.",
        "This is AI-generated market information, not professional financial advice.",
    ]
    return MarketGroundingResult(handled=True, response="\n".join(lines), entity=entity, candidates=shown, tool_used=tools_used)


def _not_public_response(
    entity: str,
    tools_used: list[str],
    *,
    candidates: list[MarketCandidate] | None = None,
) -> MarketGroundingResult:
    response = (
        f"I could not find a public market quote for {entity} from the live market search/quote tools. "
        "That means the company may be private, not publicly traded under that name, or listed under a different symbol. "
        f"Source/tool used: {', '.join(dict.fromkeys(tools_used))}. "
        "This is AI-generated market information, not professional financial advice."
    )
    return MarketGroundingResult(
        handled=True,
        response=response,
        entity=entity,
        candidates=candidates or [],
        tool_used=list(dict.fromkeys(tools_used)),
    )


def _extract_market_entity(message: str) -> str | None:
    cleaned = re.sub(r"[?!.]+$", "", message.strip())
    for pattern in _ENTITY_PATTERNS:
        match = pattern.search(cleaned)
        if match:
            return _clean_entity(match.group("entity"))
    return None


def _clean_entity(entity: str) -> str:
    value = re.sub(r"\b(?:the|a|an|company|stock|shares?|price|today|now|currently)\b", " ", entity, flags=re.IGNORECASE)
    value = re.sub(r"\s+", " ", value).strip(" -.,")
    return value


def _canonical_entity(entity: str) -> str:
    norm = _normalize_name(entity)
    return _ALIASES.get(norm, entity.strip())


def _looks_like_ticker(entity: str) -> bool:
    if _normalize_name(entity) in _ALIASES:
        return False
    stripped = entity.strip().upper()
    return bool(re.fullmatch(r"[\^A-Z][A-Z0-9.-]{0,9}", stripped))


def _normalize_name(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", value.lower())


def _latest_trade_time(snapshot: NormalizedMarketSnapshot) -> str | None:
    quote_timestamp = getattr(snapshot, "quote_timestamp", None)
    if quote_timestamp:
        try:
            return _format_datetime(datetime.fromisoformat(quote_timestamp.replace("Z", "+00:00")))
        except (TypeError, ValueError):
            pass
    frame = getattr(snapshot, "history_frame", None)
    try:
        if frame is not None and not frame.empty:
            index = frame.index[-1]
            if hasattr(index, "to_pydatetime"):
                return _format_datetime(index.to_pydatetime())
            if isinstance(index, datetime):
                return _format_datetime(index)
    except Exception:
        pass
    if snapshot.history:
        return snapshot.history[-1].label
    return None


def _format_datetime(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    local = value.astimezone(ZoneInfo("America/New_York"))
    if local.time() == time(0, 0):
        return _format_date(local.date())
    return f"{local:%b} {local.day}, {local:%Y %H:%M %Z}"


def _format_date(value: date) -> str:
    return f"{value:%b} {value.day}, {value:%Y}"


def _market_status(latest_trade_time: str | None) -> str:
    now = datetime.now(ZoneInfo("America/New_York"))
    if now.weekday() >= 5:
        return "closed"
    if latest_trade_time:
        parsed = _parse_trade_date(latest_trade_time)
        if parsed and parsed < now.date():
            return "closed"
    market_open = time(9, 30) <= now.time() <= time(16, 0)
    return "open" if market_open else "closed"


def _market_today() -> date:
    return datetime.now(ZoneInfo("America/New_York")).date()


def _parse_trade_date(value: str) -> date | None:
    for fmt in ("%b %d, %Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            continue
    return None


def _is_broad_market_query(lower: str) -> bool:
    broad_terms = {"market today", "market pulse", "market overview", "how is the market"}
    return any(term in lower for term in broad_terms)


def _progress(
    progress_callback: ProgressCallback | None,
    active_tool: str | None,
    completed_tools: list[str],
    message: str,
) -> None:
    if not progress_callback:
        return
    progress_callback({
        "active_tool": active_tool,
        "completed_tools": list(dict.fromkeys(completed_tools)),
        "active_label": str(active_tool or "Market Grounding").replace("_", " ").title(),
        "message": message,
    })
