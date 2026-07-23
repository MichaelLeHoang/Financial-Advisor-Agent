import pandas as pd

from src.data import market_data_service as market_data_module

from src.data.market_data_service import (
    NormalizedMarketSnapshot,
    NormalizedNewsItem,
    MarketDataService,
    _dedupe_symbol_results,
    _dedupe_news,
    _risk_metrics,
    _technical_indicators,
)


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
