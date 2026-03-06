"""
Financial Advisor Agent — Interactive CLI

Usage:
    uv run python main.py
    uv run python main.py --provider openai    # swap LLM provider
"""
import argparse


def main():
    parser = argparse.ArgumentParser(description="Financial Advisor Agent CLI")
    parser.add_argument(
        "--provider",
        default="google",
        choices=["google", "openai", "anthropic"],
        help="LLM provider to use (default: google / Gemini)",
    )
    args = parser.parse_args()

    print("\n" + "=" * 60)
    print("  Financial Advisor Agent")
    print(f"  Provider: {args.provider.upper()}")
    print("=" * 60)
    print("  Commands:")
    print("    Type your question and press Enter")
    print("    'reset'  — Clear conversation history")
    print("    'help'   — Show example questions")
    print("    'exit' or Ctrl-C — Quit")
    print("=" * 60 + "\n")

    from src.agent.agent import FinancialAdvisorAgent

    agent = FinancialAdvisorAgent(provider=args.provider)

    examples = [
        "Should I invest in NVDA right now?",
        "What is the current price of AAPL and is the sentiment positive?",
        "Optimize a portfolio of AAPL, MSFT, GOOGL, NVDA using classical method",
        "Predict the price direction for TSLA",
        "Compare AAPL and MSFT — which looks better?",
    ]

    while True:
        try:
            user_input = input("You: ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\n\nGoodbye! 👋")
            break

        if not user_input:
            continue

        if user_input.lower() in ("exit", "quit", "bye"):
            print("\nGoodbye! 👋")
            break

        if user_input.lower() == "reset":
            agent.reset_history()
            print("🔄 Conversation history cleared.\n")
            continue

        if user_input.lower() == "help":
            print("\n📝 Example questions:")
            for i, ex in enumerate(examples, 1):
                print(f"  {i}. {ex}")
            print()
            continue

        print()
        response = agent.chat(user_input)
        print(f"Agent: {response}\n")


if __name__ == "__main__":
    main()
