from src.agent.consensus import Verdict
from src.agent.specialists.portfolio_analytics import PortfolioAnalytics


def test_specialist_parser_requires_separate_multi_asset_opinions():
    specialist = PortfolioAnalytics()
    content = """```json
    {
      "verdict": "hold",
      "confidence": 0.6,
      "reasoning": "The evidence differs by ticker.",
      "risk_flags": [],
      "limitations": [],
      "asset_opinions": {
        "SNDK": {
          "verdict": "hold",
          "confidence": 0.5,
          "reasoning": "Volatility is elevated.",
          "risk_flags": ["High realized volatility"],
          "limitations": []
        },
        "MU": {
          "verdict": "bullish",
          "confidence": 0.7,
          "reasoning": "Momentum is constructive.",
          "risk_flags": [],
          "limitations": []
        }
      }
    }
    ```"""

    opinion = specialist._parse_opinion(content, ["SNDK", "MU"])

    assert opinion.status == "completed"
    assert opinion.asset_opinions["SNDK"].verdict == Verdict.HOLD
    assert opinion.asset_opinions["MU"].verdict == Verdict.BULLISH


def test_portfolio_optimizer_is_hidden_for_simple_buy_question():
    specialist = PortfolioAnalytics()

    buy_tools = [
        tool.name for tool in specialist.tools_for_query("Should I buy SNDK and MU?")
    ]
    allocation_tools = [
        tool.name
        for tool in specialist.tools_for_query(
            "How should I allocate a portfolio between SNDK and MU?"
        )
    ]

    assert "optimize_portfolio_tool" not in buy_tools
    assert "optimize_portfolio_tool" in allocation_tools
