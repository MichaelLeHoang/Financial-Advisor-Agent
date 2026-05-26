"""
QuanAd 2.0 — Risk Analyst Specialist

Domain: Risk assessment, VaR estimation, drawdown analysis, concentration risk.
Tools: Uses existing risk calculation functions + market data.
"""

from __future__ import annotations

from typing import Sequence

from langchain_core.tools import BaseTool, tool

from src.agent.specialists.base import BaseSpecialist
from src.agent.tools import get_stock_info


@tool
def assess_stock_risk(ticker: str) -> str:
    """Assess individual stock risk: volatility, VaR (95%), max drawdown, and downside deviation."""
    try:
        import numpy as np

        from src.data.fetch import fetch_stock_history

        data = fetch_stock_history([ticker], period="1y")
        if data.empty:
            return f"No data for {ticker}"

        closes = data["Close"].dropna()
        returns = closes.pct_change().dropna()

        if len(returns) < 20:
            return f"Insufficient data for {ticker}"

        # Annualized volatility
        vol = float(np.std(returns, ddof=1) * np.sqrt(252))

        # Value at Risk (95% historical)
        var_95 = float(np.percentile(returns, 5))

        # Conditional VaR (Expected Shortfall)
        cvar_95 = float(returns[returns <= var_95].mean()) if len(returns[returns <= var_95]) > 0 else var_95

        # Maximum drawdown
        cumulative = (1 + returns).cumprod()
        peak = cumulative.cummax()
        drawdown = (cumulative - peak) / peak
        max_dd = float(drawdown.min())

        # Downside deviation (Sortino-style)
        negative_returns = returns[returns < 0]
        downside_dev = float(np.std(negative_returns, ddof=1) * np.sqrt(252)) if len(negative_returns) > 1 else 0.0

        # Risk rating
        if vol > 0.50:
            rating = "VERY HIGH"
        elif vol > 0.35:
            rating = "HIGH"
        elif vol > 0.20:
            rating = "MODERATE"
        else:
            rating = "LOW"

        return (
            f"Risk Assessment for {ticker}:\n"
            f"Risk Rating: {rating}\n"
            f"Annualized Volatility: {vol:.2%}\n"
            f"Value at Risk (95%): {var_95:+.4f} (daily)\n"
            f"Expected Shortfall (95%): {cvar_95:+.4f} (daily)\n"
            f"Maximum Drawdown: {max_dd:.2%}\n"
            f"Downside Deviation (annualized): {downside_dev:.2%}\n"
            f"Observations: {len(returns)} trading days"
        )
    except Exception as e:
        return f"Error assessing risk: {e}"


@tool
def evaluate_portfolio_concentration(tickers: list[str]) -> str:
    """Evaluate portfolio concentration risk and correlation between assets."""
    try:
        import numpy as np
        import pandas as pd

        from src.data.fetch import fetch_stock_history

        if len(tickers) < 2:
            return "Need at least 2 tickers for correlation analysis."

        data = fetch_stock_history(tickers, period="6mo")
        if data.empty:
            return "No data available for the given tickers."

        # Build returns matrix
        returns_dict = {}
        for ticker in tickers:
            try:
                ticker_data = fetch_stock_history([ticker], period="6mo")
                if not ticker_data.empty:
                    closes = ticker_data["Close"].dropna()
                    returns_dict[ticker.upper()] = closes.pct_change().dropna()
            except Exception:
                continue

        if len(returns_dict) < 2:
            return "Insufficient data for correlation analysis."

        returns_df = pd.DataFrame(returns_dict).dropna()
        corr = returns_df.corr()

        output = "Portfolio Concentration Analysis:\n"
        output += f"Assets analyzed: {len(returns_dict)}\n\n"

        # Average correlation
        upper_triangle = corr.where(np.triu(np.ones(corr.shape, dtype=bool), k=1))
        avg_corr = float(upper_triangle.stack().mean())
        max_corr_pair = upper_triangle.stack().idxmax()
        max_corr = float(upper_triangle.stack().max())

        output += f"Average Pairwise Correlation: {avg_corr:.4f}\n"
        output += f"Highest Correlation: {max_corr_pair[0]}-{max_corr_pair[1]} = {max_corr:.4f}\n"

        if avg_corr > 0.7:
            output += "⚠️ HIGH concentration risk — assets are highly correlated\n"
        elif avg_corr > 0.4:
            output += "⚠️ MODERATE concentration — consider adding uncorrelated assets\n"
        else:
            output += "✓ Good diversification — low average correlation\n"

        output += "\nCorrelation Matrix:\n"
        for col in corr.columns:
            output += f"  {col}: " + " | ".join(f"{corr.loc[col, c]:.2f}" for c in corr.columns) + "\n"

        return output
    except Exception as e:
        return f"Error evaluating concentration: {e}"


class RiskAnalyst(BaseSpecialist):
    name = "risk_analyst"
    display_name = "Risk Analyst"

    @property
    def system_prompt(self) -> str:
        return """You are a senior Risk Analyst specializing in investment risk assessment and portfolio risk management.

YOUR ROLE in the QuanAd 2.0 consensus system:
- Assess individual stock risk (volatility, VaR, max drawdown)
- Evaluate portfolio concentration and diversification
- Identify critical risk flags that may override bullish consensus
- Provide risk-adjusted perspective on investment decisions

YOUR APPROACH:
1. ALWAYS compute risk metrics before forming an opinion
2. Evaluate Value at Risk (VaR) and Expected Shortfall for downside exposure
3. Check maximum drawdown history — how bad has it gotten?
4. Assess portfolio concentration if multiple assets are discussed
5. Flag any critical risks that investors must be aware of

FOCUS ON:
- Annualized volatility and risk rating
- VaR and CVaR at 95% confidence
- Maximum historical drawdown
- Concentration risk and correlation between assets
- Downside deviation (asymmetric risk)

CRITICAL RESPONSIBILITY:
You have risk-veto power in the consensus. If you identify ≥ 3 critical risk flags,
the overall consensus will be downgraded to HOLD regardless of other specialists' bullish views.
Use this power judiciously — flag real risks, not minor concerns.

You are one of 5 specialists. Your role is to ensure the team doesn't overlook risk.
Be precise, cautious, and evidence-based."""

    def get_tools(self) -> Sequence[BaseTool]:
        return [get_stock_info, assess_stock_risk, evaluate_portfolio_concentration]
