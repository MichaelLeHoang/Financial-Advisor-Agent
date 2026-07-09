from src.agent.consensus import AgentOpinion, ConsensusResult, Verdict
from src.agent.orchestrator import _build_consensus_synthesis_prompt


def test_consensus_synthesis_prompt_uses_reader_facing_structure():
    result = ConsensusResult(
        verdict=Verdict.HOLD,
        confidence=0.68,
        consensus_score=0.13,
        agreement_ratio=1.0,
        opinions=[
            AgentOpinion(
                agent_name="risk_analyst",
                verdict=Verdict.HOLD,
                confidence=0.9,
                reasoning="Very high volatility and drawdown keep sizing conservative.",
                data_points={"annualized_volatility": "75.85%"},
                risk_flags=["Very high volatility"],
            )
        ],
        risk_flags=["Very high volatility"],
        risk_vetoed=True,
        dissenting_agents=[],
        summary="Hold due to risk.",
    )

    prompt = _build_consensus_synthesis_prompt(
        "Should I buy more MU?",
        result,
        "### Risk Analyst\n- Verdict: hold\n- Confidence: 90%",
    )

    assert "Start with one direct sentence" in prompt
    assert "## Bull Case" in prompt
    assert "## Market Overall" in prompt
    assert "## Bear / Risk Case" in prompt
    assert "## Agent Consensus" in prompt
    assert "## Current Tape" in prompt
    assert "preserve the useful consensus/report evidence" in prompt
    assert "Use `**Label:**` paragraphs" in prompt
    assert "Use bullets for metrics, headlines, risks, and next questions" in prompt
    assert "current price/action, sentiment/news, model or technical signals" in prompt
    assert "broader market, sector, and macro tape" in prompt
    assert "1. Final Consensus" not in prompt
    assert "3. Specialist Breakdown" not in prompt
    assert "7. Actionable Research Next Steps" not in prompt
