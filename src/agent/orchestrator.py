"""
QuanAd 2.0 — Orchestrator

Top-level agent that:
1. Receives a user query
2. Dispatches it to all 5 specialist agents (concurrently)
3. Collects structured opinions
4. Runs the consensus engine
5. Produces a final synthesized recommendation via LLM
"""

from __future__ import annotations

import asyncio
import concurrent.futures
import traceback
from typing import Any

from src.agent.consensus import AgentOpinion, ConsensusEngine, ConsensusResult, Verdict
from src.agent.specialists import (
    ALL_SPECIALISTS,
    BaseSpecialist,
    FinancialDataScientist,
    PortfolioAnalytics,
    QuantAnalyst,
    QuantResearcher,
    RiskAnalyst,
)
from src.llm.gateway import LLMGateway, llm_gateway
from src.llm.routing_policy import LLMMode
from src.saas.models import Plan


class QuanAdOrchestrator:
    """
    QuanAd 2.0 multi-agent consensus orchestrator.

    Dispatches a query to 5 specialist agents, collects their structured
    opinions, runs consensus aggregation, and synthesizes a final answer.
    """

    def __init__(
        self,
        *,
        user_id: str = "guest",
        plan: Plan | str = Plan.FREE,
        preferred_mode: LLMMode | None = None,
        gateway: LLMGateway = llm_gateway,
        max_workers: int = 3,
    ) -> None:
        self.user_id = user_id
        self.plan = plan if isinstance(plan, Plan) else Plan(plan)
        self.preferred_mode = preferred_mode
        self.gateway = gateway
        self.max_workers = max_workers
        self.consensus_engine = ConsensusEngine()
        self._history: list[dict] = []

    def _create_specialists(self) -> list[BaseSpecialist]:
        """Instantiate all specialist agents with shared config."""
        return [
            cls(
                user_id=self.user_id,
                plan=self.plan,
                preferred_mode=self.preferred_mode,
                gateway=self.gateway,
            )
            for cls in ALL_SPECIALISTS
        ]

    def analyze(self, query: str) -> ConsensusResult:
        """
        Run all specialists on the query and return a consensus result.

        Uses ThreadPoolExecutor for parallel execution since each specialist
        makes independent LLM + tool calls.
        """
        specialists = self._create_specialists()
        opinions: list[AgentOpinion] = []

        print(f"\n{'='*60}")
        print(f"  QuanAd 2.0 — Multi-Agent Consensus Analysis")
        print(f"  Query: {query[:80]}...")
        print(f"  Dispatching to {len(specialists)} specialists...")
        print(f"{'='*60}\n")

        with concurrent.futures.ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            future_to_specialist = {
                executor.submit(self._run_specialist, specialist, query): specialist
                for specialist in specialists
            }

            for future in concurrent.futures.as_completed(future_to_specialist):
                specialist = future_to_specialist[future]
                try:
                    opinion = future.result(timeout=120)
                    opinions.append(opinion)
                    print(f"  ✓ {specialist.display_name}: {opinion.verdict.value} (confidence: {opinion.confidence:.0%})")
                except Exception as exc:
                    print(f"  ✗ {specialist.display_name}: failed — {exc}")
                    opinions.append(
                        AgentOpinion(
                            agent_name=specialist.name,
                            verdict=Verdict.NEUTRAL,
                            confidence=0.1,
                            reasoning=f"Specialist unavailable: {str(exc)[:100]}",
                            risk_flags=[f"{specialist.display_name} analysis failed"],
                        )
                    )

        result = self.consensus_engine.aggregate(opinions)
        print(f"\n{'─'*60}")
        print(f"  Consensus: {result.verdict.value.upper()} | Score: {result.consensus_score:+.2f} | Agreement: {result.agreement_ratio:.0%}")
        print(f"{'─'*60}\n")

        return result

    @staticmethod
    def _run_specialist(specialist: BaseSpecialist, query: str) -> AgentOpinion:
        """Execute a single specialist analysis (runs in thread)."""
        return specialist.analyze(query)

    def chat(self, message: str, remember: bool = True) -> str:
        """
        Full QuanAd 2.0 consensus chat.

        1. Dispatch to all specialists
        2. Collect opinions + run consensus
        3. Synthesize a final human-readable response via LLM
        """
        result = self.analyze(message)
        final_response = self._synthesize_response(message, result)

        if remember:
            self._history.append({"role": "user", "content": message})
            self._history.append({"role": "assistant", "content": final_response})

        return final_response

    def _synthesize_response(self, query: str, result: ConsensusResult) -> str:
        """Use the LLM to produce a polished final response from consensus data."""
        try:
            routed = self.gateway.get_chat_model(
                user_id=self.user_id,
                plan=self.plan,
                task_type="consensus_synthesis",
                messages=[],
                preferred_mode=self.preferred_mode,
            )
            llm = routed.chat_model

            # Build the synthesis prompt with all specialist opinions.
            opinions_text = "\n\n".join(
                f"### {o.agent_name.replace('_', ' ').title()}\n"
                f"- Verdict: {o.verdict.value}\n"
                f"- Confidence: {o.confidence:.0%}\n"
                f"- Reasoning: {o.reasoning}\n"
                f"- Data Points: {o.data_points}\n"
                f"- Risk Flags: {o.risk_flags}"
                for o in result.opinions
            )

            synthesis_prompt = f"""You are the QuanAd 2.0 Lead Analyst. You have received analysis from 5 specialist agents.
Your job is to synthesize their findings into a clear, actionable recommendation.

## User Query
{query}

## Consensus Summary
- Overall Verdict: {result.verdict.value.upper()}
- Consensus Score: {result.consensus_score:+.4f}
- Agreement Ratio: {result.agreement_ratio:.0%}
- Risk Vetoed: {result.risk_vetoed}
- Dissenting Agents: {', '.join(result.dissenting_agents) or 'None'}
- Risk Flags: {result.risk_flags}

## Individual Specialist Opinions
{opinions_text}

## Your Task
Write a comprehensive but concise response that:
1. Opens with the consensus verdict and confidence level
2. Summarizes the key supporting evidence from each specialist
3. Highlights any disagreements between specialists
4. Calls out critical risk flags
5. Provides a clear recommendation
6. Ends with: "This is AI-generated analysis from QuanAd 2.0's multi-agent consensus system, not professional financial advice."

Use clear formatting with headers and bullet points. Be specific with numbers."""

            response = llm.invoke([{"role": "user", "content": synthesis_prompt}])

            self.gateway.record_usage(
                user_id=self.user_id,
                task_type="consensus_synthesis",
                routed_model=routed,
                input_text=synthesis_prompt,
                output_text=response.content,
            )

            return response.content

        except Exception:
            # Fallback: return the raw consensus summary.
            return self._fallback_response(result)

    @staticmethod
    def _fallback_response(result: ConsensusResult) -> str:
        """Generate a basic response if LLM synthesis fails."""
        parts = [
            f"## QuanAd 2.0 Consensus: {result.verdict.value.upper()}",
            f"**Confidence:** {result.confidence:.0%} | **Score:** {result.consensus_score:+.2f} | **Agreement:** {result.agreement_ratio:.0%}",
            "",
        ]

        if result.risk_vetoed:
            parts.append("⚠️ **Risk Veto Activated** — Multiple critical risk flags detected.\n")

        parts.append("### Specialist Opinions")
        for o in result.opinions:
            parts.append(f"- **{o.agent_name.replace('_', ' ').title()}**: {o.verdict.value} ({o.confidence:.0%}) — {o.reasoning[:150]}")

        if result.risk_flags:
            parts.append(f"\n### Risk Flags\n" + "\n".join(f"- {f}" for f in result.risk_flags))

        if result.dissenting_agents:
            parts.append(f"\n### Dissenting Views\n{', '.join(result.dissenting_agents)}")

        parts.append("\n---\n*This is AI-generated analysis from QuanAd 2.0's multi-agent consensus system, not professional financial advice.*")

        return "\n".join(parts)

    def reset_history(self) -> None:
        """Clear conversation history."""
        self._history = []
        print("QuanAd 2.0 conversation history cleared.")
