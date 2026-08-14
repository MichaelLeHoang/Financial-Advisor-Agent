from src.agent.consensus import (
    AgentOpinion,
    AssetOpinion,
    ConsensusEngine,
    Verdict,
)
from src.agent.consensus_evidence import (
    AssetEvidence,
    ConsensusEvidenceBundle,
    RiskFinding,
)


def _bundle(*assets: AssetEvidence) -> ConsensusEvidenceBundle:
    return ConsensusEvidenceBundle(
        assets=list(assets),
        requested_symbols=[asset.symbol for asset in assets],
        retrieved_at="2026-08-13T12:00:00+00:00",
    )


def _evidence(symbol: str, *, critical: bool = False) -> AssetEvidence:
    return AssetEvidence(
        symbol=symbol,
        company_name=symbol,
        status="complete",
        as_of="2026-08-13T12:00:00+00:00",
        currency="USD",
        metrics={"latest_price": 100.0, "annualized_volatility": 0.4},
        risk_findings=(
            [
                RiskFinding(
                    "Extreme volatility", "critical", "annualized_volatility", 1.1, 1.0
                )
            ]
            if critical
            else []
        ),
    )


def _opinion(agent: str, symbol: str, verdict: Verdict) -> AgentOpinion:
    asset = AssetOpinion(symbol, verdict, 0.8, f"{symbol} is {verdict.value}.")
    return AgentOpinion(
        agent_name=agent,
        verdict=verdict,
        confidence=0.8,
        reasoning=asset.reasoning,
        asset_opinions={symbol: asset},
    )


def test_exact_verdict_agreement_does_not_count_neutral_or_hold_as_bullish():
    verdicts = [
        Verdict.BULLISH,
        Verdict.BULLISH,
        Verdict.NEUTRAL,
        Verdict.NEUTRAL,
        Verdict.HOLD,
    ]
    names = list(ConsensusEngine().weights)
    opinions = [_opinion(name, "MU", verdict) for name, verdict in zip(names, verdicts)]

    result = ConsensusEngine().aggregate(opinions, _bundle(_evidence("MU")))

    assert result.asset_results[0].agreement_ratio == 0.4
    assert result.agreement_ratio == 0.4


def test_multi_asset_consensus_keeps_independent_verdicts():
    names = list(ConsensusEngine().weights)
    opinions = []
    for name in names:
        opinions.append(
            AgentOpinion(
                agent_name=name,
                verdict=Verdict.NEUTRAL,
                confidence=0.8,
                reasoning="Separate views.",
                asset_opinions={
                    "SNDK": AssetOpinion("SNDK", Verdict.BULLISH, 0.8, "Positive."),
                    "MU": AssetOpinion("MU", Verdict.BEARISH, 0.8, "Negative."),
                },
            )
        )

    result = ConsensusEngine().aggregate(
        opinions, _bundle(_evidence("SNDK"), _evidence("MU"))
    )

    assert result.verdict == Verdict.MIXED
    assert [item.verdict for item in result.asset_results] == [
        Verdict.BULLISH,
        Verdict.BEARISH,
    ]


def test_missing_essential_evidence_returns_insufficient_instead_of_hold():
    evidence = AssetEvidence(
        symbol="MU",
        company_name="Micron Technology",
        status="insufficient",
        as_of=None,
        currency="USD",
        limitations=["Price history unavailable."],
    )

    result = ConsensusEngine().aggregate(
        [_opinion("quant_analyst", "MU", Verdict.HOLD)], _bundle(evidence)
    )

    assert result.verdict == Verdict.INSUFFICIENT_DATA
    assert result.asset_results[0].verdict == Verdict.INSUFFICIENT_DATA
    assert result.risk_vetoed is False
    assert result.risk_flags == []


def test_unavailable_specialist_reduces_coverage_without_creating_risk_flag():
    unavailable = AgentOpinion(
        agent_name="risk_analyst",
        verdict=Verdict.NEUTRAL,
        confidence=0.0,
        reasoning="Provider failed.",
        status="unavailable",
        limitations=["Risk provider failed."],
    )
    result = ConsensusEngine().aggregate(
        [_opinion("quant_analyst", "MU", Verdict.BULLISH), unavailable],
        _bundle(_evidence("MU")),
    )

    asset = result.asset_results[0]
    assert asset.evidence_coverage == 0.25
    assert asset.confidence == 0.2
    assert "Risk provider failed." in asset.limitations
    assert asset.risk_flags == []


def test_only_structured_critical_risk_can_veto_bullish_result():
    opinions = [
        _opinion(name, "SNDK", Verdict.BULLISH) for name in ConsensusEngine().weights
    ]

    result = ConsensusEngine().aggregate(
        opinions, _bundle(_evidence("SNDK", critical=True))
    )

    assert result.asset_results[0].risk_vetoed is True
    assert result.asset_results[0].verdict == Verdict.HOLD
