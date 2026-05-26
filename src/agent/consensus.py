"""
QuanAd 2.0 — Consensus Engine

Aggregates structured opinions from specialist agents into a weighted
consensus recommendation with disagreement detection and risk-veto logic.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import Enum
from typing import Any


class Verdict(str, Enum):
    BULLISH = "bullish"
    BEARISH = "bearish"
    NEUTRAL = "neutral"
    HOLD = "hold"

    @property
    def numeric(self) -> float:
        return {
            Verdict.BULLISH: 1.0,
            Verdict.BEARISH: -1.0,
            Verdict.NEUTRAL: 0.0,
            Verdict.HOLD: 0.0,
        }[self]


@dataclass
class AgentOpinion:
    """Structured output from a single specialist agent."""

    agent_name: str
    verdict: Verdict
    confidence: float  # 0.0 – 1.0
    reasoning: str
    data_points: dict[str, Any] = field(default_factory=dict)
    risk_flags: list[str] = field(default_factory=list)
    timestamp: datetime = field(default_factory=lambda: datetime.now(UTC))


@dataclass
class ConsensusResult:
    """Final aggregated recommendation from the consensus engine."""

    verdict: Verdict
    confidence: float
    consensus_score: float  # -1.0 (bearish) to +1.0 (bullish)
    agreement_ratio: float  # 0.0 – 1.0 (how aligned the agents are)
    opinions: list[AgentOpinion]
    risk_flags: list[str]
    risk_vetoed: bool
    dissenting_agents: list[str]
    summary: str


# Agent weights — configurable per deployment.
DEFAULT_WEIGHTS: dict[str, float] = {
    "quant_researcher": 0.20,
    "quant_analyst": 0.25,
    "data_scientist": 0.20,
    "risk_analyst": 0.20,
    "portfolio_analytics": 0.15,
}

# Risk veto thresholds.
RISK_VETO_FLAG_THRESHOLD = 3  # ≥ N critical flags → downgrade to HOLD
DISAGREEMENT_THRESHOLD = 0.55  # agreement_ratio below this → flag dissent


class ConsensusEngine:
    """Aggregate specialist opinions into a single recommendation."""

    def __init__(self, weights: dict[str, float] | None = None) -> None:
        self.weights = weights or dict(DEFAULT_WEIGHTS)

    def aggregate(self, opinions: list[AgentOpinion]) -> ConsensusResult:
        if not opinions:
            return ConsensusResult(
                verdict=Verdict.NEUTRAL,
                confidence=0.0,
                consensus_score=0.0,
                agreement_ratio=0.0,
                opinions=[],
                risk_flags=[],
                risk_vetoed=False,
                dissenting_agents=[],
                summary="No specialist opinions were available.",
            )

        # ----- weighted score -----
        total_weight = 0.0
        weighted_score = 0.0
        weighted_confidence = 0.0

        for opinion in opinions:
            w = self.weights.get(opinion.agent_name, 0.15) * opinion.confidence
            weighted_score += opinion.verdict.numeric * w
            weighted_confidence += opinion.confidence * self.weights.get(opinion.agent_name, 0.15)
            total_weight += self.weights.get(opinion.agent_name, 0.15)

        if total_weight > 0:
            consensus_score = weighted_score / total_weight
            avg_confidence = weighted_confidence / total_weight
        else:
            consensus_score = 0.0
            avg_confidence = 0.0

        # ----- raw verdict from score -----
        if consensus_score > 0.25:
            verdict = Verdict.BULLISH
        elif consensus_score < -0.25:
            verdict = Verdict.BEARISH
        elif abs(consensus_score) <= 0.10:
            verdict = Verdict.NEUTRAL
        else:
            verdict = Verdict.HOLD

        # ----- agreement ratio -----
        if len(opinions) > 1:
            majority_direction = 1.0 if consensus_score >= 0 else -1.0
            aligned = sum(
                1
                for o in opinions
                if (o.verdict.numeric >= 0) == (majority_direction >= 0)
                or o.verdict == Verdict.NEUTRAL
            )
            agreement_ratio = aligned / len(opinions)
        else:
            agreement_ratio = 1.0

        # ----- dissent detection -----
        dissenting = [
            o.agent_name
            for o in opinions
            if (consensus_score > 0.15 and o.verdict == Verdict.BEARISH)
            or (consensus_score < -0.15 and o.verdict == Verdict.BULLISH)
        ]

        # ----- risk flags & veto -----
        all_flags: list[str] = []
        for o in opinions:
            all_flags.extend(o.risk_flags)
        unique_flags = list(dict.fromkeys(all_flags))  # preserve order, dedupe

        risk_vetoed = len(unique_flags) >= RISK_VETO_FLAG_THRESHOLD
        if risk_vetoed and verdict == Verdict.BULLISH:
            verdict = Verdict.HOLD

        # ----- summary -----
        summary = self._build_summary(
            verdict, consensus_score, agreement_ratio, opinions, dissenting, risk_vetoed
        )

        return ConsensusResult(
            verdict=verdict,
            confidence=round(min(avg_confidence, 1.0), 4),
            consensus_score=round(consensus_score, 4),
            agreement_ratio=round(agreement_ratio, 4),
            opinions=opinions,
            risk_flags=unique_flags,
            risk_vetoed=risk_vetoed,
            dissenting_agents=dissenting,
            summary=summary,
        )

    @staticmethod
    def _build_summary(
        verdict: Verdict,
        score: float,
        agreement: float,
        opinions: list[AgentOpinion],
        dissenting: list[str],
        vetoed: bool,
    ) -> str:
        parts = [f"QuanAd 2.0 Consensus: **{verdict.value.upper()}** (score {score:+.2f})."]

        if agreement >= 0.8:
            parts.append(f"Strong agreement across {len(opinions)} specialists ({agreement:.0%}).")
        elif agreement >= 0.6:
            parts.append(f"Moderate agreement ({agreement:.0%}).")
        else:
            parts.append(f"Low agreement ({agreement:.0%}) — review individual opinions.")

        if dissenting:
            parts.append(f"Dissenting: {', '.join(dissenting)}.")

        if vetoed:
            parts.append("⚠️ Risk veto activated — multiple critical risk flags detected.")

        return " ".join(parts)
