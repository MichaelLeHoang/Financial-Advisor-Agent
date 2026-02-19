import numpy as np 
import pandas as pd
from scipy.optimize import minimize
from src.data.fetch import fetch_stock_history

def get_portfolio_volatility(tickers: list[str], period: str = "1y"):
    """
    Fetch and compute portfolio statistics for a set of tickers.
    Returns:
        - returns: Daily returns DataFrame
        - mean_returns: Annualized mean return per stock
        - cov_matrix: Annualized covariance matrix
    """

    prices = pd.DataFrame()
    for ticker in tickers:
        data = fetch_stock_history([ticker], period=period)
        if not data.empty: 
            prices[ticker] = data["Close"]

    if prices.empty: 
        raise ValueError("No price data retrieved")

    # daily returns 
    returns = prices.pct_change().dropna()

    # Annualized (252 trading days)
    mean_returns = returns.mean() * 252
    cov_matrix = returns.cov() * 252
    
    return {
        "returns": returns, 
        "mean_returns": mean_returns,
        "cov_matrix": cov_matrix, 
        "tickers": list(prices.columns),
    }

def classical_optimize(
    mean_returns: pd.Series,
    cov_matrix: pd.DataFrame,
    risk_tolerance: float = 1.0,
) -> dict:
    """
    Classical Mean-Variance Optimization (Markowitz).

    MATH:
    Minimize: w^T Σ w - risk_tolerance * w^T μ
    Subject to: Σ w_i = 1, w_i >= 0

    Where:
    - w = weight vector (what % to allocate to each stock)
    - Σ = covariance matrix (how stocks move together)
    - μ = expected returns vector
    - risk_tolerance = how much risk vs return to favor
    """
    n = len(mean_returns)

    def objective(w):
        portfolio_return = np.dot(w, mean_returns)
        portfolio_risk = np.sqrt(np.dot(w.T, np.dot(cov_matrix.values, w)))
        return portfolio_risk - risk_tolerance * portfolio_return

    # constraints: weights sum to 1
    constraints = {"type": "eq", "fun": lambda w: np.sum(w) - 1}

    # bounds: each weight between 0 and 1 (no short selling)
    bounds = tuple( (0,1) for _ in range(n) )

    # initial guess: equal weights / allocation
    initial_weights = np.array( [1 / n] * n)

    result = minimize (
    objective,
    initial_weights,
    method="SLSQP",
    bounds=bounds,
    constraints=constraints,
    )

    weights = result.x
    portfolio_return = float(np.dot(weights, mean_returns))
    portfolio_risk = float(np.sqrt(np.dot(weights.T, np.dot(cov_matrix.values, weights))))
    sharpe_ratio = portfolio_return / portfolio_risk if portfolio_risk > 0 else 0

    return {
        "method": "classical_markowitz",
        "weights": {
            ticker: round(float(w), 4)
            for ticker, w in zip(mean_returns.index, weights)

            if w > 0.001 # only show meaningful allocations
        },
        "expected_annual_return": round(portfolio_return, 4),
        "annual_volatility": round(portfolio_risk, 4),
        "sharpe_ratio": round(sharpe_ratio, 4),
    }


def optimize_portfolio(
    tickers: list[str],
    risk_tolerance: float = 1.0,
) -> dict:
    """
    High-level entry point: fetch data and optimize.

    Usage:
        result = optimize_portfolio(["AAPL", "NVDA", "GOOGL"], risk_tolerance=1.0)
        print(result["weights"])
    """
    data = get_portfolio_volatility(tickers)

    result = classical_optimize(
        data["mean_returns"],
        data["cov_matrix"],
        risk_tolerance=risk_tolerance,
    )

    result["tickers"] = data["tickers"]
    return result