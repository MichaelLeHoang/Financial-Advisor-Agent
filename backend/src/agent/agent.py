"""
Financial Advisor Agent — Quanfora 2.0

Supports two modes:
- **Single-agent** (legacy): A single LangGraph ReAct agent with all tools.
  Fast, suitable for simple queries like "What is the price of AAPL?"
- **Multi-agent consensus** (Quanfora 2.0): 5 specialist agents analyze
  independently, then a consensus engine aggregates their opinions.
  Suitable for investment analysis queries.

The API defaults to single-agent for speed; consensus mode is opt-in via
`mode="consensus"` or auto-detected for complex investment queries.
"""

import asyncio
from typing import Any, Callable

from langgraph.prebuilt import create_react_agent

from src.agent.market_grounding import ground_market_query, is_market_quote_query
from src.agent.tools import ALL_TOOLS
from src.llm.gateway import LLMGateway, RoutedChatModel, llm_gateway
from src.llm.routing_policy import LLMMode
from src.saas.models import Plan

def _consensus_result_metadata(result: Any) -> dict:
    return {
        "consensus": {
            "verdict": result.verdict.value,
            "confidence": result.confidence,
            "consensus_score": result.consensus_score,
            "agreement_ratio": result.agreement_ratio,
            "risk_vetoed": result.risk_vetoed,
            "risk_flags": result.risk_flags or [],
            "dissenting_agents": result.dissenting_agents or [],
            "opinions": [
                {
                    "agent": opinion.agent_name,
                    "verdict": opinion.verdict.value,
                    "confidence": opinion.confidence,
                    "reasoning": opinion.reasoning,
                    "data_points": opinion.data_points or {},
                    "risk_flags": opinion.risk_flags or [],
                }
                for opinion in result.opinions
            ],
        }
    }

SYSTEM_PROMPT = """You are a professional Financial Advisor AI Agent with access to real-time tools.

YOUR CAPABILITIES:
- Get current stock prices and data
- Search recent financial news headlines for any stock
- Get a broad market overview (indices, ETFs, VIX) for market pulse queries
- Analyze market sentiment using FinBERT AI
- Predict stock movement using the ensemble ML tool by default
- Optimize portfolios using Classical (Markowitz) and Quantum (QAOA) methods

RULES:
1. ALWAYS use your tools to get real data before answering — never guess
2. For investment questions, check AT LEAST: current price + news + sentiment
3. If the user does NOT provide specific articles or headlines, ALWAYS call search_financial_news first to get recent headlines, then pass those headlines to analyze_sentiment
4. For broad-market queries like "market pulse", "market overview", "how is the market today", or "today's market", call research_market to scan major indices (SPY, QQQ, DIA, IWM, VIX) and market-wide news. Then call analyze_sentiment on the market headlines. Synthesize into a concise market pulse with risks and opportunities.
5. Cite specific numbers from tool outputs
6. When citing news, you MUST render the link using the article's headline as the clickable text in markdown format: `[Exact Headline Title](URL)`. Do NOT use numbers like `[1]` for links. Always include the publisher name.
7. Be concise but thorough
8. End with a disclaimer: "This is AI-generated analysis, not professional financial advice."
9. If multiple stocks are mentioned, analyze each one
10. Always use ticker symbols (e.g. AAPL, not Apple) when calling tools
11. For prediction requests, call predict_stock_price with model="ensemble" unless the user explicitly asks for Random Forest or LSTM only
12. When reporting prediction output, include RF, LSTM, weighted ensemble, confidence, validation metrics when returned, and the tool's caveats. Do not invent metrics.
13. For stock price, ticker lookup, public/private, or "how is [company/ticker] doing today" questions, call market_search and/or market_quote before answering. Never answer those questions from model memory.
"""

ProgressCallback = Callable[[dict[str, Any]], None]


# Keywords that suggest a complex investment query (triggers consensus mode).
_CONSENSUS_KEYWORDS = {
    "should i invest",
    "should i buy",
    "should i sell",
    "is it a good time",
    "investment analysis",
    "full analysis",
    "comprehensive analysis",
    "deep analysis",
    "consensus",
    "multi-agent",
    "quanad",
    "risk assessment",
    "portfolio review",
}


