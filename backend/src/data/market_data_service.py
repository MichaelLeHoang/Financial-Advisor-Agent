from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, timedelta
from math import isnan
from typing import Any
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import pandas as pd
import yfinance as yf

from src.config import settings


@dataclass
class ProviderStatus:
    provider: str
    status: str
    detail: str | None = None
    timestamp: str = field(default_factory=lambda: datetime.now(UTC).isoformat())


@dataclass
class EvidenceItem:
    label: str
    source: str
    detail: str | None = None
    url: str | None = None
    timestamp: str | None = None
    importance: str = "medium"


@dataclass
class NormalizedMarketPoint:
    label: str
    price: float
    volume: int = 0
    open: float | None = None
    high: float | None = None
    low: float | None = None


@dataclass
class NormalizedNewsItem:
    title: str
    publisher: str | None = None
    url: str | None = None
    published_at: str | None = None
    source: str = "unknown"
    summary: str | None = None
    sentiment: str | None = None
    sentiment_score: float | None = None


@dataclass
class NormalizedMarketSnapshot:
    ticker: str
    company_name: str | None = None
    exchange: str | None = None
    sector: str | None = None
    industry: str | None = None
    currency: str | None = None
    latest_price: float | None = None
    previous_close: float | None = None
    daily_change: float | None = None
    open_price: float | None = None
    day_high: float | None = None
    day_low: float | None = None
    volume: int | None = None
    market_cap: float | None = None
    pe_ratio: float | None = None
    fifty_two_week_high: float | None = None
    fifty_two_week_low: float | None = None
    dividend_yield: float | None = None
    dividend_rate: float | None = None
    fundamentals: dict[str, Any] = field(default_factory=dict)
    technical_indicators: dict[str, Any] = field(default_factory=dict)
    risk_metrics: dict[str, Any] = field(default_factory=dict)
    analyst_context: dict[str, Any] = field(default_factory=dict)
    filing_context: dict[str, Any] = field(default_factory=dict)
    sentiment_summary: dict[str, Any] = field(default_factory=dict)
    news_items: list[NormalizedNewsItem] = field(default_factory=list)
    history: list[NormalizedMarketPoint] = field(default_factory=list)
    history_frame: pd.DataFrame = field(default_factory=pd.DataFrame, repr=False)
    data_sources: list[str] = field(default_factory=list)
    provider_status: list[ProviderStatus] = field(default_factory=list)
    evidence_items: list[EvidenceItem] = field(default_factory=list)
    source_quality: dict[str, Any] = field(default_factory=dict)


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


def _safe_pct(latest: float | None, previous: float | None) -> float | None:
    if latest is None or previous in (None, 0):
        return None
    return round((latest - previous) / previous * 100, 4)


def _get_json(url: str, params: dict[str, Any] | None = None, headers: dict[str, str] | None = None) -> dict[str, Any] | list[Any]:
    query = f"?{urlencode({k: v for k, v in (params or {}).items() if v is not None})}" if params else ""
    request = Request(
        f"{url}{query}",
        headers={
            "User-Agent": settings.sec_user_agent,
            "Accept": "application/json",
            **(headers or {}),
        },
    )
    with urlopen(request, timeout=settings.market_data_timeout_seconds) as response:
        return json.loads(response.read().decode("utf-8"))


def _period_start(period: str) -> datetime:
    days = {
        "1d": 1,
        "5d": 5,
        "7d": 7,
        "1mo": 30,
        "3mo": 90,
        "6mo": 180,
        "1y": 365,
        "2y": 730,
        "5y": 1825,
        "10y": 3650,
    }.get(period, 180)
    return datetime.now(UTC) - timedelta(days=days)


