"""
Quanfora 2.0 — Base Specialist Agent

Every specialist inherits from BaseSpecialist. It provides:
- Structured opinion extraction via LLM
- Domain-specific tool binding
- Timeout and error handling
"""

from __future__ import annotations

import json
import re
import traceback
from abc import ABC, abstractmethod
from typing import TYPE_CHECKING, Any, Sequence

from langchain_core.tools import BaseTool
from langgraph.prebuilt import create_react_agent

from src.agent.consensus import AgentOpinion, AssetOpinion, Verdict
from src.llm.gateway import LLMGateway, llm_gateway
from src.llm.routing_policy import LLMMode
from src.saas.models import Plan

if TYPE_CHECKING:
    from src.agent.consensus_evidence import ConsensusEvidenceBundle


# JSON schema the specialist LLM must return inside its final message.
OPINION_SCHEMA_PROMPT = """
After your analysis, you MUST end your response with a JSON block wrapped in ```json ... ``` markers:

```json
{
  "verdict": "bullish" | "bearish" | "neutral" | "hold",
  "confidence": 0.0 to 1.0,
  "reasoning": "One-paragraph explanation of your analysis",
  "data_points": {"key": "value", ...},
  "risk_flags": ["genuine investment risk only"],
  "limitations": ["missing or unavailable evidence"],
  "asset_opinions": {
    "AAPL": {
      "verdict": "bullish" | "bearish" | "neutral" | "hold" | "insufficient_data",
      "confidence": 0.0 to 1.0,
      "reasoning": "Ticker-specific conclusion",
      "data_points": {"key": "value", ...},
      "risk_flags": [],
      "limitations": [],
      "risk_level": "low" | "moderate" | "high" | "critical" | "unknown"
    }
  }
}
```

Rules for the JSON:
- verdict is required and must be one of: bullish, bearish, neutral, hold
- confidence is required — how confident you are in your verdict (0.0 = no confidence, 1.0 = absolute certainty)
- reasoning is required — your expert analysis in 2-4 sentences
- data_points — key metrics that support your verdict
- risk_flags — genuine market, company, or portfolio risks only (can be empty)
- limitations — missing data, unavailable tools, or evidence-quality constraints; never put these in risk_flags
- asset_opinions — required for every ticker named in the evidence bundle; do not combine multiple stocks into one verdict
"""


