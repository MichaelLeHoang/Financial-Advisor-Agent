from __future__ import annotations

import json
from math import sqrt

import numpy as np
import pandas as pd

from src.backtesting.engine import run_backtest
from src.backtesting.market_data import MarketDataAdapter
from src.backtesting.models import BacktestRequest
from src.quant.models import (
    AdvancedValidationRequest,
    SignalRank,
    SignalRankingRequest,
    StrategyComparisonRequest,
    StrategyComparisonResponse,
    StrategyComparisonRow,
    StrategyExportRequest,
    StrategyExportResponse,
)


def compare_strategies(req: StrategyComparisonRequest, adapter: MarketDataAdapter) -> StrategyComparisonResponse:
    rows: list[StrategyComparisonRow] = []
    for strategy in req.strategies:
        metrics, _, _ = run_backtest(
            BacktestRequest(
                strategy_name=strategy.name,
                strategy_type=strategy.strategy_type,
                symbols=req.symbols,
                start_date=req.start_date,
                end_date=req.end_date,
                initial_capital=req.initial_capital,
                fees_bps=req.fees_bps,
                slippage_bps=req.slippage_bps,
                position_size=req.position_size,
                parameters=strategy.parameters,
            ),
            adapter,
        )
        rows.append(StrategyComparisonRow(name=strategy.name, strategy_type=strategy.strategy_type, metrics=metrics))

    best = max(rows, key=lambda row: row.metrics.sharpe_ratio).name if rows else None
    return StrategyComparisonResponse(results=rows, best_strategy=best)


def validate_strategy(req: AdvancedValidationRequest, adapter: MarketDataAdapter) -> tuple[dict, list[dict]]:
    metrics, equity_curve, _ = run_backtest(
        BacktestRequest(
            strategy_name=req.strategy_name,
            strategy_type=req.strategy_type,
            symbols=req.symbols,
            start_date=req.start_date,
            end_date=req.end_date,
            initial_capital=req.initial_capital,
            fees_bps=req.fees_bps,
            slippage_bps=req.slippage_bps,
            position_size=req.position_size,
            parameters=req.parameters,
        ),
        adapter,
    )
    equity = pd.Series([point.value for point in equity_curve], index=pd.to_datetime([point.date for point in equity_curve]))
    returns = equity.pct_change().replace([np.inf, -np.inf], np.nan).dropna()
    results = {
        "base_metrics": metrics,
        "walk_forward": _walk_forward(equity, req.walk_forward_windows),
        "monte_carlo": _monte_carlo(returns, float(equity.iloc[0]), req.monte_carlo_paths),
        "bootstrap": _bootstrap_confidence(returns, req.bootstrap_samples),
    }
    return results, [point.model_dump(mode="json") for point in equity_curve]


def rank_signals(req: SignalRankingRequest, adapter: MarketDataAdapter) -> list[SignalRank]:
    prices = adapter.fetch_prices(req.symbols, req.start_date, req.end_date)
    ranks: list[SignalRank] = []
    for symbol, series in prices.items():
        close = series.astype(float).dropna()
        if len(close) < 21:
            continue
        returns = close.pct_change().dropna()
        momentum_20 = float(close.iloc[-1] / close.iloc[max(0, len(close) - 21)] - 1)
        momentum_60 = float(close.iloc[-1] / close.iloc[max(0, len(close) - 61)] - 1)
        volatility_20 = float(returns.tail(20).std(ddof=0) * sqrt(252)) if len(returns) >= 2 else 0.0
        score = momentum_60 * 0.55 + momentum_20 * 0.35 - volatility_20 * 0.10
        trend = "uptrend" if score > 0.04 else "downtrend" if score < -0.04 else "neutral"
        ranks.append(
            SignalRank(
                symbol=symbol.upper(),
                score=round(score, 6),
                momentum_20d=round(momentum_20, 6),
                momentum_60d=round(momentum_60, 6),
                volatility_20d=round(volatility_20, 6),
                trend_label=trend,
            )
        )
    return sorted(ranks, key=lambda item: item.score, reverse=True)


