from datetime import date
from uuid import uuid4

import pytest
from fastapi import HTTPException

from src.agent.equity_research.entitlements import apply_research_entitlements
from src.agent.equity_research.orchestrator import _final_decision, _pm_report
from src.models.equity_research import EquityResearchRun, EquityResearchRunCreate, EquityResearchSnapshot, ReportType, ResearchDepth
from src.saas.models import AuthenticatedUser, Plan


def test_ticker_validation_normalizes_uppercase():
    payload = EquityResearchRunCreate(ticker="aapl")
    assert payload.ticker == "AAPL"
    assert payload.report_type == ReportType.INVESTMENT


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
    assert effective.report_type == ReportType.INVESTMENT


def test_trading_report_requires_trader_plan():
    pro = AuthenticatedUser(id=uuid4(), plan=Plan.PRO, is_guest=False)
    payload = EquityResearchRunCreate(ticker="AAPL", report_type=ReportType.TRADING)
    effective = apply_research_entitlements(payload, pro)
    assert effective.report_type == ReportType.INVESTMENT

    trader = AuthenticatedUser(id=uuid4(), plan=Plan.TRADER, is_guest=False)
    effective = apply_research_entitlements(payload, trader)
    assert effective.report_type == ReportType.TRADING


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


def test_pm_report_uses_trading_structure():
    run = EquityResearchRun(run_id=uuid4(), ticker="AAPL", analysis_date=date.today(), report_type=ReportType.TRADING)
    snapshot = EquityResearchSnapshot(
        run_id=run.run_id,
        ticker="AAPL",
        analysis_date=date.today(),
        latest_price=100,
        technical_indicators={"trend": "uptrend", "support_20d": 95, "resistance_20d": 110},
        fundamentals={"revenue_growth": 0.1},
        sentiment_summary={"signal": "bullish", "score": 0.3},
    )
    markdown, points, _, _ = _pm_report(run, snapshot, {})
    assert "# Final Trading Bias" in markdown
    assert "## Technical Setup" in markdown
    assert "## Trade Plan" in markdown
    assert "Final Trading Bias: Bullish / Neutral / Bearish" in markdown
    assert any("Final Trading Bias" in point for point in points)


def test_pm_report_uses_investment_structure():
    run = EquityResearchRun(run_id=uuid4(), ticker="AAPL", analysis_date=date.today(), report_type=ReportType.INVESTMENT)
    snapshot = EquityResearchSnapshot(
        run_id=run.run_id,
        ticker="AAPL",
        company_name="Apple Inc.",
        analysis_date=date.today(),
        latest_price=100,
        market_cap=3_000_000_000_000,
        technical_indicators={"trend": "uptrend"},
        fundamentals={"sector": "Technology", "industry": "Consumer Electronics", "revenue_growth": 0.1},
        sentiment_summary={"signal": "neutral", "score": 0},
    )
    markdown, points, _, _ = _pm_report(run, snapshot, {})
    assert "# Final Investment View" in markdown
    assert "## Long-Term Thesis" in markdown
    assert "## Portfolio Fit" in markdown
    assert "Final Investment View: Accumulate / Watchlist / Avoid" in markdown
    assert any("Final Investment View" in point for point in points)
