from collections.abc import Callable

import pytest

from src.agent.sabi import (
    SabiCapability,
    SabiIntent,
    SabiOrchestrator,
    build_sabi_plan,
)
from src.agent.agent import FinancialAdvisorAgent


@pytest.mark.parametrize(
    ("message", "intent", "capability"),
    [
        ("What is AAPL trading at?", SabiIntent.MARKET_LOOKUP, SabiCapability.QUICK),
        ("How does research mode work?", SabiIntent.PLATFORM_HELP, SabiCapability.QUICK),
        ("Should I buy NVDA?", SabiIntent.INVESTMENT_ANALYSIS, SabiCapability.CONSENSUS),
        (
            "Create a full investment report for MU.",
            SabiIntent.INVESTMENT_ANALYSIS,
            SabiCapability.RESEARCH,
        ),
        (
            "How would NVDA affect my portfolio?",
            SabiIntent.PORTFOLIO_ANALYSIS,
            SabiCapability.PORTFOLIO,
        ),
        ("Review NVDA drawdown risk.", SabiIntent.RISK_ANALYSIS, SabiCapability.RISK),
        ("Backtest this strategy.", SabiIntent.BACKTEST, SabiCapability.BACKTEST),
        ("Buy 10 shares of AMD.", SabiIntent.TRADE_PROPOSAL, SabiCapability.TRADE_PROPOSAL),
    ],
)
def test_sabi_routing_matrix(message: str, intent: SabiIntent, capability: SabiCapability):
    plan = build_sabi_plan(message)

    assert plan.intent == intent
    assert plan.capability == capability


def test_sabi_consensus_uses_existing_consensus_callable_only():
    calls: list[str] = []
    sabi = SabiOrchestrator()
    plan = sabi.plan("Should I invest in NVDA?")

    result = sabi.run(
        plan=plan,
        quick=_recording_result(calls, "quick"),
        consensus=_recording_result(calls, "consensus"),
    )

    assert result.response == "consensus"
    assert calls == ["consensus"]
    assert result.metadata()["selected_capability"] == "consensus"
    assert result.metadata()["action_status"] == "analysis_only"


def test_sabi_research_returns_existing_workflow_request_without_running_chat_agents():
    calls: list[str] = []
    sabi = SabiOrchestrator()
    plan = sabi.plan("Generate a deep trading report for AMD")

    result = sabi.run(
        plan=plan,
        quick=_recording_result(calls, "quick"),
        consensus=_recording_result(calls, "consensus"),
    )

    assert calls == []
    assert result.metadata()["selected_capability"] == "research"
    assert result.metadata()["research_request"] == {
        "ticker": "AMD",
        "report_type": "trading",
        "research_depth": "deep",
    }


def test_sabi_trade_request_is_proposal_only():
    sabi = SabiOrchestrator()
    plan = sabi.plan("Buy 10 shares of AMD")
    result = sabi.run(plan=plan, quick=lambda: "draft", consensus=lambda: "unused")

    assert result.response == "draft"
    assert result.metadata()["action_status"] == "proposal_only"


def test_financial_advisor_agent_exposes_sabi_capability_metadata():
    agent = object.__new__(FinancialAdvisorAgent)
    agent.last_response_metadata = None
    agent._history = []
    agent._sabi = SabiOrchestrator()
    agent._chat_single = lambda *args, **kwargs: "quick response"

    def consensus_response(*args, **kwargs):
        agent.last_response_metadata = {"consensus": {"verdict": "hold"}}
        return "consensus response"

    agent._chat_consensus = consensus_response

    response = agent.chat("Should I buy NVDA?", remember=False, mode="sabi")

    assert response == "consensus response"
    assert agent.last_response_metadata == {
        "consensus": {"verdict": "hold"},
        "selected_mode": "sabi",
        "selected_capability": "consensus",
        "action_status": "analysis_only",
    }


def _recording_result(calls: list[str], name: str) -> Callable[[], str]:
    def run() -> str:
        calls.append(name)
        return name

    return run
