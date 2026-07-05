from datetime import date
from uuid import uuid4

import pytest
from fastapi import HTTPException

from src.agent.equity_research.entitlements import (
    apply_research_entitlements,
    research_deep_report_limit,
    research_report_limit,
)
from src.agent.equity_research.orchestrator import (
    MAX_REPORT_LINE_CHARS,
    MAX_TABLE_CELL_CHARS,
    _build_decision_workspace,
    _final_decision,
    _pm_report,
    _sanitize_llm_report_markdown,
)
from src.models.equity_research import (
    AgentStatus,
    EquityResearchReport,
    EquityResearchRun,
    EquityResearchRunCreate,
    EquityResearchSnapshot,
    InvestmentDecision,
    ReportType,
    ResearchDepth,
    TradingBias,
)
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
    payload = EquityResearchRunCreate(
        ticker="AAPL", research_depth=ResearchDepth.DEEP, selected_analysts=["market"]
    )
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


def test_research_plan_limits_are_configured():
    free = AuthenticatedUser(id=uuid4(), plan=Plan.FREE, is_guest=False)
    trader = AuthenticatedUser(id=uuid4(), plan=Plan.TRADER, is_guest=False)
    execution = AuthenticatedUser(id=uuid4(), plan=Plan.EXECUTION_ADDON, is_guest=False)

    assert research_report_limit(free) == 5
    assert research_report_limit(trader) == 150
    assert research_deep_report_limit(trader) == 10
    assert research_report_limit(execution) is None


def test_final_decision_returns_insufficient_data_without_price():
    run = EquityResearchRun(
        run_id=uuid4(),
        ticker="AAPL",
        analysis_date=date.today(),
        report_type=ReportType.INVESTMENT,
    )
    snapshot = EquityResearchSnapshot(
        run_id=uuid4(),
        ticker="AAPL",
        analysis_date=date.today(),
        latest_price=None,
        fundamentals={},
        technical_indicators={},
    )
    decision = _final_decision(run, snapshot, {})
    assert decision.recommendation == "insufficient_data"
    assert decision.investment_decision == InvestmentDecision.AVOID
    assert decision.confidence == 0.25
    assert "Price data" in decision.main_risk


def test_pm_report_uses_trading_structure():
    run = EquityResearchRun(
        run_id=uuid4(),
        ticker="AAPL",
        analysis_date=date.today(),
        report_type=ReportType.TRADING,
    )
    snapshot = EquityResearchSnapshot(
        run_id=run.run_id,
        ticker="AAPL",
        analysis_date=date.today(),
        latest_price=100,
        technical_indicators={
            "trend": "uptrend",
            "support_20d": 95,
            "resistance_20d": 110,
        },
        fundamentals={"revenue_growth": 0.1},
        sentiment_summary={"signal": "bullish", "score": 0.3},
    )
    markdown, points, _, _ = _pm_report(run, snapshot, {})
    assert "# Final Trading Bias" in markdown
    assert "## Technical Setup" in markdown
    assert "## Trade Plan" in markdown
    assert "Bullish / Neutral / Bearish" not in markdown
    assert "**Final Trading Bias:** Bullish" in markdown
    assert any("Final Trading Bias" in point for point in points)


def test_pm_report_uses_investment_structure():
    run = EquityResearchRun(
        run_id=uuid4(),
        ticker="AAPL",
        analysis_date=date.today(),
        report_type=ReportType.INVESTMENT,
    )
    snapshot = EquityResearchSnapshot(
        run_id=run.run_id,
        ticker="AAPL",
        company_name="Apple Inc.",
        analysis_date=date.today(),
        latest_price=100,
        market_cap=3_000_000_000_000,
        technical_indicators={"trend": "uptrend"},
        fundamentals={
            "sector": "Technology",
            "industry": "Consumer Electronics",
            "revenue_growth": 0.1,
        },
        sentiment_summary={"signal": "neutral", "score": 0},
    )
    markdown, points, _, _ = _pm_report(run, snapshot, {})
    assert "# Final Investment View" in markdown
    assert "## Long-Term Thesis" in markdown
    assert "## Portfolio Fit" in markdown
    assert "Accumulate / Watchlist / Avoid" not in markdown
    assert "**Final Investment View:**" in markdown
    assert any("Final Investment View" in point for point in points)


