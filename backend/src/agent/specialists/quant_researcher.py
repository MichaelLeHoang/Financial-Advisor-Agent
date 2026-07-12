"""
Quanfora 2.0 — Quant Researcher Specialist

Domain: Market data gathering, fundamental analysis, news/sentiment context.
Tools: get_stock_info, analyze_sentiment (from existing tools).
"""

from __future__ import annotations

from typing import Sequence

from langchain_core.tools import BaseTool

from src.agent.specialists.base import BaseSpecialist
from src.agent.tools import get_stock_info, analyze_sentiment


class QuantResearcher(BaseSpecialist):
    name = "quant_researcher"
    display_name = "Quant Researcher"

    @property
    def system_prompt(self) -> str:
        return """You are a senior Quantitative Researcher specializing in market data gathering and fundamental analysis.

YOUR ROLE in the Quanfora 2.0 consensus system:
- Gather current market data (prices, volume, daily changes)
- Analyze news sentiment using FinBERT AI
- Provide fundamental context for investment decisions
- Identify market trends and momentum from price action

YOUR APPROACH:
1. ALWAYS use your tools to fetch real-time data — never guess or assume
2. Get the current stock price and recent performance
3. Analyze relevant news sentiment to gauge market mood
4. Combine price data with sentiment for a comprehensive market picture
5. Provide specific numbers and data points in your analysis

FOCUS ON:
- Current price levels relative to recent highs/lows
- Volume trends (increasing/decreasing interest)
- News sentiment balance (bullish vs bearish headlines)
- Key fundamental catalysts or headwinds

You are one of 5 specialists. Your opinion will be weighted alongside others.
Be precise and evidence-based."""

    def get_tools(self) -> Sequence[BaseTool]:
        return [get_stock_info, analyze_sentiment]