def _technical_indicators(history: pd.DataFrame) -> dict[str, Any]:
    if history.empty or "Close" not in history:
        return {"limitations": ["No close-price history available for technical indicators."]}
    close = history["Close"].dropna().astype(float)
    if len(close) < 5:
        return {"limitations": ["Insufficient close-price history for robust technical indicators."]}
    volume = history["Volume"].dropna().astype(float) if "Volume" in history else pd.Series(dtype=float)
    returns = close.pct_change().dropna()
    sma_20 = close.rolling(20).mean()
    sma_50 = close.rolling(50).mean()
    sma_200 = close.rolling(200).mean()
    ema_10 = close.ewm(span=10, adjust=False).mean()
    ema_12 = close.ewm(span=12, adjust=False).mean()
    ema_26 = close.ewm(span=26, adjust=False).mean()
    macd = ema_12 - ema_26
    signal = macd.ewm(span=9, adjust=False).mean()
    delta = close.diff()
    gain = delta.clip(lower=0).rolling(14).mean()
    loss = (-delta.clip(upper=0)).rolling(14).mean()
    rs = gain / loss.replace(0, pd.NA)
    rsi = 100 - (100 / (1 + rs))
    rolling_std = close.rolling(20).std()
    bollinger_upper = sma_20 + rolling_std * 2
    bollinger_lower = sma_20 - rolling_std * 2
    high = history["High"].astype(float) if "High" in history else close
    low = history["Low"].astype(float) if "Low" in history else close
    prev_close = close.shift(1)
    true_range = pd.concat([(high - low).abs(), (high - prev_close).abs(), (low - prev_close).abs()], axis=1).max(axis=1)
    atr_14 = true_range.rolling(14).mean()
    vwma_20 = (close * volume).rolling(20).sum() / volume.rolling(20).sum() if not volume.empty else pd.Series(dtype=float)
    latest = close.iloc[-1]
    trend = "uptrend" if pd.notna(sma_50.iloc[-1]) and latest > sma_50.iloc[-1] else "range_or_downtrend"
    return {
        "trend": trend,
        "latest_close": _clean_number(latest),
        "ema_10": _clean_number(ema_10.iloc[-1]),
        "sma_20": _clean_number(sma_20.iloc[-1]),
        "sma_50": _clean_number(sma_50.iloc[-1]),
        "sma_200": _clean_number(sma_200.iloc[-1]),
        "macd": _clean_number(macd.iloc[-1]),
        "macd_signal": _clean_number(signal.iloc[-1]),
        "rsi_14": _clean_number(rsi.iloc[-1]),
        "bollinger_upper": _clean_number(bollinger_upper.iloc[-1]),
        "bollinger_lower": _clean_number(bollinger_lower.iloc[-1]),
        "atr_14": _clean_number(atr_14.iloc[-1]),
        "vwma_20": _clean_number(vwma_20.iloc[-1]) if not vwma_20.empty else None,
        "support_20d": _clean_number(close.tail(20).min()),
        "resistance_20d": _clean_number(close.tail(20).max()),
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


def _news_sentiment(news_items: list[NormalizedNewsItem]) -> dict[str, Any]:
    if not news_items:
        return {
            "signal": "limited",
            "score": 0,
            "summary": "No recent news items were available from configured providers.",
            "limitations": ["News and sentiment evidence is limited."],
        }
    provider_scores = [item.sentiment_score for item in news_items if item.sentiment_score is not None]
    if provider_scores:
        score = sum(provider_scores) / len(provider_scores)
    else:
        positive_terms = {"beats", "growth", "raises", "record", "strong", "upgrade", "profit", "outperform"}
        negative_terms = {"misses", "cuts", "probe", "weak", "downgrade", "loss", "risk", "lawsuit"}
        score = 0.0
        for item in news_items:
            title = item.title.lower()
            score += sum(1 for term in positive_terms if term in title)
            score -= sum(1 for term in negative_terms if term in title)
    signal = "bullish" if score > 0.25 else "bearish" if score < -0.25 else "neutral"
    return {
        "signal": signal,
        "score": round(score, 4),
        "summary": f"Recent news sentiment is {signal} across {len(news_items)} source item(s).",
        "limitations": [],
    }


class MarketDataService:
    def fetch_snapshot(
        self,
        ticker: str,
        period: str = "6mo",
        interval: str = "1d",
        *,
        include_news: bool = True,
        include_sec: bool = True,
        include_fundamentals: bool = True,
    ) -> NormalizedMarketSnapshot:
        symbol = ticker.strip().upper()
        snapshot = NormalizedMarketSnapshot(ticker=symbol)
        self._apply_yfinance(snapshot, period, interval, include_news=include_news)
        self._apply_alpha_vantage(snapshot, period, interval, include_news=include_news, include_fundamentals=include_fundamentals)
        self._apply_finnhub(snapshot, include_news=include_news, include_fundamentals=include_fundamentals)
        if include_sec:
            self._apply_sec(snapshot)
        else:
            snapshot.provider_status.append(ProviderStatus("sec", "skipped", "SEC enrichment is disabled for this request."))
        self._finalize(snapshot)
        return snapshot

    def search_symbols(self, query: str, limit: int = 12) -> list[dict[str, Any]]:
        key = settings.secret_value("finnhub_api_key")
        if key:
            try:
                data = _get_json("https://finnhub.io/api/v1/search", {"q": query, "token": key})
                results = []
                for row in data.get("result", [])[:limit] if isinstance(data, dict) else []:
                    symbol = str(row.get("symbol") or "").strip().upper()
                    if symbol:
                        results.append({
                            "ticker": symbol,
                            "name": row.get("description") or symbol,
                            "exchange": row.get("primaryExchange") or row.get("type"),
                            "sector": row.get("type"),
                            "quote_type": row.get("type"),
                        })
                if results:
                    return results
            except Exception:
                pass
        search = yf.Search(query, max_results=limit, news_count=0, lists_count=0, include_research=False, include_cultural_assets=False, enable_fuzzy_query=True)
        return [
            {
                "ticker": str(row.get("symbol") or "").strip().upper(),
                "name": row.get("longname") or row.get("shortname") or row.get("symbol"),
                "exchange": row.get("exchDisp") or row.get("exchange"),
                "sector": row.get("sectorDisp") or row.get("sector") or row.get("quoteType"),
                "quote_type": row.get("typeDisp") or row.get("quoteType"),
            }
            for row in (search.quotes or [])
            if row.get("symbol")
        ][:limit]

    def _apply_finnhub(self, snapshot: NormalizedMarketSnapshot, *, include_news: bool, include_fundamentals: bool) -> None:
        key = settings.secret_value("finnhub_api_key")
        if not key:
            snapshot.provider_status.append(ProviderStatus("finnhub", "missing_config"))
            return
        try:
            quote = _get_json("https://finnhub.io/api/v1/quote", {"symbol": snapshot.ticker, "token": key})
            if isinstance(quote, dict) and quote.get("c"):
                snapshot.latest_price = snapshot.latest_price or _clean_number(quote.get("c"))
                snapshot.previous_close = snapshot.previous_close or _clean_number(quote.get("pc"))
                snapshot.open_price = snapshot.open_price or _clean_number(quote.get("o"))
                snapshot.day_high = snapshot.day_high or _clean_number(quote.get("h"))
                snapshot.day_low = snapshot.day_low or _clean_number(quote.get("l"))
                snapshot.daily_change = _safe_pct(snapshot.latest_price, snapshot.previous_close)
                snapshot.data_sources.append("finnhub_quote")
                snapshot.evidence_items.append(EvidenceItem("Latest quote", "Finnhub", f"{snapshot.latest_price}", importance="high"))
            if include_fundamentals:
                profile = _get_json("https://finnhub.io/api/v1/stock/profile2", {"symbol": snapshot.ticker, "token": key})
                if isinstance(profile, dict) and profile:
                    snapshot.company_name = snapshot.company_name or profile.get("name")
                    snapshot.exchange = snapshot.exchange or profile.get("exchange")
                    snapshot.currency = snapshot.currency or profile.get("currency")
                    finnhub_market_cap = _clean_number(profile.get("marketCapitalization"))
                    snapshot.market_cap = snapshot.market_cap or (finnhub_market_cap * 1_000_000 if finnhub_market_cap is not None else None)
                    snapshot.fundamentals.setdefault("country", profile.get("country"))
                    snapshot.fundamentals.setdefault("ipo", profile.get("ipo"))
                    snapshot.data_sources.append("finnhub_profile")
                metrics = _get_json("https://finnhub.io/api/v1/stock/metric", {"symbol": snapshot.ticker, "metric": "all", "token": key})
                metric = metrics.get("metric", {}) if isinstance(metrics, dict) else {}
                if metric:
                    snapshot.fundamentals.update({
                        "gross_margin_ttm": _clean_number(metric.get("grossMarginTTM")),
                        "net_margin_ttm": _clean_number(metric.get("netProfitMarginTTM")),
                        "revenue_growth_ttm_yoy": _clean_number(metric.get("revenueGrowthTTMYoy")),
                        "eps_growth_ttm_yoy": _clean_number(metric.get("epsGrowthTTMYoy")),
                        "current_ratio_annual": _clean_number(metric.get("currentRatioAnnual")),
                    })
                    snapshot.analyst_context.update({
                        "target_mean": _clean_number(metric.get("targetMean")),
                        "target_high": _clean_number(metric.get("targetHigh")),
                        "target_low": _clean_number(metric.get("targetLow")),
                        "recommendation_mean": _clean_number(metric.get("recommendationMean")),
                    })
                    snapshot.data_sources.append("finnhub_metrics")
            if include_news:
                end = date.today()
                start = end - timedelta(days=14)
                raw_news = _get_json(
                    "https://finnhub.io/api/v1/company-news",
                    {"symbol": snapshot.ticker, "from": start.isoformat(), "to": end.isoformat(), "token": key},
                )
                if isinstance(raw_news, list):
                    for item in raw_news[:10]:
                        title = item.get("headline")
                        if title:
                            snapshot.news_items.append(NormalizedNewsItem(
                                title=title,
                                publisher=item.get("source"),
                                url=item.get("url"),
                                published_at=datetime.fromtimestamp(item["datetime"], UTC).isoformat() if item.get("datetime") else None,
                                source="Finnhub",
                                summary=item.get("summary"),
                            ))
                    if raw_news:
                        snapshot.data_sources.append("finnhub_news")
            snapshot.provider_status.append(ProviderStatus("finnhub", "ok"))
        except Exception as exc:
            snapshot.provider_status.append(ProviderStatus("finnhub", "error", str(exc)[:160]))

    def _apply_alpha_vantage(self, snapshot: NormalizedMarketSnapshot, period: str, interval: str, *, include_news: bool, include_fundamentals: bool) -> None:
        key = settings.secret_value("alpha_vantage_api_key")
        if not key:
            snapshot.provider_status.append(ProviderStatus("alpha_vantage", "missing_config"))
            return
        try:
            if include_fundamentals:
                overview = _get_json("https://www.alphavantage.co/query", {"function": "OVERVIEW", "symbol": snapshot.ticker, "apikey": key})
                if isinstance(overview, dict) and overview.get("Symbol"):
                    snapshot.company_name = snapshot.company_name or overview.get("Name")
                    snapshot.exchange = snapshot.exchange or overview.get("Exchange")
                    snapshot.currency = snapshot.currency or overview.get("Currency")
                    snapshot.sector = snapshot.sector or overview.get("Sector")
                    snapshot.industry = snapshot.industry or overview.get("Industry")
                    snapshot.market_cap = snapshot.market_cap or _clean_number(overview.get("MarketCapitalization"))
                    snapshot.pe_ratio = snapshot.pe_ratio or _clean_number(overview.get("PERatio"))
                    snapshot.dividend_yield = snapshot.dividend_yield or _clean_number(overview.get("DividendYield"))
                    snapshot.fundamentals.update({
                        "trailing_pe": _clean_number(overview.get("PERatio")),
                        "forward_pe": _clean_number(overview.get("ForwardPE")),
                        "price_to_book": _clean_number(overview.get("PriceToBookRatio")),
                        "profit_margins": _clean_number(overview.get("ProfitMargin")),
                        "revenue_ttm": _clean_number(overview.get("RevenueTTM")),
                        "gross_profit_ttm": _clean_number(overview.get("GrossProfitTTM")),
                        "eps_ttm": _clean_number(overview.get("EPS")),
                        "ebitda": _clean_number(overview.get("EBITDA")),
                        "return_on_equity_ttm": _clean_number(overview.get("ReturnOnEquityTTM")),
                        "quarterly_revenue_growth_yoy": _clean_number(overview.get("QuarterlyRevenueGrowthYOY")),
                        "quarterly_earnings_growth_yoy": _clean_number(overview.get("QuarterlyEarningsGrowthYOY")),
                        "beta": _clean_number(overview.get("Beta")),
                    })
                    snapshot.analyst_context.update({
                        "analyst_target_price": _clean_number(overview.get("AnalystTargetPrice")),
                        "analyst_rating_buy": _clean_number(overview.get("AnalystRatingBuy")),
                        "analyst_rating_hold": _clean_number(overview.get("AnalystRatingHold")),
                        "analyst_rating_sell": _clean_number(overview.get("AnalystRatingSell")),
                    })
                    snapshot.data_sources.append("alpha_vantage_overview")
                    snapshot.evidence_items.append(EvidenceItem("Company overview", "Alpha Vantage", overview.get("Description"), importance="high"))
            if interval == "1d":
                function = "TIME_SERIES_DAILY_ADJUSTED"
                raw = _get_json("https://www.alphavantage.co/query", {"function": function, "symbol": snapshot.ticker, "outputsize": "compact", "apikey": key})
                series = raw.get("Time Series (Daily)", {}) if isinstance(raw, dict) else {}
                if series:
                    rows = []
                    for day, values in series.items():
                        rows.append({
                            "Date": pd.to_datetime(day),
                            "Open": _clean_number(values.get("1. open")),
                            "High": _clean_number(values.get("2. high")),
                            "Low": _clean_number(values.get("3. low")),
                            "Close": _clean_number(values.get("5. adjusted close") or values.get("4. close")),
                            "Volume": _clean_number(values.get("6. volume")),
                        })
                    frame = pd.DataFrame(rows).dropna(subset=["Close"]).sort_values("Date").set_index("Date")
                    if not frame.empty and (snapshot.history_frame is None or snapshot.history_frame.empty):
                        cutoff = _period_start(period).replace(tzinfo=None)
                        snapshot.history_frame = frame[frame.index >= cutoff] if period != "max" else frame
                        snapshot.data_sources.append("alpha_vantage_daily_adjusted")
            if include_news:
                news = _get_json("https://www.alphavantage.co/query", {"function": "NEWS_SENTIMENT", "tickers": snapshot.ticker, "limit": 12, "apikey": key})
                feed = news.get("feed", []) if isinstance(news, dict) else []
                for item in feed[:8]:
                    title = item.get("title")
                    if title:
                        snapshot.news_items.append(NormalizedNewsItem(
                            title=title,
                            publisher=item.get("source"),
                            url=item.get("url"),
                            published_at=item.get("time_published"),
                            source="Alpha Vantage",
                            summary=item.get("summary"),
                            sentiment=item.get("overall_sentiment_label"),
                            sentiment_score=_clean_number(item.get("overall_sentiment_score")),
                        ))
                if feed:
                    snapshot.data_sources.append("alpha_vantage_news_sentiment")
            snapshot.provider_status.append(ProviderStatus("alpha_vantage", "ok"))
        except Exception as exc:
            snapshot.provider_status.append(ProviderStatus("alpha_vantage", "error", str(exc)[:160]))

    def _apply_sec(self, snapshot: NormalizedMarketSnapshot) -> None:
        try:
            if not snapshot.ticker.isalpha():
                snapshot.provider_status.append(ProviderStatus("sec", "skipped", "Ticker is not a simple U.S. equity symbol."))
                return
            tickers = _get_json("https://www.sec.gov/files/company_tickers.json")
            match = None
            if isinstance(tickers, dict):
                match = next((row for row in tickers.values() if str(row.get("ticker", "")).upper() == snapshot.ticker), None)
            if not match:
                snapshot.provider_status.append(ProviderStatus("sec", "skipped", "No SEC ticker match."))
                return
            cik = str(match["cik_str"]).zfill(10)
            submissions = _get_json(f"https://data.sec.gov/submissions/CIK{cik}.json")
            recent = submissions.get("filings", {}).get("recent", {}) if isinstance(submissions, dict) else {}
            forms = recent.get("form", [])[:40]
            dates = recent.get("filingDate", [])[:40]
            accession = recent.get("accessionNumber", [])[:40]
            filings = []
            for form, filed, acc in zip(forms, dates, accession):
                if form in {"10-K", "10-Q", "8-K"}:
                    filings.append({"form": form, "filing_date": filed, "accession": acc})
                if len(filings) >= 6:
                    break
            snapshot.filing_context = {
                "cik": cik,
                "entity_name": match.get("title"),
                "recent_filings": filings,
            }
            snapshot.company_name = snapshot.company_name or match.get("title")
            snapshot.data_sources.append("sec_edgar_submissions")
            snapshot.evidence_items.append(EvidenceItem("SEC filing history", "SEC EDGAR", f"CIK {cik}; {len(filings)} recent filings", importance="high"))
            snapshot.provider_status.append(ProviderStatus("sec", "ok"))
        except Exception as exc:
            snapshot.provider_status.append(ProviderStatus("sec", "error", str(exc)[:160]))

    def _apply_yfinance(self, snapshot: NormalizedMarketSnapshot, period: str, interval: str, *, include_news: bool) -> None:
        try:
            ticker = yf.Ticker(snapshot.ticker)
            info = ticker.info or {}
            history = ticker.history(period=period, interval=interval, auto_adjust=True)
            snapshot.company_name = info.get("longName") or info.get("shortName") or snapshot.company_name
            snapshot.exchange = info.get("exchange") or info.get("fullExchangeName") or snapshot.exchange
            snapshot.sector = info.get("sector") or info.get("quoteType") or snapshot.sector
            snapshot.industry = info.get("industry") or snapshot.industry
            snapshot.currency = info.get("currency") or snapshot.currency
            snapshot.latest_price = _clean_number(info.get("regularMarketPrice") or info.get("currentPrice")) or snapshot.latest_price
            snapshot.previous_close = _clean_number(info.get("regularMarketPreviousClose") or info.get("previousClose")) or snapshot.previous_close
            snapshot.open_price = _clean_number(info.get("regularMarketOpen")) or snapshot.open_price
            snapshot.day_high = _clean_number(info.get("dayHigh")) or snapshot.day_high
            snapshot.day_low = _clean_number(info.get("dayLow")) or snapshot.day_low
            snapshot.market_cap = _clean_number(info.get("marketCap")) or snapshot.market_cap
            snapshot.volume = int(_clean_number(info.get("regularMarketVolume") or info.get("volume")) or 0) or snapshot.volume
            snapshot.pe_ratio = _clean_number(info.get("trailingPE") or info.get("forwardPE")) or snapshot.pe_ratio
            snapshot.fifty_two_week_high = _clean_number(info.get("fiftyTwoWeekHigh")) or snapshot.fifty_two_week_high
            snapshot.fifty_two_week_low = _clean_number(info.get("fiftyTwoWeekLow")) or snapshot.fifty_two_week_low
            snapshot.dividend_yield = _clean_number(info.get("dividendYield")) or snapshot.dividend_yield
            snapshot.dividend_rate = _clean_number(info.get("dividendRate")) or snapshot.dividend_rate
            snapshot.fundamentals.update({
                "trailing_pe": snapshot.pe_ratio,
                "forward_pe": _clean_number(info.get("forwardPE")),
                "price_to_book": _clean_number(info.get("priceToBook")),
                "profit_margins": _clean_number(info.get("profitMargins")),
                "revenue_growth": _clean_number(info.get("revenueGrowth")),
                "earnings_growth": _clean_number(info.get("earningsGrowth")),
                "debt_to_equity": _clean_number(info.get("debtToEquity")),
                "free_cashflow": _clean_number(info.get("freeCashflow")),
                "sector": snapshot.sector,
                "industry": snapshot.industry,
            })
            if not history.empty:
                snapshot.history_frame = history
                if "Close" in history:
                    close = history["Close"].dropna()
                    if not close.empty:
                        snapshot.latest_price = snapshot.latest_price or _clean_number(close.iloc[-1])
                        if snapshot.previous_close is None and len(close) > 1:
                            snapshot.previous_close = _clean_number(close.iloc[-2])
                if "Volume" in history and snapshot.volume is None:
                    snapshot.volume = int(_clean_number(history["Volume"].dropna().iloc[-1]) or 0)
            if include_news:
                for item in (ticker.news or [])[:10]:
                    if not isinstance(item, dict):
                        continue
                    content = item.get("content") if isinstance(item.get("content"), dict) else {}
                    title = item.get("title") or content.get("title")
                    if not title:
                        continue
                    provider_data = content.get("provider") if isinstance(content.get("provider"), dict) else {}
                    canonical_url = content.get("canonicalUrl") if isinstance(content.get("canonicalUrl"), dict) else {}
                    click_url = content.get("clickThroughUrl") if isinstance(content.get("clickThroughUrl"), dict) else {}
                    provider = item.get("publisher") or provider_data.get("displayName") or "Yahoo Finance"
                    link = item.get("link") or canonical_url.get("url") or click_url.get("url")
                    published = item.get("providerPublishTime") or content.get("pubDate")
                    if isinstance(published, (int, float)):
                        published = datetime.fromtimestamp(published, UTC).isoformat()
                    snapshot.news_items.append(NormalizedNewsItem(
                        title=title,
                        publisher=provider,
                        url=link,
                        published_at=str(published) if published else None,
                        source="Yahoo Finance",
                        summary=item.get("summary") or content.get("summary"),
                    ))
                if snapshot.news_items:
                    snapshot.data_sources.append("yfinance_news")
            snapshot.data_sources.append("yfinance_fallback")
            snapshot.provider_status.append(ProviderStatus("yfinance", "ok"))
        except Exception as exc:
            snapshot.provider_status.append(ProviderStatus("yfinance", "error", str(exc)[:160]))

    def _finalize(self, snapshot: NormalizedMarketSnapshot) -> None:
        if snapshot.history_frame is not None and not snapshot.history_frame.empty:
            frame = snapshot.history_frame.tail(500)
            snapshot.history = []
            for index, row in frame.iterrows():
                if pd.isna(row.get("Close")):
                    continue
                if hasattr(index, "strftime"):
                    is_intraday = any(getattr(index, part, 0) for part in ("hour", "minute", "second"))
                    label = index.strftime("%H:%M") if is_intraday else index.strftime("%b %d")
                else:
                    label = str(index)
                snapshot.history.append(NormalizedMarketPoint(
                    label=label,
                    price=round(float(row["Close"]), 2),
                    volume=int(row.get("Volume", 0) or 0),
                    open=_clean_number(row.get("Open")),
                    high=_clean_number(row.get("High")),
                    low=_clean_number(row.get("Low")),
                ))
            snapshot.technical_indicators = _technical_indicators(snapshot.history_frame)
            snapshot.risk_metrics = _risk_metrics(snapshot.history_frame)
        snapshot.daily_change = snapshot.daily_change if snapshot.daily_change is not None else _safe_pct(snapshot.latest_price, snapshot.previous_close)
        snapshot.sentiment_summary = _news_sentiment(_dedupe_news(snapshot.news_items))
        snapshot.news_items = _dedupe_news(snapshot.news_items)[:12]
        snapshot.data_sources = list(dict.fromkeys(snapshot.data_sources))
        primary = [src for src in snapshot.data_sources if src.startswith("yfinance")]
        enrichment = [src for src in snapshot.data_sources if not src.startswith("yfinance")]
        limitations = []
        if not enrichment:
            limitations.append("Only Yahoo Finance/yfinance primary data was available.")
        if not settings.secret_value("finnhub_api_key"):
            limitations.append("Finnhub is not configured.")
        if not settings.secret_value("alpha_vantage_api_key"):
            limitations.append("Alpha Vantage is not configured.")
        snapshot.source_quality = {
            "primary_sources": primary,
            "enrichment_sources": enrichment,
            "fallback_sources": enrichment,
            "provider_count": len({status.provider for status in snapshot.provider_status if status.status == "ok"}),
            "limitations": limitations,
            "generated_at": datetime.now(UTC).isoformat(),
        }


def _dedupe_news(items: list[NormalizedNewsItem]) -> list[NormalizedNewsItem]:
    seen: set[str] = set()
    deduped: list[NormalizedNewsItem] = []
    for item in items:
        key = (item.url or item.title).strip().lower()
        if key and key not in seen:
            seen.add(key)
            deduped.append(item)
    return deduped


market_data_service = MarketDataService()
