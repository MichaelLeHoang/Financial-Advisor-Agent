from __future__ import annotations

from datetime import date
from math import isnan
from typing import Any
from uuid import UUID

import pandas as pd
import yfinance as yf
from fastapi import HTTPException, status

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


def build_data_snapshot(run_id: UUID, ticker_symbol: str, analysis_date: date) -> EquityResearchSnapshot:
    ticker = yf.Ticker(ticker_symbol)
    try:
        info = ticker.info or {}
    except Exception:
        info = {}

    company_name = info.get("shortName") or info.get("longName")
    exchange = info.get("exchange") or info.get("fullExchangeName")
    if not company_name and not exchange:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Could not resolve {ticker_symbol}. Check the ticker and try again.",
        )

    try:
        history = ticker.history(period="6mo", interval="1d", auto_adjust=True)
    except Exception:
        history = pd.DataFrame()

    latest_price = None
    previous_close = _clean_number(info.get("regularMarketPreviousClose") or info.get("previousClose"))
    volume = _clean_number(info.get("regularMarketVolume") or info.get("volume"))
    if not history.empty and "Close" in history:
        close = history["Close"].dropna()
        latest_price = _latest(close)
        if previous_close is None and len(close) > 1:
            previous_close = _clean_number(close.iloc[-2])
        if volume is None and "Volume" in history:
            volume = _latest(history["Volume"])
    latest_price = latest_price or _clean_number(info.get("regularMarketPrice") or info.get("currentPrice"))

    news = _news_items(ticker)
    fundamentals = {
        "trailing_pe": _clean_number(info.get("trailingPE")),
        "forward_pe": _clean_number(info.get("forwardPE")),
        "price_to_book": _clean_number(info.get("priceToBook")),
        "profit_margins": _clean_number(info.get("profitMargins")),
        "revenue_growth": _clean_number(info.get("revenueGrowth")),
        "earnings_growth": _clean_number(info.get("earningsGrowth")),
        "debt_to_equity": _clean_number(info.get("debtToEquity")),
        "free_cashflow": _clean_number(info.get("freeCashflow")),
        "sector": info.get("sector"),
        "industry": info.get("industry"),
    }

    sources = ["yfinance"]
    if news:
        sources.append("yfinance_news")

    return EquityResearchSnapshot(
        run_id=run_id,
        ticker=ticker_symbol,
        company_name=company_name,
        exchange=exchange,
        analysis_date=analysis_date,
        latest_price=latest_price,
        previous_close=previous_close,
        daily_change=_safe_pct_change(latest_price, previous_close),
        volume=volume,
        market_cap=_clean_number(info.get("marketCap")),
        fundamentals=fundamentals,
        technical_indicators=_technical_indicators(history),
        news_items=news,
        rag_context=[],
        sentiment_summary=_sentiment_summary(news),
        risk_metrics=_risk_metrics(history),
        data_sources=sources,
    )