class BaseSpecialist(ABC):
    """Abstract base class for all Quanfora 2.0 specialist agents."""

    name: str = "base_specialist"
    display_name: str = "Base Specialist"

    def __init__(
        self,
        *,
        user_id: str = "guest",
        plan: Plan | str = Plan.FREE,
        preferred_mode: LLMMode | None = None,
        gateway: LLMGateway = llm_gateway,
    ) -> None:
        self.user_id = user_id
        self.plan = plan if isinstance(plan, Plan) else Plan(plan)
        self.preferred_mode = preferred_mode
        self.gateway = gateway

    @property
    @abstractmethod
    def system_prompt(self) -> str:
        """Domain-specific system prompt for this specialist."""
        ...

    @abstractmethod
    def get_tools(self) -> Sequence[BaseTool]:
        """Return the tools available to this specialist."""
        ...

    def tools_for_query(
        self, query: str, evidence: ConsensusEvidenceBundle | None = None
    ) -> Sequence[BaseTool]:
        """Allow specialists to expose intent-dependent tools."""
        return self.get_tools()

    def analyze(
        self, query: str, evidence: ConsensusEvidenceBundle | None = None
    ) -> AgentOpinion:
        """Run the specialist agent on a query and return a structured opinion."""
        try:
            routed = self.gateway.get_chat_model(
                user_id=self.user_id,
                plan=self.plan,
                task_type="consensus_analysis",
                messages=[],
                preferred_mode=self.preferred_mode,
            )
            llm = routed.chat_model
            tools = list(self.tools_for_query(query, evidence))

            full_prompt = self.system_prompt + "\n\n" + OPINION_SCHEMA_PROMPT

            agent = create_react_agent(llm, tools, prompt=full_prompt)
            result = agent.invoke({"messages": [{"role": "user", "content": query}]})

            # Extract the final message content.
            final_content = result["messages"][-1].content

            # Gemini 2.5 may return content as a list of parts.
            if isinstance(final_content, list):
                final_content = "\n".join(
                    part.get("text", str(part)) if isinstance(part, dict) else str(part)
                    for part in final_content
                )

            opinion = self._parse_opinion(
                final_content,
                expected_symbols=evidence.requested_symbols if evidence else [],
            )

            # Record usage.
            self.gateway.record_usage(
                user_id=self.user_id,
                task_type="consensus_analysis",
                routed_model=routed,
                input_text=query,
                output_text=final_content
                if isinstance(final_content, str)
                else str(final_content),
            )

            return opinion

        except Exception as exc:
            # Log the actual error for debugging.
            error_detail = traceback.format_exc()
            print(f"  ✗ {self.display_name} error: {error_detail[-300:]}")

            # On failure, return a neutral low-confidence opinion.
            return AgentOpinion(
                agent_name=self.name,
                verdict=Verdict.NEUTRAL,
                confidence=0.1,
                reasoning=f"{self.display_name} encountered an error: {str(exc)[:200]}",
                data_points={"error": True, "error_type": type(exc).__name__},
                status="unavailable",
                limitations=[
                    f"{self.display_name} analysis unavailable: {str(exc)[:160]}"
                ],
            )

    def _parse_opinion(
        self, content: str, expected_symbols: list[str] | None = None
    ) -> AgentOpinion:
        """Extract the structured JSON opinion from the agent's response."""
        # Try to find JSON block in ```json ... ``` markers.
        json_match = re.search(r"```json\s*(.*?)\s*```", content, re.DOTALL)
        if json_match:
            raw = json_match.group(1)
        else:
            # Fallback: try to find any JSON object in the content.
            json_match = re.search(r"\{[^{}]*\"verdict\"[^{}]*\}", content, re.DOTALL)
            if json_match:
                raw = json_match.group(0)
            else:
                # Last resort: treat entire response as reasoning.
                return AgentOpinion(
                    agent_name=self.name,
                    verdict=Verdict.NEUTRAL,
                    confidence=0.0,
                    reasoning=content[:500],
                    status="unavailable",
                    limitations=[
                        "Could not parse the specialist's structured opinion."
                    ],
                )

        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            return AgentOpinion(
                agent_name=self.name,
                verdict=Verdict.NEUTRAL,
                confidence=0.0,
                reasoning=content[:500],
                status="unavailable",
                limitations=["The specialist returned invalid structured JSON."],
            )

        verdict_str = str(data.get("verdict", "neutral")).lower()
        try:
            verdict = Verdict(verdict_str)
        except ValueError:
            verdict = Verdict.NEUTRAL

        asset_opinions = self._parse_asset_opinions(data.get("asset_opinions"))
        expected = [symbol.upper() for symbol in expected_symbols or []]
        if len(expected) == 1 and expected[0] not in asset_opinions:
            asset_opinions[expected[0]] = AssetOpinion(
                symbol=expected[0],
                verdict=verdict,
                confidence=_confidence(data.get("confidence", 0.5)),
                reasoning=str(data.get("reasoning", "")),
                data_points=_dict(data.get("data_points")),
                risk_flags=_strings(data.get("risk_flags")),
                limitations=_strings(data.get("limitations")),
                risk_level=str(data.get("risk_level", "unknown")),
            )
        missing = [symbol for symbol in expected if symbol not in asset_opinions]
        limitations = _strings(data.get("limitations"))
        status = str(data.get("status", "completed"))
        if missing:
            limitations.append(
                f"No ticker-specific opinion returned for: {', '.join(missing)}."
            )
            status = "partial"
        return AgentOpinion(
            agent_name=self.name,
            verdict=verdict,
            confidence=_confidence(data.get("confidence", 0.5)),
            reasoning=str(data.get("reasoning", "")),
            data_points=_dict(data.get("data_points")),
            risk_flags=_strings(data.get("risk_flags")),
            status=status
            if status in {"completed", "partial", "unavailable"}
            else "completed",
            limitations=list(dict.fromkeys(limitations)),
            asset_opinions=asset_opinions,
        )

    @staticmethod
    def _parse_asset_opinions(raw: Any) -> dict[str, AssetOpinion]:
        if isinstance(raw, list):
            items = {
                str(item.get("symbol", "")): item
                for item in raw
                if isinstance(item, dict) and item.get("symbol")
            }
        elif isinstance(raw, dict):
            items = raw
        else:
            items = {}
        parsed: dict[str, AssetOpinion] = {}
        for raw_symbol, value in items.items():
            if not isinstance(value, dict):
                continue
            symbol = str(raw_symbol).upper()
            try:
                verdict = Verdict(str(value.get("verdict", "neutral")).lower())
            except ValueError:
                verdict = Verdict.NEUTRAL
            parsed[symbol] = AssetOpinion(
                symbol=symbol,
                verdict=verdict,
                confidence=_confidence(value.get("confidence", 0.5)),
                reasoning=str(value.get("reasoning", "")),
                data_points=_dict(value.get("data_points")),
                risk_flags=_strings(value.get("risk_flags")),
                limitations=_strings(value.get("limitations")),
                risk_level=str(value.get("risk_level", "unknown")),
            )
        return parsed


def _confidence(value: Any) -> float:
    try:
        return max(0.0, min(1.0, float(value)))
    except (TypeError, ValueError):
        return 0.0


def _dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _strings(value: Any) -> list[str]:
    return [str(item) for item in value] if isinstance(value, list) else []
