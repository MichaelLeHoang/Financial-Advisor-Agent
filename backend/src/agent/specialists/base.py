"""
QuanAd 2.0 — Base Specialist Agent

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
from datetime import UTC, datetime
from typing import Any, Sequence

from langchain_core.tools import BaseTool
from langgraph.prebuilt import create_react_agent

from src.agent.consensus import AgentOpinion, Verdict
from src.llm.gateway import LLMGateway, llm_gateway
from src.llm.routing_policy import LLMMode
from src.saas.models import Plan


# JSON schema the specialist LLM must return inside its final message.
OPINION_SCHEMA_PROMPT = """
After your analysis, you MUST end your response with a JSON block wrapped in ```json ... ``` markers:

```json
{
  "verdict": "bullish" | "bearish" | "neutral" | "hold",
  "confidence": 0.0 to 1.0,
  "reasoning": "One-paragraph explanation of your analysis",
  "data_points": {"key": "value", ...},
  "risk_flags": ["flag1", "flag2"]
}
```

Rules for the JSON:
- verdict is required and must be one of: bullish, bearish, neutral, hold
- confidence is required — how confident you are in your verdict (0.0 = no confidence, 1.0 = absolute certainty)
- reasoning is required — your expert analysis in 2-4 sentences
- data_points — key metrics that support your verdict
- risk_flags — any concerns or risks you identified (can be empty list)
"""


class BaseSpecialist(ABC):
    """Abstract base class for all QuanAd 2.0 specialist agents."""

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

    def analyze(self, query: str) -> AgentOpinion:
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
            tools = list(self.get_tools())

            full_prompt = self.system_prompt + "\n\n" + OPINION_SCHEMA_PROMPT

            agent = create_react_agent(llm, tools, prompt=full_prompt)
            result = agent.invoke({"messages": [{"role": "user", "content": query}]})

            # Extract the final message content.
            final_content = result["messages"][-1].content
            opinion = self._parse_opinion(final_content)

            # Record usage.
            self.gateway.record_usage(
                user_id=self.user_id,
                task_type="consensus_analysis",
                routed_model=routed,
                input_text=query,
                output_text=final_content,
            )

            return opinion

        except Exception:
            # On failure, return a neutral low-confidence opinion.
            return AgentOpinion(
                agent_name=self.name,
                verdict=Verdict.NEUTRAL,
                confidence=0.1,
                reasoning=f"{self.display_name} encountered an error during analysis: {traceback.format_exc()[:200]}",
                data_points={"error": True},
                risk_flags=[f"{self.display_name} analysis unavailable"],
            )

    def _parse_opinion(self, content: str) -> AgentOpinion:
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
                    confidence=0.3,
                    reasoning=content[:500],
                    risk_flags=["Could not parse structured opinion"],
                )

        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            return AgentOpinion(
                agent_name=self.name,
                verdict=Verdict.NEUTRAL,
                confidence=0.3,
                reasoning=content[:500],
                risk_flags=["JSON parse error in opinion"],
            )

        verdict_str = str(data.get("verdict", "neutral")).lower()
        try:
            verdict = Verdict(verdict_str)
        except ValueError:
            verdict = Verdict.NEUTRAL

        return AgentOpinion(
            agent_name=self.name,
            verdict=verdict,
            confidence=max(0.0, min(1.0, float(data.get("confidence", 0.5)))),
            reasoning=str(data.get("reasoning", "")),
            data_points=data.get("data_points", {}),
            risk_flags=data.get("risk_flags", []),
        )
