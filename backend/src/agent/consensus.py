"""Evidence-aware aggregation for Quanfora specialist opinions."""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import Enum
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from src.agent.consensus_evidence import AssetEvidence, ConsensusEvidenceBundle


class Verdict(str, Enum):
    BULLISH = "bullish"
    BEARISH = "bearish"
    NEUTRAL = "neutral"
    HOLD = "hold"
    MIXED = "mixed"
    INSUFFICIENT_DATA = "insufficient_data"

    @property
    def numeric(self) -> float:
        return {
            Verdict.BULLISH: 1.0,
            Verdict.BEARISH: -1.0,
            Verdict.NEUTRAL: 0.0,
            Verdict.HOLD: 0.0,
            Verdict.MIXED: 0.0,
            Verdict.INSUFFICIENT_DATA: 0.0,
        }[self]


@dataclass
class AssetOpinion:
    """One specialist's view for one explicitly requested asset."""

    symbol: str
    verdict: Verdict
    confidence: float
    reasoning: str
    data_points: dict[str, Any] = field(default_factory=dict)
    risk_flags: list[str] = field(default_factory=list)
    limitations: list[str] = field(default_factory=list)
    risk_level: str = "unknown"


@dataclass
class AgentOpinion:
    """Structured output from a single specialist agent."""

    agent_name: str
    verdict: Verdict
    confidence: float
    reasoning: str
    data_points: dict[str, Any] = field(default_factory=dict)
    risk_flags: list[str] = field(default_factory=list)
    timestamp: datetime = field(default_factory=lambda: datetime.now(UTC))
    status: str = "completed"
    limitations: list[str] = field(default_factory=list)
    asset_opinions: dict[str, AssetOpinion] = field(default_factory=dict)


@dataclass
class AssetConsensusResult:
    symbol: str
    company_name: str
    verdict: Verdict
    confidence: float
    consensus_score: float
    agreement_ratio: float
    evidence_status: str
    evidence_coverage: float
    risk_flags: list[str] = field(default_factory=list)
    limitations: list[str] = field(default_factory=list)
    risk_vetoed: bool = False
    dissenting_agents: list[str] = field(default_factory=list)
    metrics: dict[str, Any] = field(default_factory=dict)
    sources: list[dict[str, Any]] = field(default_factory=list)
    as_of: str | None = None


@dataclass
class ConsensusResult:
    """Final aggregate plus independent results for each requested asset."""

    verdict: Verdict
    confidence: float
    consensus_score: float
    agreement_ratio: float
    opinions: list[AgentOpinion]
    risk_flags: list[str]
    risk_vetoed: bool
    dissenting_agents: list[str]
    summary: str
    asset_results: list[AssetConsensusResult] = field(default_factory=list)
    evidence_status: str = "unknown"
    evidence_coverage: float = 0.0
    limitations: list[str] = field(default_factory=list)


DEFAULT_WEIGHTS: dict[str, float] = {
    "quant_researcher": 0.20,
    "quant_analyst": 0.25,
    "data_scientist": 0.20,
    "risk_analyst": 0.20,
    "portfolio_analytics": 0.15,
}

ELIGIBLE_STATUSES = {"completed", "partial"}


