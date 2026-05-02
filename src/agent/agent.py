from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.prebuilt import create_react_agent
from src.config import settings
from src.agent.tools import ALL_TOOLS

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

    def __init__(self, provider: str = "google"):
        self._llm = self._create_llm(provider)
        self._agent = create_react_agent(
            self._llm,
            ALL_TOOLS,
            state_modifier=SYSTEM_PROMPT,  
        )
        self._history: list[dict] = []  # Multi-turn conversation history

    def _create_llm(self, provider: str):
        """
        Create LLM instance. Swap providers here.
        This is the ONLY place you need to change to switch LLMs.
        """
        if provider == "google":
            api_key = settings.secret_value("gemini_api_key")
            if not api_key:
                raise RuntimeError("GEMINI_API_KEY is required for the Google LLM provider")

            return ChatGoogleGenerativeAI(
                model="gemini-2.0-flash",
                google_api_key=api_key,
                temperature=0.3,
            )
        elif provider == "openai":
            from langchain_openai import ChatOpenAI
            return ChatOpenAI(model="gpt-4o", temperature=0.3)
        elif provider == "anthropic":
            from langchain_anthropic import ChatAnthropic
            return ChatAnthropic(model="claude-sonnet-4-20250514", temperature=0.3)
        else:
            raise ValueError(f"Unknown provider: {provider}")

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

        return response_text

    def reset_history(self) -> None:
        """Clear conversation history to start a fresh session."""
        self._history = []
        print("Conversation history cleared.")