def export_strategy(req: StrategyExportRequest) -> StrategyExportResponse:
    if req.language == "json":
        content = json.dumps(
            {
                "strategy_name": req.strategy_name,
                "strategy_type": req.strategy_type,
                "symbols": [symbol.upper() for symbol in req.symbols],
                "parameters": req.parameters,
                "disclaimer": "Research configuration only. Not trading advice.",
            },
            indent=2,
        )
    elif req.language == "python":
        content = _python_export(req)
    else:
        content = _pine_export(req)
    return StrategyExportResponse(language=req.language, content=content)


def _walk_forward(equity: pd.Series, windows: int) -> list[dict]:
    split_count = min(windows, len(equity))
    index_chunks = np.array_split(np.arange(len(equity)), split_count)
    result = []
    for index, positions in enumerate(index_chunks, start=1):
        chunk = equity.iloc[positions]
        if len(chunk) < 2:
            continue
        window_return = float(chunk.iloc[-1] / chunk.iloc[0] - 1)
        drawdown = chunk / chunk.cummax() - 1
        result.append(
            {
                "window": index,
                "start": chunk.index[0].date().isoformat(),
                "end": chunk.index[-1].date().isoformat(),
                "return": round(window_return, 6),
                "max_drawdown": round(float(drawdown.min()), 6),
            }
        )
    return result


def _monte_carlo(returns: pd.Series, initial_value: float, paths: int) -> dict:
    if returns.empty:
        return {"paths": paths, "p05": 0, "p50": 0, "p95": 0, "loss_probability": 0}
    rng = np.random.default_rng(42)
    sampled = rng.choice(returns.to_numpy(), size=(paths, len(returns)), replace=True)
    terminal = initial_value * np.prod(1 + sampled, axis=1)
    total_returns = terminal / initial_value - 1
    return {
        "paths": paths,
        "p05": round(float(np.percentile(total_returns, 5)), 6),
        "p50": round(float(np.percentile(total_returns, 50)), 6),
        "p95": round(float(np.percentile(total_returns, 95)), 6),
        "loss_probability": round(float(np.mean(total_returns < 0)), 6),
    }


def _bootstrap_confidence(returns: pd.Series, samples: int) -> dict:
    if returns.empty:
        return {"samples": samples, "mean_return": 0, "ci_5": 0, "ci_95": 0}
    rng = np.random.default_rng(7)
    boot = []
    values = returns.to_numpy()
    for _ in range(samples):
        sampled = rng.choice(values, size=len(values), replace=True)
        boot.append(float(np.prod(1 + sampled) - 1))
    return {
        "samples": samples,
        "mean_return": round(float(np.mean(boot)), 6),
        "ci_5": round(float(np.percentile(boot, 5)), 6),
        "ci_95": round(float(np.percentile(boot, 95)), 6),
    }


def _python_export(req: StrategyExportRequest) -> str:
    return f'''"""Research-only strategy skeleton. Historical behavior does not guarantee future results."""

def generate_signals(prices):
    strategy_type = "{req.strategy_type}"
    parameters = {json.dumps(req.parameters, indent=4)}
    if strategy_type == "moving_average_crossover":
        short_window = int(parameters.get("short_window", 20))
        long_window = int(parameters.get("long_window", 50))
        return (prices.rolling(short_window).mean() > prices.rolling(long_window).mean()).astype(int)
    if strategy_type == "rsi_mean_reversion":
        return prices.pct_change().rolling(int(parameters.get("rsi_window", 14))).mean().lt(0).astype(int)
    return prices.notna().astype(int)
'''


def _pine_export(req: StrategyExportRequest) -> str:
    short_window = int(req.parameters.get("short_window", 20))
    long_window = int(req.parameters.get("long_window", 50))
    return f"""//@version=5
strategy("{req.strategy_name}", overlay=true)
shortMa = ta.sma(close, {short_window})
longMa = ta.sma(close, {long_window})
longCondition = shortMa > longMa
if longCondition
    strategy.entry("Research Long", strategy.long)
if not longCondition
    strategy.close("Research Long")
"""