class ConsensusEngine:
    """Aggregate valid specialist output without treating missing data as risk."""

    def __init__(self, weights: dict[str, float] | None = None) -> None:
        self.weights = weights or dict(DEFAULT_WEIGHTS)

    def aggregate(
        self,
        opinions: list[AgentOpinion],
        evidence: ConsensusEvidenceBundle | None = None,
    ) -> ConsensusResult:
        if evidence and evidence.requested_symbols:
            return self._aggregate_assets(opinions, evidence)
        return self._aggregate_legacy(opinions)

    def _aggregate_assets(
        self,
        opinions: list[AgentOpinion],
        evidence: ConsensusEvidenceBundle,
    ) -> ConsensusResult:
        asset_results = [
            self._aggregate_asset(symbol, evidence.asset(symbol), opinions)
            for symbol in evidence.requested_symbols
        ]
        verdicts = {item.verdict for item in asset_results}
        if any(item.verdict == Verdict.INSUFFICIENT_DATA for item in asset_results):
            verdict = Verdict.INSUFFICIENT_DATA
        elif len(verdicts) == 1:
            verdict = next(iter(verdicts))
        else:
            verdict = Verdict.MIXED

        confidence = _mean([item.confidence for item in asset_results])
        score = _mean([item.consensus_score for item in asset_results])
        agreement = _mean([item.agreement_ratio for item in asset_results])
        risk_flags = _dedupe(flag for item in asset_results for flag in item.risk_flags)
        limitations = _dedupe(
            [*evidence.limitations]
            + [item for asset in asset_results for item in asset.limitations]
        )
        dissenting = _dedupe(
            name for item in asset_results for name in item.dissenting_agents
        )
        risk_vetoed = any(item.risk_vetoed for item in asset_results)
        symbols = ", ".join(item.symbol for item in asset_results)
        summary = (
            f"Quanfora 2.0 evaluated {symbols} separately: "
            + "; ".join(
                f"{item.symbol} {item.verdict.value.replace('_', ' ')} "
                f"({item.confidence:.0%} confidence, "
                f"{item.agreement_ratio:.0%} exact-verdict agreement)"
                for item in asset_results
            )
            + "."
        )
        return ConsensusResult(
            verdict=verdict,
            confidence=round(confidence, 4),
            consensus_score=round(score, 4),
            agreement_ratio=round(agreement, 4),
            opinions=opinions,
            risk_flags=risk_flags,
            risk_vetoed=risk_vetoed,
            dissenting_agents=dissenting,
            summary=summary,
            asset_results=asset_results,
            evidence_status=evidence.evidence_status,
            evidence_coverage=evidence.coverage,
            limitations=limitations,
        )

    def _aggregate_asset(
        self,
        symbol: str,
        evidence: AssetEvidence | None,
        opinions: list[AgentOpinion],
    ) -> AssetConsensusResult:
        if evidence is None or evidence.status == "insufficient":
            limitations = (
                list(evidence.limitations)
                if evidence
                else [f"No shared evidence was available for {symbol}."]
            )
            return AssetConsensusResult(
                symbol=symbol,
                company_name=evidence.company_name if evidence else symbol,
                verdict=Verdict.INSUFFICIENT_DATA,
                confidence=0.0,
                consensus_score=0.0,
                agreement_ratio=0.0,
                evidence_status="insufficient",
                evidence_coverage=0.0,
                limitations=limitations,
                metrics=dict(evidence.metrics) if evidence else {},
                sources=[item.to_dict() for item in evidence.sources]
                if evidence
                else [],
                as_of=evidence.as_of if evidence else None,
            )

        eligible = [
            (opinion, opinion.asset_opinions[symbol])
            for opinion in opinions
            if opinion.status in ELIGIBLE_STATUSES and symbol in opinion.asset_opinions
        ]
        total_available_weight = sum(self.weights.values()) or 1.0
        represented_weight = sum(
            self.weights.get(opinion.agent_name, 0.15) for opinion, _ in eligible
        )
        coverage = min(1.0, represented_weight / total_available_weight)
        score, confidence = self._weighted_values(eligible, coverage)
        verdict = _verdict_from_score(score)
        agreement = _exact_agreement([asset.verdict for _, asset in eligible])
        dissenting = [
            opinion.agent_name
            for opinion, asset in eligible
            if (score > 0.15 and asset.verdict == Verdict.BEARISH)
            or (score < -0.15 and asset.verdict == Verdict.BULLISH)
        ]
        evidence_flags = [item.label for item in evidence.risk_findings]
        opinion_flags = [flag for _, asset in eligible for flag in asset.risk_flags]
        risk_flags = _dedupe([*evidence_flags, *opinion_flags])
        risk_vetoed = evidence.critical_risk
        if risk_vetoed and verdict == Verdict.BULLISH:
            verdict = Verdict.HOLD
        limitations = _dedupe(
            [*evidence.limitations]
            + [item for opinion in opinions for item in opinion.limitations]
            + [item for _, asset in eligible for item in asset.limitations]
        )
        if not eligible:
            limitations.append(f"No specialist returned a usable opinion for {symbol}.")
            verdict = Verdict.INSUFFICIENT_DATA
            confidence = 0.0
        return AssetConsensusResult(
            symbol=symbol,
            company_name=evidence.company_name,
            verdict=verdict,
            confidence=round(confidence, 4),
            consensus_score=round(score, 4),
            agreement_ratio=round(agreement, 4),
            evidence_status=evidence.status,
            evidence_coverage=round(coverage, 4),
            risk_flags=risk_flags,
            limitations=_dedupe(limitations),
            risk_vetoed=risk_vetoed,
            dissenting_agents=dissenting,
            metrics=dict(evidence.metrics),
            sources=[item.to_dict() for item in evidence.sources],
            as_of=evidence.as_of,
        )

    def _weighted_values(
        self, eligible: list[tuple[AgentOpinion, AssetOpinion]], coverage: float
    ) -> tuple[float, float]:
        total_weight = sum(self.weights.get(op.agent_name, 0.15) for op, _ in eligible)
        if not total_weight:
            return 0.0, 0.0
        score = (
            sum(
                asset.verdict.numeric
                * self.weights.get(opinion.agent_name, 0.15)
                * asset.confidence
                for opinion, asset in eligible
            )
            / total_weight
        )
        confidence = (
            sum(
                asset.confidence * self.weights.get(opinion.agent_name, 0.15)
                for opinion, asset in eligible
            )
            / total_weight
        )
        return score, confidence * coverage

    def _aggregate_legacy(self, opinions: list[AgentOpinion]) -> ConsensusResult:
        eligible = [item for item in opinions if item.status in ELIGIBLE_STATUSES]
        if not eligible:
            return ConsensusResult(
                verdict=Verdict.INSUFFICIENT_DATA,
                confidence=0.0,
                consensus_score=0.0,
                agreement_ratio=0.0,
                opinions=opinions,
                risk_flags=[],
                risk_vetoed=False,
                dissenting_agents=[],
                summary="No usable specialist opinions were available.",
                evidence_status="insufficient",
                limitations=_dedupe(item for op in opinions for item in op.limitations),
            )
        total_weight = sum(self.weights.get(item.agent_name, 0.15) for item in eligible)
        score = (
            sum(
                item.verdict.numeric
                * self.weights.get(item.agent_name, 0.15)
                * item.confidence
                for item in eligible
            )
            / total_weight
        )
        confidence = (
            sum(
                item.confidence * self.weights.get(item.agent_name, 0.15)
                for item in eligible
            )
            / total_weight
        )
        agreement = _exact_agreement([item.verdict for item in eligible])
        dissenting = [
            item.agent_name
            for item in eligible
            if (score > 0.15 and item.verdict == Verdict.BEARISH)
            or (score < -0.15 and item.verdict == Verdict.BULLISH)
        ]
        verdict = _verdict_from_score(score)
        flags = _dedupe(flag for item in eligible for flag in item.risk_flags)
        summary = self._build_summary(verdict, score, agreement, eligible, dissenting)
        return ConsensusResult(
            verdict=verdict,
            confidence=round(confidence, 4),
            consensus_score=round(score, 4),
            agreement_ratio=round(agreement, 4),
            opinions=opinions,
            risk_flags=flags,
            risk_vetoed=False,
            dissenting_agents=dissenting,
            summary=summary,
            evidence_status="unknown",
            evidence_coverage=round(len(eligible) / len(opinions), 4),
            limitations=_dedupe(item for op in opinions for item in op.limitations),
        )

    @staticmethod
    def _build_summary(
        verdict: Verdict,
        score: float,
        agreement: float,
        opinions: list[AgentOpinion],
        dissenting: list[str],
    ) -> str:
        parts = [
            f"Quanfora 2.0 Consensus: **{verdict.value.upper()}** (score {score:+.2f})."
        ]
        qualifier = (
            "Strong" if agreement >= 0.8 else "Moderate" if agreement >= 0.6 else "Low"
        )
        parts.append(
            f"{qualifier} exact-verdict agreement across {len(opinions)} specialists ({agreement:.0%})."
        )
        if dissenting:
            parts.append(f"Dissenting: {', '.join(dissenting)}.")
        return " ".join(parts)


def _verdict_from_score(score: float) -> Verdict:
    if score > 0.25:
        return Verdict.BULLISH
    if score < -0.25:
        return Verdict.BEARISH
    if abs(score) <= 0.10:
        return Verdict.NEUTRAL
    return Verdict.HOLD


def _exact_agreement(verdicts: list[Verdict]) -> float:
    if not verdicts:
        return 0.0
    return max(Counter(verdicts).values()) / len(verdicts)


def _mean(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def _dedupe(values: Any) -> list[str]:
    return list(dict.fromkeys(str(value) for value in values if value))
