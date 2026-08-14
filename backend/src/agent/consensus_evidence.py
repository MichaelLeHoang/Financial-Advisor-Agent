"""Deterministic, source-aware evidence for multi-asset consensus analysis."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

import numpy as np
import pandas as pd

from src.data.market_data_service import MarketDataService, market_data_service

MAX_CONSENSUS_ASSETS = 5
MIN_TREND_OBSERVATIONS = 61

_CONTEXT_BOUNDARY = "CURRENT MARKET GROUNDING"
_UPPERCASE_STOP_WORDS = {
    "AI",
    "BUY",
    "CAD",
    "CEO",
    "CFO",
    "ETF",
    "EPS",
    "FED",
    "GDP",
    "HOLD",
    "IPO",
    "LLM",
    "NEWS",
    "NOW",
    "RIGHT",
    "RISK",
    "RSI",
    "SEC",
    "SELL",
    "SMA",
    "TODAY",
    "USD",
}
_LOWERCASE_CANDIDATE = re.compile(
    r"\b(?:buy|sell|hold|compare|between|versus|vs\.?|and|or)\s+"
    r"(?:more\s+|shares\s+(?:of\s+)?|into\s+)?\$?([A-Za-z][A-Za-z0-9.-]{1,5})\b",
    re.IGNORECASE,
)
_ALLOCATION_TERMS = re.compile(
    r"\b(allocate|allocation|portfolio weight|position weight|optimi[sz]e|markowitz|how much of each|rebalance)\b",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class EvidenceSource:
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


@dataclass(frozen=True)
class RiskFinding:
    label: str
    severity: str
    metric: str
    value: float
    threshold: float

    def to_dict(self) -> dict[str, Any]:
        return {
            "label": self.label,
            "severity": self.severity,
            "metric": self.metric,
            "value": self.value,
            "threshold": self.threshold,
        }


@dataclass
class AssetEvidence:
    symbol: str
    company_name: str
    status: str
    as_of: str | None
    currency: str | None
    metrics: dict[str, Any] = field(default_factory=dict)
    sources: list[EvidenceSource] = field(default_factory=list)
    limitations: list[str] = field(default_factory=list)
    risk_findings: list[RiskFinding] = field(default_factory=list)

    @property
    def critical_risk(self) -> bool:
        return any(item.severity == "critical" for item in self.risk_findings)

    def prompt_block(self) -> str:
        metric_lines = [
            f"- {key}: {_display(value)}"
            for key, value in self.metrics.items()
            if value is not None
        ]
        risk_lines = [
            f"- {item.severity}: {item.label} ({item.metric}={_display(item.value)})"
            for item in self.risk_findings
        ]
        source_lines = [
            f"- {item.source}: {item.label}" + (f" — {item.url}" if item.url else "")
            for item in self.sources
        ]
        return "\n".join(
            [
                f"### {self.company_name} ({self.symbol})",
                f"Evidence status: {self.status}",
                f"Evidence as of: {self.as_of or 'Unavailable'}",
                "Metrics:",
                *(metric_lines or ["- No normalized metrics available."]),
                "Risk findings:",
                *(risk_lines or ["- None from the deterministic risk profile."]),
                "Sources:",
                *(source_lines or ["- No attributable provider source available."]),
                "Limitations:",
                *([f"- {item}" for item in self.limitations] or ["- None."]),
            ]
        )


@dataclass
class ConsensusEvidenceBundle:
    assets: list[AssetEvidence]
    requested_symbols: list[str]
    retrieved_at: str
    correlations: dict[str, float] = field(default_factory=dict)
    limitations: list[str] = field(default_factory=list)
    optimizer_requested: bool = False

    @property
    def evidence_status(self) -> str:
        if not self.assets or any(
            asset.status == "insufficient" for asset in self.assets
        ):
            return "insufficient"
        if self.limitations or any(asset.status == "partial" for asset in self.assets):
            return "partial"
        return "complete"

    @property
    def coverage(self) -> float:
        if not self.requested_symbols:
            return 0.0
        complete = sum(asset.status == "complete" for asset in self.assets)
        partial = sum(asset.status == "partial" for asset in self.assets)
        return round((complete + partial * 0.65) / len(self.requested_symbols), 4)

    def asset(self, symbol: str) -> AssetEvidence | None:
        normalized = symbol.upper()
        return next(
            (asset for asset in self.assets if asset.symbol == normalized), None
        )

    def augment(self, query: str) -> str:
        if not self.assets:
            return query
        correlation_lines = [
            f"- {pair}: {value:.4f}" for pair, value in self.correlations.items()
        ]
        return "\n\n".join(
            [
                query,
                "\n".join(
                    [
                        "CONSENSUS EVIDENCE BUNDLE",
                        "This shared runtime evidence takes precedence over model memory and must be used for every numeric claim.",
                        f"Retrieved at: {self.retrieved_at}",
                        f"Required symbols: {', '.join(self.requested_symbols)}",
                        f"Evidence status: {self.evidence_status}",
                        *[asset.prompt_block() for asset in self.assets],
                        "Cross-asset correlations:",
                        *(correlation_lines or ["- Not applicable."]),
                        "Instruction: Return a separate asset_opinion for every required symbol. Missing evidence is a limitation, not an investment risk. Do not call trailing historical return a forecast.",
                    ]
                ),
            ]
        )


def optimizer_requested(query: str) -> bool:
    return bool(_ALLOCATION_TERMS.search(query.split(_CONTEXT_BOUNDARY, 1)[0]))


def resolve_consensus_symbols(
    query: str,
    service: MarketDataService = market_data_service,
) -> list[str]:
    """Resolve explicit upper/cashtag symbols and validated lowercase symbols."""
    clean_query = query.split(_CONTEXT_BOUNDARY, 1)[0]
    candidates: list[tuple[str, bool]] = []
    candidates.extend(
        (match.upper(), True)
        for match in re.findall(r"\$([A-Za-z][A-Za-z0-9.-]{0,9})\b", clean_query)
    )
    candidates.extend(
        (match, True)
        for match in re.findall(r"\b[A-Z][A-Z0-9.-]{1,5}\b", clean_query)
        if match not in _UPPERCASE_STOP_WORDS
    )
    candidates.extend(
        (match, False) for match in _LOWERCASE_CANDIDATE.findall(clean_query)
    )

    resolved: list[str] = []
    for candidate, explicit in candidates:
        symbol = candidate.upper().rstrip(".")
        if symbol in _UPPERCASE_STOP_WORDS or symbol in resolved:
            continue
        if not explicit:
            try:
                matches = service.search_symbols(symbol, limit=5)
            except Exception:
                matches = []
            if not any(
                str(item.get("ticker", "")).upper() == symbol for item in matches
            ):
                continue
        resolved.append(symbol)
        if len(resolved) >= MAX_CONSENSUS_ASSETS:
            break
    return resolved


def build_consensus_evidence(
    query: str,
    service: MarketDataService = market_data_service,
) -> ConsensusEvidenceBundle:
    symbols = resolve_consensus_symbols(query, service)
    retrieved_at = datetime.now(UTC).isoformat()
    assets: list[AssetEvidence] = []
    close_series: dict[str, pd.Series] = {}
    limitations: list[str] = []

    for symbol in symbols:
        try:
            snapshot = service.fetch_snapshot(
                symbol,
                period="1y",
                interval="1d",
                include_news=True,
                include_sec=False,
                include_fundamentals=True,
            )
            asset, closes = _asset_evidence(snapshot, retrieved_at)
            assets.append(asset)
            if closes is not None:
                close_series[symbol] = closes
        except Exception as exc:
            assets.append(
                AssetEvidence(
                    symbol=symbol,
                    company_name=symbol,
                    status="insufficient",
                    as_of=None,
                    currency=None,
                    limitations=[
                        f"Current providers failed for {symbol}: {str(exc)[:160]}"
                    ],
                )
            )

    correlations = _correlations(close_series)
    if not symbols:
        limitations.append(
            "No explicit public-market ticker could be resolved from the request."
        )
    return ConsensusEvidenceBundle(
        assets=assets,
        requested_symbols=symbols,
        retrieved_at=retrieved_at,
        correlations=correlations,
        limitations=limitations,
        optimizer_requested=optimizer_requested(query),
    )


def _asset_evidence(
    snapshot: Any, retrieved_at: str
) -> tuple[AssetEvidence, pd.Series | None]:
    symbol = str(snapshot.ticker).upper()
    frame = snapshot.history_frame
    closes: pd.Series | None = None
    if frame is not None and not frame.empty and "Close" in frame:
        closes = pd.to_numeric(frame["Close"], errors="coerce").dropna()

    limitations = list(snapshot.source_quality.get("limitations") or [])
    metrics: dict[str, Any] = {
        "latest_price": snapshot.latest_price,
        "daily_change_pct": snapshot.daily_change,
        "volume": snapshot.volume,
        "market_cap": snapshot.market_cap,
    }
    risk_findings: list[RiskFinding] = []
    if closes is None or len(closes) < MIN_TREND_OBSERVATIONS:
        observations = 0 if closes is None else len(closes)
        limitations.append(
            f"Only {observations} daily closes were available; at least {MIN_TREND_OBSERVATIONS} are required for trend evidence."
        )
    else:
        metrics.update(_trend_metrics(closes))
        risk_metrics = _risk_metrics(closes)
        metrics.update(risk_metrics)
        risk_findings = _risk_findings(risk_metrics)

    as_of = snapshot.quote_timestamp
    if not as_of and closes is not None and not closes.empty:
        index = closes.index[-1]
        as_of = index.isoformat() if hasattr(index, "isoformat") else str(index)
    if not as_of:
        limitations.append("No quote or market-history timestamp was available.")

    sources = _sources(snapshot)
    if not sources:
        limitations.append("No attributable provider source was returned.")

    essential = (
        snapshot.latest_price is not None
        and closes is not None
        and len(closes) >= MIN_TREND_OBSERVATIONS
        and as_of is not None
        and metrics.get("annualized_volatility") is not None
    )
    status = (
        "complete"
        if essential and not limitations
        else "partial"
        if essential
        else "insufficient"
    )
    return (
        AssetEvidence(
            symbol=symbol,
            company_name=snapshot.company_name or symbol,
            status=status,
            as_of=as_of or retrieved_at,
            currency=snapshot.currency,
            metrics=metrics,
            sources=sources,
            limitations=list(dict.fromkeys(limitations)),
            risk_findings=risk_findings,
        ),
        closes,
    )


def _trend_metrics(closes: pd.Series) -> dict[str, Any]:
    latest = float(closes.iloc[-1])
    sma20 = float(closes.tail(20).mean())
    sma50 = float(closes.tail(50).mean())
    sma200 = float(closes.tail(200).mean()) if len(closes) >= 200 else None
    momentum20 = float(latest / closes.iloc[-21] - 1)
    momentum60 = float(latest / closes.iloc[-61] - 1)
    if latest > sma20 > sma50 and momentum20 > 0 and momentum60 > 0:
        label = "confirmed_uptrend"
    elif (
        sma200 is not None
        and latest > sma20
        and latest > sma200
        and momentum20 > 0
        and momentum60 > 0
    ):
        label = "rebound_in_long_term_uptrend"
    elif latest < sma50 and momentum20 < 0 and momentum60 < 0:
        label = "downtrend"
    else:
        label = "mixed"
    return {
        "observations": len(closes),
        "momentum_20d": momentum20,
        "momentum_60d": momentum60,
        "sma_20": sma20,
        "sma_50": sma50,
        "sma_200": sma200,
        "above_sma_20": latest > sma20,
        "above_sma_50": latest > sma50,
        "above_sma_200": latest > sma200 if sma200 is not None else None,
        "trend_label": label,
    }


def _risk_metrics(closes: pd.Series) -> dict[str, float]:
    returns = closes.pct_change().replace([np.inf, -np.inf], np.nan).dropna()
    volatility = float(returns.std(ddof=1) * np.sqrt(252))
    var95 = float(np.percentile(returns, 5))
    tail = returns[returns <= var95]
    cvar95 = float(tail.mean()) if not tail.empty else var95
    drawdown = closes / closes.cummax() - 1
    negative = returns[returns < 0]
    downside = float(negative.std(ddof=1) * np.sqrt(252)) if len(negative) > 1 else 0.0
    return {
        "annualized_volatility": volatility,
        "daily_var_95": var95,
        "daily_cvar_95": cvar95,
        "max_drawdown": float(drawdown.min()),
        "downside_deviation": downside,
    }


def _risk_findings(metrics: dict[str, float]) -> list[RiskFinding]:
    findings: list[RiskFinding] = []
    volatility = metrics["annualized_volatility"]
    drawdown = metrics["max_drawdown"]
    cvar = metrics["daily_cvar_95"]
    if volatility >= 1.0:
        findings.append(
            RiskFinding(
                "Extreme realized volatility",
                "critical",
                "annualized_volatility",
                volatility,
                1.0,
            )
        )
    elif volatility >= 0.6:
        findings.append(
            RiskFinding(
                "Very high realized volatility",
                "high",
                "annualized_volatility",
                volatility,
                0.6,
            )
        )
    elif volatility >= 0.35:
        findings.append(
            RiskFinding(
                "Elevated realized volatility",
                "moderate",
                "annualized_volatility",
                volatility,
                0.35,
            )
        )
    if drawdown <= -0.5:
        findings.append(
            RiskFinding(
                "Severe historical drawdown", "critical", "max_drawdown", drawdown, -0.5
            )
        )
    elif drawdown <= -0.35:
        findings.append(
            RiskFinding(
                "Large historical drawdown", "high", "max_drawdown", drawdown, -0.35
            )
        )
    elif drawdown <= -0.2:
        findings.append(
            RiskFinding(
                "Material historical drawdown",
                "moderate",
                "max_drawdown",
                drawdown,
                -0.2,
            )
        )
    if cvar <= -0.1:
        findings.append(
            RiskFinding(
                "Extreme historical tail loss", "critical", "daily_cvar_95", cvar, -0.1
            )
        )
    elif cvar <= -0.07:
        findings.append(
            RiskFinding(
                "Large historical tail loss", "high", "daily_cvar_95", cvar, -0.07
            )
        )
    return findings


def _sources(snapshot: Any) -> list[EvidenceSource]:
    sources: list[EvidenceSource] = []
    for item in snapshot.evidence_items:
        sources.append(
            EvidenceSource(item.label, item.source, item.url, item.timestamp)
        )
    for item in snapshot.news_items[:4]:
        sources.append(
            EvidenceSource(
                item.title, item.publisher or item.source, item.url, item.published_at
            )
        )
    for label in snapshot.data_sources:
        sources.append(EvidenceSource(label.replace("_", " ").title(), label))
    seen: set[tuple[str, str | None]] = set()
    result: list[EvidenceSource] = []
    for source in sources:
        key = (source.source.casefold(), source.url)
        if key not in seen:
            seen.add(key)
            result.append(source)
    return result[:10]


def _correlations(series_by_symbol: dict[str, pd.Series]) -> dict[str, float]:
    if len(series_by_symbol) < 2:
        return {}
    returns = pd.DataFrame(series_by_symbol).pct_change(fill_method=None).dropna()
    if returns.empty:
        return {}
    matrix = returns.corr()
    symbols = list(matrix.columns)
    return {
        f"{left}-{right}": round(float(matrix.loc[left, right]), 4)
        for index, left in enumerate(symbols)
        for right in symbols[index + 1 :]
    }


def _display(value: Any) -> str:
    if isinstance(value, bool):
        return "yes" if value else "no"
    if isinstance(value, float):
        return f"{value:.4f}"
    return str(value)
