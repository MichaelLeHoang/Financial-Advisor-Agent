"""
QuanAd 2.0 — Financial Data Scientist Specialist

Domain: ML predictions, statistical modeling, pattern recognition.
Tools: predict_stock_price (from existing tools), custom statistical analysis.
"""

from __future__ import annotations

from typing import Sequence

from langchain_core.tools import BaseTool, tool

from src.agent.specialists.base import BaseSpecialist
from src.agent.tools import predict_stock_price, get_stock_info


@tool
def compute_statistical_profile(ticker: str) -> str:
    """Compute statistical profile of a stock: returns distribution, skewness, kurtosis, and autocorrelation."""
    try:
        import numpy as np
        from scipy import stats as scipy_stats

        from src.data.fetch import fetch_stock_history

        data = fetch_stock_history([ticker], period="1y")
        if data.empty:
            return f"No historical data for {ticker}"

        closes = data["Close"].dropna()
        returns = closes.pct_change().dropna()

        if len(returns) < 20:
            return f"Insufficient data for {ticker} (need ≥ 20 days)"

        mean_ret = float(np.mean(returns))
        std_ret = float(np.std(returns, ddof=1))
        skewness = float(scipy_stats.skew(returns))
        kurtosis = float(scipy_stats.kurtosis(returns))
        annualized_return = mean_ret * 252
        annualized_vol = std_ret * np.sqrt(252)

        # Simple autocorrelation (lag-1)
        autocorr = float(returns.autocorr(lag=1)) if len(returns) > 1 else 0.0

        # Normality test (Jarque-Bera)
        jb_stat, jb_pvalue = scipy_stats.jarque_bera(returns)

        return (
            f"Statistical Profile for {ticker}:\n"
            f"Annualized Return: {annualized_return:+.2%}\n"
            f"Annualized Volatility: {annualized_vol:.2%}\n"
            f"Daily Mean Return: {mean_ret:+.6f}\n"
            f"Daily Std Dev: {std_ret:.6f}\n"
            f"Skewness: {skewness:+.4f} ({'left-tail risk' if skewness < -0.5 else 'right-skewed' if skewness > 0.5 else 'symmetric'})\n"
            f"Excess Kurtosis: {kurtosis:+.4f} ({'fat tails' if kurtosis > 1 else 'thin tails' if kurtosis < -1 else 'normal-like'})\n"
            f"Lag-1 Autocorrelation: {autocorr:+.4f}\n"
            f"Jarque-Bera p-value: {jb_pvalue:.4f} ({'non-normal' if jb_pvalue < 0.05 else 'approximately normal'})\n"
            f"Observations: {len(returns)} trading days"
        )
    except Exception as e:
        return f"Error computing statistical profile: {e}"


class FinancialDataScientist(BaseSpecialist):
    name = "data_scientist"
    display_name = "Financial Data Scientist"

    @property
    def system_prompt(self) -> str:
        return """You are a senior Financial Data Scientist specializing in ML predictions and statistical modeling.

YOUR ROLE in the QuanAd 2.0 consensus system:
- Run ML price prediction models, preferring the ensemble mode by default
- Compare Random Forest, LSTM, simple average ensemble, and weighted ensemble forecasts when available
- Compute statistical profiles (returns distribution, skewness, kurtosis)
- Evaluate model accuracy and confidence metrics
- Identify statistical anomalies and patterns

YOUR APPROACH:
1. Use the ML prediction tool with model="ensemble" unless the user explicitly asks for a single model
2. Compute statistical profiles to understand return characteristics
3. Evaluate model reliability via test MAE and RMSE metrics
4. Consider distribution properties (fat tails, skewness) for risk context
5. Assess whether price patterns suggest mean-reversion or momentum

FOCUS ON:
- RF, LSTM, and weighted ensemble predictions
- Validation metrics returned by the tool: MAE, RMSE, directional accuracy, and confidence
- Model agreement or disagreement across RF and LSTM
- Return distribution shape (normal vs fat-tailed)
- Annualized return vs volatility ratio
- Autocorrelation (trend persistence vs mean-reversion signals)

You are one of 5 specialists. Your opinion will be weighted alongside others.
Ground your verdict in model metrics and statistical evidence. Do not invent validation metrics; only cite metrics returned by tools.
Always state that model output is educational analysis, not financial advice."""

    def get_tools(self) -> Sequence[BaseTool]:
        return [get_stock_info, predict_stock_price, compute_statistical_profile]