def test_trading_final_decision_sets_bias_field():
    run = EquityResearchRun(
        run_id=uuid4(),
        ticker="AAPL",
        analysis_date=date.today(),
        report_type=ReportType.TRADING,
    )
    snapshot = EquityResearchSnapshot(
        run_id=run.run_id,
        ticker="AAPL",
        analysis_date=date.today(),
        latest_price=100,
        technical_indicators={"trend": "uptrend", "rsi_14": 55},
        fundamentals={"revenue_growth": 0.1},
        sentiment_summary={"signal": "bullish", "score": 0.3},
    )

    decision = _final_decision(run, snapshot, {})

    assert decision.trading_bias == TradingBias.BULLISH
    assert decision.investment_decision is None


def test_decision_workspace_contains_research_tabs_and_assumption_backtest():
    run = EquityResearchRun(
        run_id=uuid4(),
        ticker="NVDA",
        analysis_date=date.today(),
        report_type=ReportType.INVESTMENT,
        research_depth=ResearchDepth.MEDIUM,
    )
    snapshot = EquityResearchSnapshot(
        run_id=run.run_id,
        ticker="NVDA",
        company_name="NVIDIA Corporation",
        analysis_date=date.today(),
        latest_price=180,
        daily_change=0.012,
        market_cap=4_000_000_000_000,
        technical_indicators={
            "trend": "uptrend",
            "rsi_14": 58,
            "macd": 1.2,
            "support_20d": 170,
            "resistance_20d": 190,
            "annualized_volatility": 0.32,
        },
        fundamentals={"revenue_growth": 0.42, "profit_margins": 0.54},
        sentiment_summary={"signal": "bullish", "score": 0.4},
        risk_metrics={"max_drawdown_window": 0.12},
        data_sources=["market_data", "news"],
        news_items=[
            {"title": "NVIDIA announces new AI platform", "publisher": "Example"}
        ],
    )
    reports = [
        EquityResearchReport(
            run_id=run.run_id,
            agent_key="bull",
            agent_name="Bull Researcher",
            team="Research Agents",
            status=AgentStatus.COMPLETED,
            title="Bull Case",
            markdown="# Bull",
            summary_points=["Bull case sees demand momentum."],
            confidence=0.7,
        ),
        EquityResearchReport(
            run_id=run.run_id,
            agent_key="safe",
            agent_name="Safe Analyst",
            team="Risk Management Agents",
            status=AgentStatus.COMPLETED,
            title="Safe Risk Controls",
            markdown="# Safe",
            summary_points=["Use support as the invalidation reference."],
            confidence=0.65,
            risk_flags=["Valuation remains sensitive to growth expectations."],
        ),
    ]
    decision = _final_decision(
        run, snapshot, {report.agent_key: report for report in reports}
    )

    workspace = _build_decision_workspace(run, snapshot, reports, decision)

    assert workspace.overview.metrics[0].label == "Verdict"
    assert workspace.evidence.bullets
    assert workspace.signals.metrics
    assert workspace.backtest.assumptions
    assert "assumption-based" in workspace.backtest.summary
    assert workspace.regime.bullets
    assert workspace.agent_debate.bullets
    assert workspace.next_steps


def test_llm_report_sanitizer_clamps_pathological_table_cells():
    huge_source_cell = (
        "Sandisk Corporation develops NAND flash memory technology. " * 80
    )
    markdown = (
        "# Fundamentals Report\n\n"
        + (
            "Executive summary with enough report text to pass the minimum length guard. "
            * 8
        )
        + "\n\n| Metric | Value | Source |\n"
        + "| :--- | :--- | :"
        + ("-" * 5000)
        + " |\n"
        + f"| Company profile | Available | {huge_source_cell} |\n"
    )

    sanitized = _sanitize_llm_report_markdown(markdown)

    assert sanitized is not None
    assert "----" not in sanitized
    assert len(max(sanitized.splitlines(), key=len)) < MAX_REPORT_LINE_CHARS
    assert "Sandisk Corporation develops" in sanitized
    assert huge_source_cell not in sanitized
    assert all(
        len(cell.strip()) <= MAX_TABLE_CELL_CHARS
        for line in sanitized.splitlines()
        if line.startswith("|")
        for cell in line.strip("|").split("|")
    )


def test_llm_report_sanitizer_rejects_pathological_non_table_lines():
    markdown = "# Report\n\n" + ("A single unbounded paragraph. " * 200)

    assert _sanitize_llm_report_markdown(markdown) is None
