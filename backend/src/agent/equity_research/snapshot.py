from __future__ import annotations

from datetime import date
from math import isnan
from typing import Any
from uuid import UUID

import pandas as pd
import yfinance as yf
from fastapi import HTTPException, status

from src.data.market_data_service import market_data_service
from src.agent.market_grounding import resolve_market_entity
from src.models.equity_research import EquityResearchSnapshot


def _clean_number(value: Any) -> float | None:
    try:
        if value is None:
            return None
        number = float(value)
        if isnan(number):
            return None
        return number
    except Exception:
        return None


def _latest(series: pd.Series) -> float | None:
    clean = series.dropna()
    return _clean_number(clean.iloc[-1]) if not clean.empty else None


def _safe_pct_change(latest: float | None, previous: float | None) -> float | None:
    if latest is None or previous is None or previous == 0:
        return None
    return round((latest - previous) / previous * 100, 4)


def _technical_indicators(history: pd.DataFrame) -> dict[str, Any]:
    if history.empty or "Close" not in history:
        return {"limitations": ["No close-price history available for technical indicators."]}

    close = history["Close"].dropna().astype(float)
    volume = history["Volume"].dropna().astype(float) if "Volume" in history else pd.Series(dtype=float)
    if len(close) < 5:
        return {"limitations": ["Insufficient close-price history for robust technical indicators."]}

    returns = close.pct_change().dropna()
    sma_20 = close.rolling(20).mean()
    sma_50 = close.rolling(50).mean()
    ema_12 = close.ewm(span=12, adjust=False).mean()
    ema_26 = close.ewm(span=26, adjust=False).mean()
    macd = ema_12 - ema_26
    delta = close.diff()
    gain = delta.clip(lower=0).rolling(14).mean()
    loss = (-delta.clip(upper=0)).rolling(14).mean()
    rs = gain / loss.replace(0, pd.NA)
    rsi = 100 - (100 / (1 + rs))
    rolling_std = close.rolling(20).std()
    upper_band = sma_20 + rolling_std * 2
    lower_band = sma_20 - rolling_std * 2

    high_20 = close.tail(20).max()
    low_20 = close.tail(20).min()
    trend = "uptrend" if _latest(sma_20) and close.iloc[-1] > _latest(sma_20) else "range_or_downtrend"

    return {
        "trend": trend,
        "sma_20": _clean_number(_latest(sma_20)),
        "sma_50": _clean_number(_latest(sma_50)),
        "macd": _clean_number(_latest(macd)),
        "rsi_14": _clean_number(_latest(rsi)),
        "bollinger_upper": _clean_number(_latest(upper_band)),
        "bollinger_lower": _clean_number(_latest(lower_band)),
        "support_20d": _clean_number(low_20),
        "resistance_20d": _clean_number(high_20),
        "annualized_volatility": _clean_number(returns.std() * (252 ** 0.5)) if len(returns) > 1 else None,
        "avg_volume_20d": _clean_number(volume.tail(20).mean()) if not volume.empty else None,
        "limitations": [],
    }


def _risk_metrics(history: pd.DataFrame) -> dict[str, Any]:
    if history.empty or "Close" not in history:
        return {"limitations": ["No price history available for risk metrics."]}
    close = history["Close"].dropna().astype(float)
    returns = close.pct_change().dropna()
    if returns.empty:
        return {"limitations": ["Insufficient returns history for risk metrics."]}
    cumulative = (1 + returns).cumprod()
    drawdown = cumulative / cumulative.cummax() - 1
    return {
        "daily_var_95": _clean_number(abs(returns.quantile(0.05))),
        "max_drawdown_window": _clean_number(abs(drawdown.min())),
        "downside_volatility": _clean_number(returns[returns < 0].std() * (252 ** 0.5)) if len(returns[returns < 0]) > 1 else None,
        "limitations": [],
    }


def _news_items(ticker: yf.Ticker) -> list[dict[str, Any]]:
    try:
        raw_news = ticker.news or []
    except Exception:
        return []

    items = []
    for item in raw_news[:8]:
        content = item.get("content") if isinstance(item, dict) else None
        if isinstance(content, dict):
            title = content.get("title")
            publisher = content.get("provider", {}).get("displayName") if isinstance(content.get("provider"), dict) else None
            url = content.get("canonicalUrl", {}).get("url") if isinstance(content.get("canonicalUrl"), dict) else None
        else:
            title = item.get("title") if isinstance(item, dict) else None
            publisher = item.get("publisher") if isinstance(item, dict) else None
            url = item.get("link") if isinstance(item, dict) else None
        if title:
            items.append({"title": title, "publisher": publisher, "url": url})
    return items