def _is_consensus_query(message: str) -> bool:
    """Heuristic: detect if the query warrants multi-agent consensus analysis."""
    lower = message.lower()
    return any(kw in lower for kw in _CONSENSUS_KEYWORDS)


def _is_deep_market_analysis_query(message: str) -> bool:
    """Quote/public-status prompts are fast-path unless the user asks for analysis."""
    return _is_consensus_query(message)


class FinancialAdvisorAgent:
    """
    LangChain-powered financial advisor agent with Quanfora 2.0 consensus support.

    Usage:
        # Single-agent mode (default)
        agent = FinancialAdvisorAgent()
        response = agent.chat("What is the price of AAPL?")

        # Force consensus mode
        response = agent.chat("Should I invest in NVDA?", mode="consensus")

        # Auto-detect mode
        response = agent.chat("Should I invest in NVDA?", mode="auto")
    """

    def __init__(
        self,
        provider: str = "google",
        *,
        user_id: str = "guest",
        plan: Plan | str = Plan.FREE,
        task_type: str = "chat",
        preferred_mode: LLMMode | None = None,
        gateway: LLMGateway = llm_gateway,
    ):
        self.user_id = user_id
        self.plan = plan if isinstance(plan, Plan) else Plan(plan)
        self.task_type = task_type
        self.preferred_mode = preferred_mode
        self.gateway = gateway
        self._routed_model = self._create_llm(provider)
        self.last_response_metadata: dict | None = None
        self._llm = self._routed_model.chat_model
        self._agent = create_react_agent(
            self._llm,
            ALL_TOOLS,
            prompt=SYSTEM_PROMPT,
        )
        self._history: list[dict] = []  # Multi-turn conversation history

        # Lazy-init the Quanfora orchestrator only when needed.
        self._orchestrator = None

    def _create_llm(self, provider: str) -> RoutedChatModel:
        """
        Create LLM instance through the Sprint 4 gateway.

        The legacy ``provider`` argument is kept for call-site compatibility;
        routing policy now owns provider and model selection.
        """
        del provider
        return self.gateway.get_chat_model(
            user_id=self.user_id,
            plan=self.plan,
            task_type=self.task_type,
            messages=[],
            preferred_mode=self.preferred_mode,
        )

    def _get_orchestrator(self):
        """Lazy-initialize the Quanfora 2.0 orchestrator."""
        if self._orchestrator is None:
            from src.agent.orchestrator import QuanforaOrchestrator

            self._orchestrator = QuanforaOrchestrator(
                user_id=self.user_id,
                plan=self.plan,
                preferred_mode=self.preferred_mode,
                gateway=self.gateway,
            )
        return self._orchestrator

    def chat(
        self,
        message: str,
        remember: bool = True,
        mode: str = "single",
        progress_callback: ProgressCallback | None = None,
    ) -> str:
        """
        Send a message and get the agent's response.

        Args:
            message: User's message.
            remember: If True, maintains conversation history for multi-turn context.
            mode: "single" (default ReAct agent), "consensus" (Quanfora 2.0),
                  or "auto" (auto-detect based on query complexity).
        """
        self.last_response_metadata = None

        if is_market_quote_query(message) and not _is_deep_market_analysis_query(message):
            grounded = ground_market_query(message, progress_callback=progress_callback)
            if grounded.handled and grounded.response:
                if remember:
                    self._history.append({"role": "user", "content": message})
                    self._history.append({"role": "assistant", "content": grounded.response})
                return grounded.response

        use_consensus = (
            mode == "consensus"
            or (mode == "auto" and _is_consensus_query(message))
        )

        if use_consensus:
            return self._chat_consensus(
                message,
                remember,
                progress_callback=progress_callback,
            )
        return self._chat_single(message, remember, progress_callback=progress_callback)

    def _chat_single(
        self,
        message: str,
        remember: bool,
        progress_callback: ProgressCallback | None = None,
    ) -> str:
        """Single-agent ReAct path (fast, original behavior)."""
        print(f"\n Agent processing: '{message[:60]}...'")
        if progress_callback:
            progress_callback({
                "active_tool": "single_scope",
                "completed_tools": [],
                "active_label": "Identify Market Scope",
                "message": "Identifying market scope...",
            })

        # Build message list: history + new user message
        messages = self._history + [{"role": "user", "content": message}]

        completed_tools: list[str] = []
        result = None

        if progress_callback:
            async def collect_events() -> None:
                nonlocal result
                async for event in self._agent.astream_events({"messages": messages}, version="v2"):
                    kind = event.get("event")
                    name = event.get("name")

                    if kind == "on_tool_start" and name:
                        if "single_scope" not in completed_tools:
                            completed_tools.append("single_scope")
                        progress_callback({
                            "active_tool": name,
                            "completed_tools": list(completed_tools),
                            "active_label": str(name).replace("_", " ").title(),
                            "message": f"{str(name).replace('_', ' ').title()} is running...",
                        })

                    elif kind == "on_tool_end" and name:
                        if name not in completed_tools:
                            completed_tools.append(name)
                        progress_callback({
                            "active_tool": None,
                            "completed_tools": list(completed_tools),
                            "active_label": str(name).replace("_", " ").title(),
                            "message": f"{str(name).replace('_', ' ').title()} completed.",
                        })

                    elif kind == "on_chat_model_start" and any(tool != "single_scope" for tool in completed_tools):
                        progress_callback({
                            "active_tool": "single_synthesis",
                            "completed_tools": list(completed_tools),
                            "active_label": "Synthesize Findings",
                            "message": "Synthesizing findings...",
                        })

                    elif kind == "on_chain_end":
                        output = event.get("data", {}).get("output")
                        if isinstance(output, dict) and "messages" in output:
                            result = output

            asyncio.run(collect_events())

            for tool in ("single_synthesis", "single_final"):
                if tool not in completed_tools:
                    completed_tools.append(tool)
            progress_callback({
                "active_tool": None,
                "completed_tools": list(completed_tools),
                "active_label": "Agent Execution",
                "message": "Agent response completed.",
            })
        else:
            result = self._agent.invoke({"messages": messages})

        if result is None:
            result = self._agent.invoke({"messages": messages})

        # Extract final assistant reply
        final_message = result["messages"][-1]
        response_text = final_message.content

        # Gemini 2.5 may return content as a list of parts instead of a string.
        if isinstance(response_text, list):
            response_text = "\n".join(
                part.get("text", str(part)) if isinstance(part, dict) else str(part)
                for part in response_text
            )

        # Update conversation history for next turn
        if remember:
            self._history.append({"role": "user", "content": message})
            self._history.append({"role": "assistant", "content": response_text})

        self.gateway.record_usage(
            user_id=self.user_id,
            task_type=self.task_type,
            routed_model=self._routed_model,
            input_text="\n".join(str(item.get("content", "")) for item in messages),
            output_text=response_text if isinstance(response_text, str) else str(response_text),
        )

        return response_text

    def _chat_consensus(
        self,
        message: str,
        remember: bool,
        progress_callback: ProgressCallback | None = None,
    ) -> str:
        """Quanfora 2.0 multi-agent consensus path."""
        orchestrator = self._get_orchestrator()
        result = orchestrator.analyze(message)
        self.last_response_metadata = _consensus_result_metadata(result)
        completed_tools = [opinion.agent_name for opinion in result.opinions]
        if progress_callback:
            progress_callback({
                "active_tool": "consensus_synthesis",
                "completed_tools": completed_tools,
                "active_label": "Consensus Synthesis",
                "message": "Synthesizing consensus response...",
            })
        response_text = orchestrator._synthesize_response(message, result)
        if progress_callback:
            progress_callback({
                "active_tool": None,
                "completed_tools": [*completed_tools, "consensus_synthesis"],
                "active_label": "Consensus Complete",
                "message": "Consensus response completed.",
            })

        if remember:
            self._history.append({"role": "user", "content": message})
            self._history.append({"role": "assistant", "content": response_text})

        return response_text

    def reset_history(self) -> None:
        """Clear conversation history to start a fresh session."""
        self._history = []
        if self._orchestrator is not None:
            self._orchestrator.reset_history()
        print("Conversation history cleared.")
