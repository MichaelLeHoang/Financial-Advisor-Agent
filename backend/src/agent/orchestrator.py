"""
Quanfora 2.0 — Orchestrator

Top-level agent that:
1. Receives a user query
2. Dispatches it to all 5 specialist agents (concurrently)
3. Collects structured opinions
4. Runs the consensus engine
5. Produces a final synthesized recommendation via LLM
"""

from __future__ import annotations

import time
from typing import Any, Callable

from src.agent.consensus import AgentOpinion, ConsensusEngine, ConsensusResult, Verdict
from src.agent.consensus_evidence import (
    ConsensusEvidenceBundle,
    build_consensus_evidence,
)
from src.agent.specialists import (
    ALL_SPECIALISTS,
    BaseSpecialist,
)
from src.llm.gateway import LLMGateway, llm_gateway
from src.llm.routing_policy import LLMMode
from src.saas.models import Plan

ProgressCallback = Callable[[dict[str, Any]], None]

_SPECIALIST_ACTIVITY_DETAILS = {
    "quant_researcher": "Reviewing current market, company, and fundamental evidence.",
    "quant_analyst": "Calculating trend, momentum, support, and resistance signals.",
    "data_scientist": "Comparing prediction models and validation metrics.",
    "risk_analyst": "Calculating volatility, drawdown, VaR, and downside flags.",
    "portfolio_analytics": "Checking diversification, concentration, and portfolio fit.",
}


def _build_consensus_synthesis_prompt(
    query: str, result: ConsensusResult, opinions_text: str
) -> str:
    assets_text = (
        "\n".join(
            f"- {asset.symbol}: {asset.verdict.value.upper()}, confidence {asset.confidence:.0%}, "
            f"exact-verdict agreement {asset.agreement_ratio:.0%}, evidence {asset.evidence_status}, "
            f"metrics {asset.metrics}, risks {asset.risk_flags}, limitations {asset.limitations}, "
            f"sources {asset.sources}"
            for asset in result.asset_results
        )
        or "- No ticker-specific aggregate was available."
    )
    return f"""You are the Quanfora 2.0 Lead Analyst. You have received analysis from 5 specialist agents.
Your job is to turn their findings into a clear, reader-friendly investment answer.

## User Query
{query}

## Consensus Summary
- Overall Verdict: {result.verdict.value.upper()}
- Confidence: {result.confidence:.0%}
- Exact-Verdict Agreement: {result.agreement_ratio:.0%}
- Risk Flags: {result.risk_flags}
- Evidence Status: {result.evidence_status}
- Evidence Coverage: {result.evidence_coverage:.0%}
- Limitations: {result.limitations}

## Per-Asset Consensus (authoritative)
{assets_text}

## Individual Specialist Opinions
{opinions_text}

## Main Answer Format
Write the main chat answer for an investor, not an internal audit report.

Start with one direct sentence that answers the user's question. For multiple stocks, name every ticker and give each ticker its own verdict:
- "Yes..." for a buy/add answer
- "No..." for an avoid/sell answer
- "Hold/Wait..." only when usable evidence supports that verdict
- "Insufficient evidence..." when essential price, trend, or risk evidence is unavailable; never translate missing evidence into Hold

Then preserve the useful consensus/report evidence instead of replacing it with a short summary. Use markdown that stays scannable in chat:
- Use `**Label:**` paragraphs for compact evidence blocks.
- Use bullets for metrics, headlines, risks, and next questions.
- Keep each paragraph to 1-3 sentences.

Use concise markdown sections when applicable:
- ## Why
- ## Market Overall
- ## Bull Case
- ## Bear / Risk Case
- ## Agent Consensus
- ## What Would Change The View
- ## Next Questions

For broad market or sector questions, use:
- ## Current Tape
- ## Leadership
- ## Positive Drivers
- ## Risks
- ## Practical Takeaway
- ## What to Watch

Rules:
- Be specific with numbers from the specialist outputs.
- Treat Per-Asset Consensus as authoritative. Never collapse different ticker verdicts into a single buy/hold/sell instruction.
- Do not repeat the structured overview as a second overview; use the prose to explain evidence and practical implications.
- State that agreement means exact-verdict agreement; neutral and hold do not count as agreement with bullish.
- Keep evidence limitations separate from investment risks.
- Do not describe trailing annualized historical return as expected or forecast return.
- For ticker-specific stock answers, include "Market Overall" to explain what the broader market, sector, and macro tape are doing around the stock when available.
- Keep the strongest details from the specialists: current price/action, sentiment/news, model or technical signals, validation quality, risk metrics, and portfolio implications when provided.
- Translate internal mechanics into plain implications. Do not lead with terms like "risk veto", "agreement ratio", "consensus score", or "tool failure" in the main answer unless they materially change the recommendation.
- Do not use the old report headings "Final Consensus", "Specialist Breakdown", "Disagreement and Dissent", or "Actionable Research Next Steps".
- Keep specialist disagreements concise in "Agent Consensus"; detailed specialist reasoning is available elsewhere.
- Do not invent market data, news, prices, or analyst targets.
- If evidence is missing or a tool failed, say what that means for confidence in plain language.
- Preserve exact numeric formatting from specialist outputs.
- End with: "This is AI-generated analysis from Quanfora 2.0's multi-agent consensus system, not professional financial advice."
"""


