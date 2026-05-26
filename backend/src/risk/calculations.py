from __future__ import annotations

from math import sqrt

import pandas as pd

from src.saas.models import HoldingRead, PortfolioRead


def calculate_portfolio_risk(
    portfolio: PortfolioRead,
    holdings: list[HoldingRead],
    price_history: dict[str, pd.Series],
) -> dict:
    if not holdings:
        raise ValueError("Add holdings before generating a risk snapshot.")

    rows = []
    for holding in holdings:
        symbol = holding.symbol.upper()
        prices = price_history.get(symbol)
        latest_price = float(prices.dropna().iloc[-1]) if prices is not None and not prices.dropna().empty else holding.average_cost
        market_value = latest_price * holding.quantity
        rows.append(
            {
                "symbol": symbol,
                "asset_type": holding.asset_type,
                "quantity": holding.quantity,
                "latest_price": latest_price,
                "market_value": market_value,
            }
        )

    total_value = sum(row["market_value"] for row in rows)
    if total_value <= 0:
        raise ValueError("Portfolio market value must be greater than zero.")

    by_asset = {
        row["symbol"]: {
            "market_value": round(row["market_value"], 2),
            "weight": round(row["market_value"] / total_value, 6),
            "asset_type": row["asset_type"],
        }
        for row in rows
    }
    by_asset_class: dict[str, float] = {}
    for row in rows:
        by_asset_class[row["asset_type"]] = by_asset_class.get(row["asset_type"], 0) + row["market_value"]
    by_asset_class = {key: round(value / total_value, 6) for key, value in by_asset_class.items()}

    returns = _aligned_returns(price_history)
    weights = {symbol: payload["weight"] for symbol, payload in by_asset.items()}
    volatility = 0.0
    max_drawdown = 0.0
    correlation_matrix: dict[str, dict[str, float | None]] = {}
    if not returns.empty:
        available = [symbol for symbol in returns.columns if symbol in weights]
        if available:
            portfolio_returns = sum(returns[symbol] * weights[symbol] for symbol in available)
            volatility = float(portfolio_returns.std(ddof=0) * sqrt(252)) if len(portfolio_returns) > 1 else 0.0
            cumulative = (1 + portfolio_returns).cumprod()
            drawdown = cumulative / cumulative.cummax() - 1
            max_drawdown = abs(float(drawdown.min())) if not drawdown.empty else 0.0
            corr = returns[available].corr().round(4)
            correlation_matrix = {
                row_symbol: {
                    col_symbol: (None if pd.isna(value) else float(value))
                    for col_symbol, value in corr.loc[row_symbol].items()
                }
                for row_symbol in corr.index
            }

    concentration = max(payload["weight"] for payload in by_asset.values())
    risk_score = min(100, round(concentration * 45 + volatility * 100 + max_drawdown * 65, 1))
    metrics = {
        "portfolio_name": portfolio.name,
        "base_currency": portfolio.base_currency,
        "total_value": round(total_value, 2),
        "concentration_risk": round(concentration, 6),
        "annualized_volatility": round(volatility, 6),
        "max_drawdown_estimate": round(max_drawdown, 6),
        "risk_score": risk_score,
        "holdings_count": len(holdings),
    }

    return {
        "metrics": metrics,
        "allocations": {"by_asset": by_asset, "by_asset_class": by_asset_class},
        "correlation_matrix": correlation_matrix,
        "ai_explanation": _risk_explanation(metrics),
    }


def _aligned_returns(price_history: dict[str, pd.Series]) -> pd.DataFrame:
    series = {
        symbol.upper(): prices.dropna().astype(float).pct_change().dropna()
        for symbol, prices in price_history.items()
        if prices is not None and len(prices.dropna()) > 1
    }
    if not series:
        return pd.DataFrame()
    return pd.DataFrame(series).dropna(how="all").fillna(0)


def _risk_explanation(metrics: dict) -> str:
    concentration = metrics["concentration_risk"]
    volatility = metrics["annualized_volatility"]
    if concentration >= 0.5:
        focus = "single-position concentration is the main risk driver"
    elif volatility >= 0.25:
        focus = "price volatility is the main risk driver"
    else:
        focus = "risk appears spread across the current holdings"
    return (
        f"This snapshot is for research only. The portfolio risk score is {metrics['risk_score']}/100; "
        f"{focus} based on current holdings and historical price movement."
    )
