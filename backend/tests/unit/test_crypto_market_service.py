from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import pandas as pd
import pytest

from src.data import crypto_market_service as module


def fresh_service():
    return module.CryptoMarketService()


@pytest.mark.parametrize(
    ("value", "classification"),
    [
        (24, "Extreme fear"),
        (25, "Fear"),
        (44, "Fear"),
        (45, "Neutral"),
        (55, "Neutral"),
        (56, "Greed"),
        (74, "Greed"),
        (75, "Extreme greed"),
    ],
)
def test_fear_greed_classification_boundaries(value, classification):
    assert fresh_service().fear_greed_classification(value) == classification


def test_series_calculates_long_term_moving_averages(monkeypatch):
    start = datetime.now(UTC) - timedelta(days=590)
    prices = []
    volumes = []
    market_caps = []
    for index in range(591):
        timestamp = int((start + timedelta(days=index)).timestamp() * 1000)
        prices.append([timestamp, float(index + 1)])
        volumes.append([timestamp, float(1_000 + index)])
        market_caps.append([timestamp, float(10_000 + index)])

    monkeypatch.setattr(
        module,
        "_get_json",
        lambda *args, **kwargs: {
            "prices": prices,
            "total_volumes": volumes,
            "market_caps": market_caps,
        },
    )

    result = fresh_service().series("BTC", "CAD", "1Y")

    assert result.base_asset == "BTC"
    assert result.quote_currency == "CAD"
    assert len(result.points) >= 360
    assert result.points[0].sma_200 is not None
    assert result.points[-1].sma_50 == pytest.approx(sum(range(542, 592)) / 50)
    assert result.points[-1].sma_100 == pytest.approx(sum(range(492, 592)) / 100)
    assert result.points[-1].sma_200 == pytest.approx(sum(range(392, 592)) / 200)


def test_series_falls_back_to_normalized_yfinance_history(monkeypatch):
    monkeypatch.setattr(module, "_get_json", lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError("provider limit")))
    start = datetime.now(UTC) - timedelta(days=590)
    index = pd.date_range(start=start, periods=591, freq="D")
    frame = pd.DataFrame({"Close": [float(value) for value in range(1, 592)], "Volume": [1_000] * 591}, index=index)
    monkeypatch.setattr(
        module.market_data_service,
        "fetch_snapshot",
        lambda *args, **kwargs: SimpleNamespace(history_frame=frame),
    )

    result = fresh_service().series("BTC", "CAD", "1Y")

    assert result.points[-1].sma_200 is not None
    assert result.data_sources == ["yfinance"]
    assert [status.status for status in result.provider_status] == ["error", "ok"]


def test_mempool_normalizes_backlog_and_recommended_fees(monkeypatch):
    def fake_get_json(url, *args, **kwargs):
        if url.endswith("/api/mempool"):
            return {"count": 74_081, "vsize": 39_700_000, "total_fee": 125_000_000}
        if url.endswith("/fees/recommended"):
            return {"fastestFee": 8, "halfHourFee": 5, "hourFee": 3, "economyFee": 2, "minimumFee": 1}
        if url.endswith("/blocks/tip/height"):
            return 961_806
        raise AssertionError(url)

    monkeypatch.setattr(module, "_get_json", fake_get_json)

    result = fresh_service().mempool()

    assert result.block_height == 961_806
    assert result.unconfirmed_transactions == 74_081
    assert result.virtual_size_bytes == 39_700_000
    assert result.total_fees_btc == pytest.approx(1.25)
    assert result.fastest_fee_sats_vb == 8


def test_defi_sorts_top_chains_and_keeps_dex_volume(monkeypatch):
    def fake_get_json(url, *args, **kwargs):
        if url.endswith("/v2/chains"):
            return [{"name": "Solana", "tvl": 4_900_000_000}, {"name": "Ethereum", "tvl": 41_600_000_000}]
        if "/overview/dexs" in url:
            return {"total24h": 4_280_000_000}
        raise AssertionError(url)

    monkeypatch.setattr(module, "_get_json", fake_get_json)

    result = fresh_service().defi()

    assert result.total_value_locked_usd == 46_500_000_000
    assert result.dex_volume_24h_usd == 4_280_000_000
    assert [chain.name for chain in result.top_chains] == ["Ethereum", "Solana"]


def test_halving_progress_uses_block_height(monkeypatch):
    monkeypatch.setattr(
        module,
        "_get_json",
        lambda *args, **kwargs: {
            "n_blocks_total": 945_000,
            "n_blocks_mined": 144,
        },
    )

    result = fresh_service().halving()

    assert result.progress_pct == 50
    assert result.blocks_completed == 105_000
    assert result.blocks_remaining == 105_000
    assert result.average_block_minutes == 10


def test_overview_rejects_unknown_assets():
    with pytest.raises(ValueError, match="Unsupported crypto asset"):
        fresh_service().overview("UNKNOWN", "CAD")


def test_context_keeps_sentiment_when_network_provider_fails(monkeypatch):
    now = int(datetime.now(UTC).timestamp())

    def fake_get_json(url, *args, **kwargs):
        if "alternative.me" in url:
            return {"data": [{"value": "62", "timestamp": str(now)}]}
        raise RuntimeError("network unavailable")

    monkeypatch.setattr(module, "_get_json", fake_get_json)

    result = fresh_service().context("BTC", "CAD", "14D")

    assert result.fear_greed is not None
    assert result.fear_greed.current_value == 62
    assert result.halving is None
    assert any(status.provider == "blockchain.com" and status.status == "error" for status in result.provider_status)
