from datetime import UTC, datetime

import pandas as pd

from src.agent.consensus_evidence import (
    build_consensus_evidence,
    optimizer_requested,
    resolve_consensus_symbols,
)
from src.data.market_data_service import (
    EvidenceItem,
    NormalizedMarketSnapshot,
)


class FakeMarketDataService:
    def search_symbols(self, query: str, limit: int = 12):
        supported = {"SNDK": "Sandisk", "MU": "Micron"}
        symbol = query.upper()
        return (
            [{"ticker": symbol, "name": supported[symbol]}]
            if symbol in supported
            else []
        )

    def fetch_snapshot(self, ticker: str, **_kwargs):
        closes = pd.Series(
            [100 + index * 0.4 for index in range(220)],
            index=pd.date_range("2025-10-01", periods=220, freq="B", tz="UTC"),
        )
        return NormalizedMarketSnapshot(
            ticker=ticker,
            company_name={"SNDK": "Sandisk", "MU": "Micron"}[ticker],
            currency="USD",
            latest_price=float(closes.iloc[-1]),
            daily_change=2.5,
            quote_timestamp=datetime.now(UTC).isoformat(),
            volume=1_000_000,
            market_cap=50_000_000_000,
            history_frame=pd.DataFrame({"Close": closes}),
            data_sources=["yfinance_history"],
            evidence_items=[EvidenceItem("Latest quote", "Yahoo Finance")],
            source_quality={"limitations": []},
        )


def test_resolves_lowercase_tickers_in_multi_asset_decision_query():
    service = FakeMarketDataService()

    assert resolve_consensus_symbols(
        "should I buy sndk and mu right now?", service
    ) == [
        "SNDK",
        "MU",
    ]
    assert resolve_consensus_symbols("should I buy more mu?", service) == ["MU"]


def test_builds_shared_timestamped_evidence_for_every_ticker():
    bundle = build_consensus_evidence(
        "should I buy SNDK and MU right now?", FakeMarketDataService()
    )

    assert bundle.evidence_status == "complete"
    assert [asset.symbol for asset in bundle.assets] == ["SNDK", "MU"]
    assert all(
        asset.metrics["trend_label"] == "confirmed_uptrend" for asset in bundle.assets
    )
    assert all(asset.sources for asset in bundle.assets)
    assert "SNDK-MU" in bundle.correlations


def test_optimizer_is_only_enabled_for_explicit_allocation_intent():
    assert optimizer_requested("Should I buy SNDK and MU?") is False
    assert optimizer_requested("How should I allocate between SNDK and MU?") is True
