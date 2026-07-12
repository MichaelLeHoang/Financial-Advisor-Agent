from datetime import date
from uuid import uuid4

from src.agent.consensus import AgentOpinion, ConsensusResult, Verdict
from src.agent.overview import (
    build_consensus_overview,
    build_research_overview,
    build_single_response_overview,
)
from src.models.equity_research import (
    AgentStatus,
    EquityResearchReport,
    EquityResearchRun,
    EquityResearchSnapshot,
    ReportType,
)


def test_single_response_overview_builds_stock_decision_summary():
    response = """
QCOM looks like a Hold because valuation is reasonable but handset demand remains cyclical.

- Bull case: automotive and edge AI growth could support upside.
- Risk: smartphone modem demand and customer concentration can pressure revenue.

This is AI-generated analysis, not professional financial advice.
"""
    tool_text = """
Stock: QCOM
Company: Qualcomm Inc.
Latest Price: $186.48
Daily Change: +5.80%
Data Sources: market_data_service, yahoo_finance
Market Mood: POSITIVE
Signal: bullish
"""

    overview = build_single_response_overview(
        "should I buy QCOM?", response, [{"content": tool_text}]
    )

    assert overview is not None
    assert overview.title == "Qualcomm Inc. (QCOM)"
    assert overview.verdict == "hold"
    assert any(metric.label == "Price" for metric in overview.metrics)
    assert overview.catalysts
    assert overview.risks
    assert overview.sources


def test_single_response_overview_answers_decision_before_market_recap():
    response = """
NVDA is currently trading at $195.55, showing a daily increase of +0.37%.

Recent news headlines for NVDA indicate a neutral market sentiment with a bullish score of -0.0341.

This is AI-generated analysis, not professional financial advice.
"""
    tool_text = """
Stock: NVDA
Company: NVIDIA Corporation
Latest Price: $195.55
Daily Change: +0.37%
Signal: neutral
"""

    overview = build_single_response_overview(
        "should I buy nvda?", response, [{"content": tool_text}]
    )

    assert overview is not None
    assert overview.verdict == "hold"
    assert overview.summary.startswith("Hold/Wait on NVIDIA Corporation (NVDA)")


def test_consensus_overview_maps_specialist_result():
    result = ConsensusResult(
        verdict=Verdict.BULLISH,
        confidence=0.72,
        consensus_score=0.44,
        agreement_ratio=0.8,
        opinions=[
            AgentOpinion(
                agent_name="quant_researcher",
                verdict=Verdict.BULLISH,
                confidence=0.7,
                reasoning="Momentum and revenue evidence are constructive.",
            ),
            AgentOpinion(
                agent_name="risk_analyst",
                verdict=Verdict.NEUTRAL,
                confidence=0.6,
                reasoning="Valuation risk keeps sizing conservative.",
                risk_flags=["Valuation risk"],
            ),
        ],
        risk_flags=["Valuation risk"],
        risk_vetoed=False,
        dissenting_agents=[],
        summary="Constructive but not risk-free.",
    )

    overview = build_consensus_overview("Should I buy NVDA?", result)

    assert overview.verdict == "bullish"
    assert overview.metrics[1].value == "72%"
    assert any(point.title == "Risk flag" for point in overview.risks)
    assert overview.next_questions


def test_research_overview_uses_snapshot_and_reports():
    run = EquityResearchRun(
        run_id=uuid4(),
        ticker="QCOM",
        company_name="Qualcomm Inc.",
        analysis_date=date.today(),
        report_type=ReportType.INVESTMENT,
    )
    snapshot = EquityResearchSnapshot(
        run_id=run.run_id,
        ticker="QCOM",
        company_name="Qualcomm Inc.",
        analysis_date=date.today(),
        latest_price=186.48,
        daily_change=0.058,
        market_cap=196_550_000_000,
        fundamentals={"trailing_pe": 20.28},
        technical_indicators={"rsi_14": 55},
        sentiment_summary={"signal": "bullish"},
        data_sources=["market_data_service"],
        evidence_items=[{"label": "Market snapshot", "source": "market_data_service"}],
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
            summary_points=["AI edge-device growth could support long-term upside."],
            confidence=0.7,
        ),
        EquityResearchReport(
            run_id=run.run_id,
            agent_key="bear",
            agent_name="Bear Researcher",
            team="Research Agents",
            status=AgentStatus.COMPLETED,
            title="Bear Case",
            markdown="# Bear",
            summary_points=["Handset cyclicality remains a near-term risk."],
            risk_flags=["Customer concentration risk"],
            confidence=0.6,
        ),
    ]

    overview = build_research_overview(
        run,
        snapshot,
        reports,
        label="Hold",
        summary="QCOM has balanced upside and risk.",
    )

    assert overview.title == "Qualcomm Inc. (QCOM)"
    assert overview.verdict == "hold"
    assert any(metric.label == "Market Cap" for metric in overview.metrics)
    assert overview.catalysts[0].tone == "positive"
    assert overview.risks[0].tone == "negative"
