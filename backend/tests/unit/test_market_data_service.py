import pandas as pd

from src.data import market_data_service as market_data_module

from src.data.market_data_service import (
    NormalizedMarketSnapshot,
    NormalizedNewsItem,
    MarketDataService,
    _dedupe_symbol_results,
    _dedupe_news,
    _normalize_earnings_dates,
    _normalize_finnhub_calendar,
    _normalize_yfinance_calendar,
    _risk_metrics,
    _technical_indicators,
)


def test_normalize_earnings_dates_preserves_estimates_and_missing_actuals():
    frame = pd.DataFrame(
        {
            "EPS Estimate": [1.85, 1.72],
            "Reported EPS": [float("nan"), 1.80],
            "Surprise(%)": [float("nan"), 4.65],
        },
        index=pd.to_datetime(["2026-11-05T16:00:00-05:00", "2026-08-06T16:00:00-05:00"]),
    )

    earnings = _normalize_earnings_dates(frame)

    assert [point["date"] for point in earnings] == ["2026-08-06", "2026-11-05"]
    assert earnings[0]["eps_actual"] == 1.8
    assert earnings[0]["session"] == "post"
    assert earnings[1]["eps_actual"] is None
    assert earnings[1]["eps_estimate"] == 1.85


def test_normalize_earnings_dates_does_not_invent_timing_for_date_only_values():
    frame = pd.DataFrame(
        {"EPS Estimate": [2.10], "Reported EPS": [float("nan")]},
        index=pd.to_datetime(["2026-12-01"]),
    )

    earnings = _normalize_earnings_dates(frame)

    assert earnings[0]["session"] == "unknown"


def test_normalize_yfinance_calendar_preserves_real_symbol_date_and_timing():
    frame = pd.DataFrame(
        {
            "Company": ["NVIDIA Corporation"],
            "Marketcap": [5_200_000_000_000],
            "Event Start Date": pd.to_datetime(["2026-08-26T20:00:00Z"]),
            "Timing": ["AMC"],
            "EPS Estimate": [2.08],
            "Reported EPS": [float("nan")],
            "Surprise(%)": [float("nan")],
        },
        index=["NVDA"],
    )

    events = _normalize_yfinance_calendar(frame)

    assert events[0]["symbol"] == "NVDA"
    assert events[0]["date"] == "2026-08-26"
    assert events[0]["session"] == "post"
    assert events[0]["eps_estimate"] == 2.08


def test_normalize_finnhub_calendar_includes_revenue_and_session():
    events = _normalize_finnhub_calendar({"earningsCalendar": [{
        "symbol": "WMT",
        "date": "2026-08-20",
        "hour": "bmo",
        "epsEstimate": 0.74,
        "revenueEstimate": 180_000_000_000,
    }]})

    assert events[0]["session"] == "pre"
    assert events[0]["revenue_estimate"] == 180_000_000_000


def test_dedupe_news_prefers_url_or_title():
    items = [
        NormalizedNewsItem(title="Apple raises guidance", url="https://example.com/a", source="Finnhub"),
        NormalizedNewsItem(title="Different title", url="https://example.com/a", source="Alpha Vantage"),
        NormalizedNewsItem(title="Apple raises guidance", source="Alpha Vantage"),
    ]

    deduped = _dedupe_news(items)

    assert len(deduped) == 2
    assert deduped[0].source == "Finnhub"


def test_technical_indicators_include_trader_native_metrics():
    history = pd.DataFrame(
        {
            "Open": [100 + i for i in range(60)],
            "High": [101 + i for i in range(60)],
            "Low": [99 + i for i in range(60)],
            "Close": [100 + i for i in range(60)],
            "Volume": [1_000_000 + i for i in range(60)],
        }
    )

    indicators = _technical_indicators(history)

    assert indicators["trend"] == "uptrend"
    assert indicators["ema_10"] is not None
    assert indicators["vwma_20"] is not None
    assert indicators["atr_14"] is not None


def test_risk_metrics_report_drawdown_and_var():
    history = pd.DataFrame({"Close": [100, 102, 99, 105, 95, 98]})

    metrics = _risk_metrics(history)

    assert metrics["daily_var_95"] is not None
    assert metrics["max_drawdown_window"] is not None


def test_snapshot_source_quality_shape_is_extensible():
    snapshot = NormalizedMarketSnapshot(
        ticker="AAPL",
        quote_timestamp="2026-07-21T19:45:00+00:00",
        data_sources=["finnhub_quote", "alpha_vantage_overview"],
    )

    assert snapshot.ticker == "AAPL"
    assert snapshot.data_sources[0] == "finnhub_quote"
    assert snapshot.quote_timestamp == "2026-07-21T19:45:00+00:00"


def test_sec_enrichment_preserves_current_and_former_company_identity(monkeypatch):
    def fake_get_json(url, *args, **kwargs):
        if url.endswith("company_tickers.json"):
            return {
                "0": {
                    "ticker": "SNDK",
                    "title": "SANDISK CORP",
                    "cik_str": 200406,
                }
            }
        return {
            "name": "Sandisk Corporation",
            "tickers": ["SNDK"],
            "exchanges": ["Nasdaq"],
            "formerNames": [{"name": "Sandisk SpinCo, Inc.", "from": "2024-02-05", "to": "2025-01-28"}],
            "filings": {
                "recent": {
                    "form": ["8-K"],
                    "filingDate": ["2026-07-18"],
                    "accessionNumber": ["000000-26-000001"],
                }
            },
        }

    monkeypatch.setattr(market_data_module, "_get_json", fake_get_json)
    snapshot = NormalizedMarketSnapshot(ticker="SNDK")

    MarketDataService()._apply_sec(snapshot)

    assert snapshot.filing_context["entity_name"] == "Sandisk Corporation"
    assert snapshot.filing_context["tickers"] == ["SNDK"]
    assert snapshot.filing_context["former_names"][0]["name"] == "Sandisk SpinCo, Inc."
    assert snapshot.evidence_items[0].url == "https://data.sec.gov/submissions/CIK0000200406.json"


def test_symbol_search_dedupes_by_ticker_and_prefers_exchange_metadata():
    results = _dedupe_symbol_results(
        [
            {"ticker": "SAND.ST", "name": "SANDVIK AB", "exchange": None, "sector": None, "quote_type": "Common Stock"},
            {"ticker": "SAND.ST", "name": "Sandvik AB", "exchange": "Stockholm", "sector": "Industrials", "quote_type": "Equity"},
        ],
        12,
    )

    assert results == [
        {
            "ticker": "SAND.ST",
            "name": "SANDVIK AB",
            "exchange": "Stockholm",
            "sector": "Industrials",
            "quote_type": "Common Stock",
        }
    ]


def test_symbol_search_does_not_treat_common_stock_as_exchange():
    results = _dedupe_symbol_results(
        [{"ticker": "SNDK", "name": "SANDISK CORP", "exchange": "Common Stock", "sector": None, "quote_type": "Common Stock"}],
        12,
    )

    assert results[0]["exchange"] is None
    assert results[0]["quote_type"] == "Common Stock"
