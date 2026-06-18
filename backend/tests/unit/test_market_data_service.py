import pandas as pd

from src.data.market_data_service import (
    NormalizedMarketSnapshot,
    NormalizedNewsItem,
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
    snapshot = NormalizedMarketSnapshot(ticker="AAPL", data_sources=["finnhub_quote", "alpha_vantage_overview"])

    assert snapshot.ticker == "AAPL"
    assert snapshot.data_sources[0] == "finnhub_quote"