def _sentiment_summary(news_items: list[dict[str, Any]]) -> dict[str, Any]:
    if not news_items:
        return {
            "signal": "limited",
            "score": 0,
            "summary": "No recent news items were available from the configured data source.",
            "limitations": ["No social media API is configured; sentiment is limited to available news metadata."],
        }
    positive_terms = {"beats", "growth", "raises", "record", "strong", "upgrade", "profit"}
    negative_terms = {"misses", "cuts", "probe", "weak", "downgrade", "loss", "risk"}
    score = 0
    for item in news_items:
        title = str(item.get("title", "")).lower()
        score += sum(1 for term in positive_terms if term in title)
        score -= sum(1 for term in negative_terms if term in title)
    signal = "bullish" if score > 0 else "bearish" if score < 0 else "neutral"
    return {
        "signal": signal,
        "score": score,
        "summary": f"News-title sentiment is {signal}; no social feed is configured.",
        "limitations": ["No social media API is configured; social sentiment is represented as unavailable."],
    }


def _build_equity_research_snapshot(
    run_id: UUID,
    ticker: str,
    analysis_date: date,
    market_snapshot: Any,
) -> EquityResearchSnapshot:
    return EquityResearchSnapshot(
        run_id=run_id,
        ticker=ticker,
        company_name=market_snapshot.company_name,
        exchange=market_snapshot.exchange,
        analysis_date=analysis_date,
        latest_price=market_snapshot.latest_price,
        previous_close=market_snapshot.previous_close,
        daily_change=market_snapshot.daily_change,
        volume=market_snapshot.volume,
        market_cap=market_snapshot.market_cap,
        fundamentals={
            **market_snapshot.fundamentals,
            "sector": market_snapshot.sector or market_snapshot.fundamentals.get("sector"),
            "industry": market_snapshot.industry or market_snapshot.fundamentals.get("industry"),
            "market_cap": market_snapshot.market_cap,
            "pe_ratio": market_snapshot.pe_ratio,
        },
        technical_indicators=market_snapshot.technical_indicators,
        news_items=[
            {
                "title": item.title,
                "publisher": item.publisher,
                "url": item.url,
                "published_at": item.published_at,
                "source": item.source,
                "summary": item.summary,
                "sentiment": item.sentiment,
                "sentiment_score": item.sentiment_score,
            }
            for item in market_snapshot.news_items
        ],
        rag_context=[],
        sentiment_summary=market_snapshot.sentiment_summary,
        risk_metrics=market_snapshot.risk_metrics,
        data_sources=market_snapshot.data_sources,
        source_quality=market_snapshot.source_quality,
        provider_status=[status_item.__dict__ for status_item in market_snapshot.provider_status],
        evidence_items=[item.__dict__ for item in market_snapshot.evidence_items],
        analyst_context=market_snapshot.analyst_context,
        filing_context=market_snapshot.filing_context,
    )


def build_data_snapshot(run_id: UUID, ticker_symbol: str, analysis_date: date) -> EquityResearchSnapshot:
    normalized = ticker_symbol.strip().upper()
    market_snapshot = market_data_service.fetch_snapshot(normalized, period="6mo", interval="1d", include_news=True)
    if not market_snapshot.company_name and not market_snapshot.exchange and not market_snapshot.latest_price:
        candidates = resolve_market_entity(normalized, limit=3)
        resolved_ticker = candidates[0].ticker if candidates else None
        if resolved_ticker and resolved_ticker != normalized:
            market_snapshot = market_data_service.fetch_snapshot(
                resolved_ticker,
                period="6mo",
                interval="1d",
                include_news=True,
            )
            if market_snapshot.company_name or market_snapshot.exchange or market_snapshot.latest_price:
                normalized = resolved_ticker
        if not (market_snapshot.company_name or market_snapshot.exchange or market_snapshot.latest_price):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Could not resolve {ticker_symbol}. Check the ticker and try again.",
            )
    return _build_equity_research_snapshot(run_id, normalized, analysis_date, market_snapshot)
