"""
QuanAd 2.0 — Quant Analyst Specialist

Domain: Technical analysis, signal ranking, strategy backtesting.
Tools: get_stock_info (for price data), analyze_sentiment (market context).
       Also calls quant calculation functions directly for signal analysis.
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Sequence

from langchain_core.tools import BaseTool, tool

from src.agent.specialists.base import BaseSpecialist
from src.agent.tools import get_stock_info


@tool
def rank_market_signals(tickers: list[str]) -> str:
    """Rank stocks by momentum score, volatility, and trend label using quantitative signal analysis."""
    try:
        from src.quant.calculations import rank_signals
        from src.quant.models import SignalRankingRequest
        from src.backtesting.market_data import MarketDataAdapter

        end = date.today()
        start = end - timedelta(days=90)
        req = SignalRankingRequest(symbols=tickers, start_date=start, end_date=end)
        adapter = MarketDataAdapter()
        ranks = rank_signals(req, adapter)

        if not ranks:
            return f"No signal data available for {', '.join(tickers)}"

        output = "Signal Rankings (sorted by composite score):\n"
        for r in ranks:
            output += (
                f"\n{r.symbol}: score={r.score:+.4f} | "
                f"mom_20d={r.momentum_20d:+.2%} | mom_60d={r.momentum_60d:+.2%} | "
                f"vol_20d={r.volatility_20d:.2%} | trend={r.trend_label}"
            )
        return output
    except Exception as e:
        return f"Error computing signals: {e}"


@tool
def run_strategy_backtest(
    tickers: list[str],
    strategy_type: str = "moving_average_crossover",
    short_window: int = 20,
    long_window: int = 50,
) -> str:
    """Backtest a trading strategy on historical data and return performance metrics."""
    try:
        from src.backtesting.engine import run_backtest
        from src.backtesting.market_data import MarketDataAdapter
        from src.backtesting.models import BacktestRequest

        end = date.today()
        start = end - timedelta(days=365)
        req = BacktestRequest(
            strategy_name=f"{strategy_type} backtest",
            strategy_type=strategy_type,
            symbols=[t.upper() for t in tickers],
            start_date=start,
            end_date=end,
            initial_capital=10_000,
            parameters={"short_window": short_window, "long_window": long_window},
        )
        adapter = MarketDataAdapter()
        metrics, _, _ = run_backtest(req, adapter)

        return (
            f"Strategy: {strategy_type}\n"
            f"Total Return: {metrics.total_return:.2%}\n"
            f"Sharpe Ratio: {metrics.sharpe_ratio:.2f}\n"
            f"Max Drawdown: {metrics.max_drawdown:.2%}\n"
            f"Win Rate: {metrics.win_rate:.2%}\n"
            f"Total Trades: {metrics.total_trades}"
        )
    except Exception as e:
        return f"Error running backtest: {e}"


class QuantAnalyst(BaseSpecialist):
    name = "quant_analyst"
    display_name = "Quant Analyst"

    @property
    def system_prompt(self) -> str:
        return """You are a senior Quantitative Analyst specializing in technical analysis and strategy validation.

YOUR ROLE in the QuanAd 2.0 consensus system:
- Analyze momentum signals and trend patterns
- Rank stocks by quantitative composite scores
- Backtest trading strategies to validate edge
- Identify technical support/resistance levels and trend direction

YOUR APPROACH:
1. Use signal ranking tools to score momentum, volatility, and trend
2. Run strategy backtests to validate if technical patterns have historical edge
3. Evaluate Sharpe ratios, win rates, and drawdowns
4. Combine technical signals into a directional view

FOCUS ON:
- 20-day and 60-day momentum (trend strength)
- Annualized volatility (risk-adjusted opportunity)
- Strategy backtest results (historical edge validation)
- Trend labels (uptrend / downtrend / neutral)

You are one of 5 specialists. Your opinion will be weighted alongside others.
Be quantitative and precise — cite specific scores and metrics."""

    def get_tools(self) -> Sequence[BaseTool]:
        return [get_stock_info, rank_market_signals, run_strategy_backtest]
