from datetime import date
from uuid import uuid4

import pytest
from fastapi import HTTPException

from src.agent.equity_research.entitlements import apply_research_entitlements
from src.agent.equity_research.orchestrator import _final_decision
from src.models.equity_research import EquityResearchRunCreate, EquityResearchSnapshot, ResearchDepth
from src.saas.models import AuthenticatedUser, Plan


def test_ticker_validation_normalizes_uppercase():
    payload = EquityResearchRunCreate(ticker="aapl")
    assert payload.ticker == "AAPL"


def test_ticker_validation_rejects_invalid_symbol():
    with pytest.raises(ValueError):
        EquityResearchRunCreate(ticker="AAPL;DROP")


def test_guest_ticker_allowlist_blocks_unknown_symbol():
    guest = AuthenticatedUser(id=uuid4(), plan=Plan.FREE, is_guest=True)
    payload = EquityResearchRunCreate(ticker="XYZOTC")
    with pytest.raises(HTTPException):
        apply_research_entitlements(payload, guest)


def test_guest_is_forced_to_shallow_default_config():
    guest = AuthenticatedUser(id=uuid4(), plan=Plan.FREE, is_guest=True)
    payload = EquityResearchRunCreate(ticker="AAPL", research_depth=ResearchDepth.DEEP, selected_analysts=["market"])
    effective = apply_research_entitlements(payload, guest)
    assert effective.research_depth == ResearchDepth.SHALLOW
    assert effective.selected_analysts == ["market", "social", "news", "fundamentals"]


def test_final_decision_returns_insufficient_data_without_price():
    snapshot = EquityResearchSnapshot(
        run_id=uuid4(),
        ticker="AAPL",
        analysis_date=date.today(),
        latest_price=None,
        fundamentals={},
        technical_indicators={},
    )
    recommendation, confidence, _, risk, _ = _final_decision(snapshot, {})
    assert recommendation == "insufficient_data"
    assert confidence == 0.25
    assert "Price data" in risk