class QuanforaOrchestrator:
    """
    Quanfora 2.0 multi-agent consensus orchestrator.

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

    def analyze(
        self,
        query: str,
        progress_callback: ProgressCallback | None = None,
        evidence: ConsensusEvidenceBundle | None = None,
    ) -> ConsensusResult:
        """
        Run all specialists on the query and return a consensus result.

        Uses ThreadPoolExecutor for parallel execution since each specialist
        makes independent LLM + tool calls.
        """
        evidence = evidence or build_consensus_evidence(query)
        specialist_query = evidence.augment(query)
        specialists = self._create_specialists()
        opinions: list[AgentOpinion] = []
        completed_tools: list[str] = []

        print(f"\n{'=' * 60}")
        print("  Quanfora 2.0 — Multi-Agent Consensus Analysis")
        print(f"  Query: {query[:80]}...")
        print(
            f"  Dispatching to {len(specialists)} specialists (sequential, rate-limit safe)..."
        )
        print(f"{'=' * 60}\n")

        # Run specialists sequentially with a delay between each to stay
        # within Gemini free-tier rate limits (~15 RPM).
        for i, specialist in enumerate(specialists):
            if i > 0:
                time.sleep(
                    5
                )  # Wait before the phase starts so duration reflects real work.
            if progress_callback:
                progress_callback(
                    {
                        "active_tool": specialist.name,
                        "completed_tools": list(completed_tools),
                        "active_label": specialist.display_name,
                        "message": f"{specialist.display_name} is working...",
                        "activity_detail": _SPECIALIST_ACTIVITY_DETAILS.get(
                            specialist.name,
                            f"{specialist.display_name} is reviewing the available evidence.",
                        ),
                    }
                )
            try:
                opinion = self._run_specialist(specialist, specialist_query, evidence)
                opinions.append(opinion)
                completed_tools.append(specialist.name)
                if progress_callback:
                    progress_callback(
                        {
                            "active_tool": None,
                            "completed_tools": list(completed_tools),
                            "active_label": specialist.display_name,
                            "message": f"{specialist.display_name} completed analysis.",
                            "activity_detail": (
                                f"Returned a {opinion.verdict.value} view at "
                                f"{opinion.confidence:.0%} confidence"
                                f" with {len(opinion.risk_flags)} risk"
                                f"{'s' if len(opinion.risk_flags) != 1 else ''} and "
                                f"{len(opinion.limitations)} limitation"
                                f"{'s' if len(opinion.limitations) != 1 else ''}."
                            ),
                        }
                    )
                print(
                    f"  ✓ {specialist.display_name}: {opinion.verdict.value} (confidence: {opinion.confidence:.0%})"
                )
            except Exception as exc:
                print(f"  ✗ {specialist.display_name}: failed — {exc}")
                opinions.append(
                    AgentOpinion(
                        agent_name=specialist.name,
                        verdict=Verdict.NEUTRAL,
                        confidence=0.1,
                        reasoning=f"Specialist unavailable: {str(exc)[:100]}",
                        status="unavailable",
                        limitations=[f"{specialist.display_name} analysis failed."],
                    )
                )
                completed_tools.append(specialist.name)
                if progress_callback:
                    progress_callback(
                        {
                            "active_tool": None,
                            "completed_tools": list(completed_tools),
                            "active_label": specialist.display_name,
                            "message": f"{specialist.display_name} completed with fallback analysis.",
                            "activity_detail": "Used a neutral fallback because this specialist could not complete.",
                            "tool_warning": str(exc),
                        }
                    )

        result = self.consensus_engine.aggregate(opinions, evidence)
        print(f"\n{'─' * 60}")
        print(
            f"  Consensus: {result.verdict.value.upper()} | Score: {result.consensus_score:+.2f} | Agreement: {result.agreement_ratio:.0%}"
        )
        print(f"{'─' * 60}\n")

        return result

    @staticmethod
    def _run_specialist(
        specialist: BaseSpecialist,
        query: str,
        evidence: ConsensusEvidenceBundle | None = None,
    ) -> AgentOpinion:
        """Execute a single specialist analysis (runs in thread)."""
        return specialist.analyze(query, evidence=evidence)

    def chat(
        self,
        message: str,
        remember: bool = True,
        progress_callback: ProgressCallback | None = None,
    ) -> str:
        """
        Full Quanfora 2.0 consensus chat.

        1. Dispatch to all specialists
        2. Collect opinions + run consensus
        3. Synthesize a final human-readable response via LLM
        """
        result = self.analyze(message, progress_callback=progress_callback)
        completed_tools = [opinion.agent_name for opinion in result.opinions]
        if progress_callback:
            progress_callback(
                {
                    "active_tool": "consensus_synthesis",
                    "completed_tools": completed_tools,
                    "active_label": "Consensus Synthesis",
                    "message": "Building weighted consensus verdict...",
                    "activity_detail": "Weighting specialist conclusions, confidence, disagreement, and risk flags.",
                }
            )
        final_response = self._synthesize_response(message, result)
        if progress_callback:
            progress_callback(
                {
                    "active_tool": None,
                    "completed_tools": [*completed_tools, "consensus_synthesis"],
                    "active_label": "Consensus Synthesis",
                    "message": "Consensus response completed.",
                    "activity_detail": (
                        f"Prepared a {result.verdict.value} consensus view at "
                        f"{result.confidence:.0%} confidence with "
                        f"{result.agreement_ratio:.0%} specialist agreement."
                    ),
                }
            )

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
                f"- Risk Flags: {o.risk_flags}\n"
                f"- Limitations: {o.limitations}\n"
                f"- Per-Asset Opinions: "
                f"{ {symbol: {'verdict': asset.verdict.value, 'confidence': asset.confidence, 'reasoning': asset.reasoning, 'data_points': asset.data_points, 'risk_flags': asset.risk_flags, 'limitations': asset.limitations} for symbol, asset in o.asset_opinions.items()} }"
                for o in result.opinions
            )

            synthesis_prompt = _build_consensus_synthesis_prompt(
                query, result, opinions_text
            )

            response = llm.invoke([{"role": "user", "content": synthesis_prompt}])

            # Normalize content for Gemini 2.5 list-of-parts responses.
            response_content = response.content
            if isinstance(response_content, list):
                response_content = "\n".join(
                    part.get("text", str(part)) if isinstance(part, dict) else str(part)
                    for part in response_content
                )

            self.gateway.record_usage(
                user_id=self.user_id,
                task_type="consensus_synthesis",
                routed_model=routed,
                input_text=synthesis_prompt,
                output_text=(
                    response_content
                    if isinstance(response_content, str)
                    else str(response_content)
                ),
            )

            return response_content

        except Exception:
            # Fallback: return the raw consensus summary.
            return self._fallback_response(result)

    @staticmethod
    def _fallback_response(result: ConsensusResult) -> str:
        """Generate a basic response if LLM synthesis fails."""
        parts = [
            f"## Quanfora 2.0 Consensus: {result.verdict.value.upper()}",
            f"**Confidence:** {result.confidence:.0%} | **Score:** {result.consensus_score:+.2f} | **Agreement:** {result.agreement_ratio:.0%}",
            "",
        ]

        if result.asset_results:
            parts.append("### Per-stock verdicts")
            for asset in result.asset_results:
                parts.append(
                    f"- **{asset.symbol}: {asset.verdict.value.replace('_', ' ').title()}** "
                    f"({asset.confidence:.0%} confidence, {asset.agreement_ratio:.0%} exact-verdict agreement)"
                )

        if result.risk_vetoed:
            parts.append(
                "⚠️ **Risk Veto Activated** — Multiple critical risk flags detected.\n"
            )

        parts.append("### Specialist Opinions")
        for o in result.opinions:
            parts.append(
                f"- **{o.agent_name.replace('_', ' ').title()}**: {o.verdict.value} ({o.confidence:.0%}) — {o.reasoning[:150]}"
            )

        if result.risk_flags:
            parts.append(
                "\n### Risk Flags\n" + "\n".join(f"- {f}" for f in result.risk_flags)
            )

        if result.limitations:
            parts.append(
                "\n### Evidence limitations\n"
                + "\n".join(f"- {item}" for item in result.limitations)
            )

        if result.dissenting_agents:
            parts.append(
                f"\n### Dissenting Views\n{', '.join(result.dissenting_agents)}"
            )

        parts.append(
            "\n---\n*This is AI-generated analysis from Quanfora 2.0's multi-agent consensus system, not professional financial advice.*"
        )

        return "\n".join(parts)

    def reset_history(self) -> None:
        """Clear conversation history."""
        self._history = []
        print("Quanfora 2.0 conversation history cleared.")
