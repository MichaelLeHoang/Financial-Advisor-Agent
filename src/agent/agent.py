from langgraph.prebuilt import create_react_agent
from src.agent.tools import ALL_TOOLS
from src.llm.gateway import LLMGateway, RoutedChatModel, llm_gateway
from src.llm.routing_policy import LLMMode
from src.saas.models import Plan

SYSTEM_PROMPT = """You are a professional Financial Advisor AI Agent with access to real-time tools.

YOUR CAPABILITIES:
- Get current stock prices and data
- Analyze market sentiment using FinBERT AI
- Predict stock price direction using ML models
- Optimize portfolios using Classical (Markowitz) and Quantum (QAOA) methods

RULES:
1. ALWAYS use your tools to get real data before answering — never guess
2. For investment questions, check AT LEAST: current price + sentiment OR prediction
3. Cite specific numbers from tool outputs
4. Be concise but thorough
5. End with a disclaimer: "This is AI-generated analysis, not professional financial advice."
6. If multiple stocks are mentioned, analyze each one
"""

class FinancialAdvisorAgent: 
    """
    LangChain-powered financial advisor agent.
    Usage:
        agent = FinancialAdvisorAgent()
        response = agent.chat("Should I invest in NVDA?")
        print(response)
    To swap LLM providers:
        # Gemini (default)
        agent = FinancialAdvisorAgent(provider="google")
        # OpenAI (if you add the key)
        agent = FinancialAdvisorAgent(provider="openai")
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
        self._llm = self._routed_model.chat_model
        self._agent = create_react_agent(
            self._llm,
            ALL_TOOLS,
            state_modifier=SYSTEM_PROMPT,  
        )
        self._history: list[dict] = []  # Multi-turn conversation history

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

    def chat(self, message: str, remember: bool = True) -> str:
        """
        Send a message and get the agent's response.

        Args:
            message: User's message.
            remember: If True, maintains conversation history for multi-turn context.
        """
        print(f"\n Agent processing: '{message[:60]}...'")

        # Build message list: history + new user message
        messages = self._history + [{"role": "user", "content": message}]

        result = self._agent.invoke({"messages": messages})

        # Extract final assistant reply
        final_message = result["messages"][-1]
        response_text = final_message.content

        # Update conversation history for next turn
        if remember:
            self._history.append({"role": "user", "content": message})
            self._history.append({"role": "assistant", "content": response_text})

        self.gateway.record_usage(
            user_id=self.user_id,
            task_type=self.task_type,
            routed_model=self._routed_model,
            input_text="\n".join(str(item.get("content", "")) for item in messages),
            output_text=response_text,
        )

        return response_text

    def reset_history(self) -> None:
        """Clear conversation history to start a fresh session."""
        self._history = []
        print("Conversation history cleared.")
