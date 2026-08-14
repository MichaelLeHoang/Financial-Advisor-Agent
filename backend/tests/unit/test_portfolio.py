import pytest
import numpy as np
import pandas as pd


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_returns_and_cov(n: int = 4, seed: int = 42) -> tuple[pd.Series, pd.DataFrame]:
    """Generate a synthetic mean_returns vector and covariance matrix."""
    rng = np.random.default_rng(seed)
    tickers = [f"STOCK_{i}" for i in range(n)]
    mean_returns = pd.Series(rng.uniform(0.05, 0.30, n), index=tickers)

    # Build a valid positive-semidefinite covariance matrix
    A = rng.normal(0, 0.1, (n, n))
    cov_matrix = pd.DataFrame(A @ A.T + np.eye(n) * 0.01, index=tickers, columns=tickers)

    return mean_returns, cov_matrix


# ---------------------------------------------------------------------------
# Classical Markowitz optimizer
# ---------------------------------------------------------------------------

class TestClassicalOptimize:
    """Tests for classical_optimize() in portfolio.py."""

    def test_weights_sum_to_one(self):
        from src.quantum.portfolio import classical_optimize

        mean_returns, cov_matrix = _make_returns_and_cov(4)
        result = classical_optimize(mean_returns, cov_matrix, risk_tolerance=1.0)

        total_weight = sum(result["weights"].values())
        assert abs(total_weight - 1.0) < 0.01  # allow tiny rounding error

    def test_all_weights_non_negative(self):
        """No short selling — all weights should be >= 0."""
        from src.quantum.portfolio import classical_optimize

        mean_returns, cov_matrix = _make_returns_and_cov(4)
        result = classical_optimize(mean_returns, cov_matrix)

        for ticker, w in result["weights"].items():
            assert w >= 0, f"Negative weight found for {ticker}: {w}"

    def test_returns_expected_keys(self):
        from src.quantum.portfolio import classical_optimize

        mean_returns, cov_matrix = _make_returns_and_cov(3)
        result = classical_optimize(mean_returns, cov_matrix)

        assert "method" in result
        assert "weights" in result
        assert "expected_annual_return" in result
        assert "annual_volatility" in result
        assert "sharpe_ratio" in result

    def test_method_label_is_correct(self):
        from src.quantum.portfolio import classical_optimize

        mean_returns, cov_matrix = _make_returns_and_cov(3)
        result = classical_optimize(mean_returns, cov_matrix)

        assert result["method"] == "classical_markowitz"

    def test_higher_risk_tolerance_shifts_weights(self):
        """Higher risk_tolerance should favor higher-return (but riskier) assets."""
        from src.quantum.portfolio import classical_optimize

        mean_returns, cov_matrix = _make_returns_and_cov(4, seed=7)

        result_low = classical_optimize(mean_returns, cov_matrix, risk_tolerance=0.1)
        result_high = classical_optimize(mean_returns, cov_matrix, risk_tolerance=3.0)

        # Higher risk tolerance should yield a higher expected return
        assert result_high["expected_annual_return"] >= result_low["expected_annual_return"]

    def test_single_stock_gets_full_allocation(self):
        """With only one stock, it must receive 100% allocation."""
        from src.quantum.portfolio import classical_optimize

        mean_returns = pd.Series([0.15], index=["AAPL"])
        cov_matrix = pd.DataFrame([[0.04]], index=["AAPL"], columns=["AAPL"])

        result = classical_optimize(mean_returns, cov_matrix)
        total = sum(result["weights"].values())
        assert abs(total - 1.0) < 0.01

    def test_multi_asset_weight_cap_prevents_concentrated_solution(self):
        from src.quantum.portfolio import classical_optimize

        mean_returns = pd.Series([0.80, 0.10], index=["SNDK", "MU"])
        cov_matrix = pd.DataFrame(
            [[0.04, 0.0], [0.0, 0.04]],
            index=mean_returns.index,
            columns=mean_returns.index,
        )

        result = classical_optimize(
            mean_returns,
            cov_matrix,
            risk_tolerance=3.0,
            max_weight=0.60,
        )

        assert max(result["weights"].values()) <= 0.60
        assert result["estimation_basis"].endswith("not a forecast")


class TestPortfolioDataPreparation:
    """Tests for yfinance return-shape normalization before optimization."""

    def test_get_portfolio_volatility_accepts_multi_column_close_frames(self, monkeypatch):
        from src.quantum import portfolio

        dates = pd.date_range("2025-01-01", periods=5, freq="D")

        def fake_fetch_stock_history(tickers, period="1y"):
            ticker = tickers[0]
            return pd.DataFrame(
                {
                    ("Close", ticker): [100, 101, 103, 104, 106],
                    ("Open", ticker): [99, 100, 102, 103, 105],
                },
                index=dates,
            )

        monkeypatch.setattr(portfolio, "fetch_stock_history", fake_fetch_stock_history)

        result = portfolio.get_portfolio_volatility(["AAPL", "GOOGL"])

        assert result["tickers"] == ["AAPL", "GOOGL"]
        assert list(result["returns"].columns) == ["AAPL", "GOOGL"]
        assert list(result["mean_returns"].index) == ["AAPL", "GOOGL"]
        assert list(result["cov_matrix"].columns) == ["AAPL", "GOOGL"]
        assert result["observations"] == 4
        assert result["start_date"] == "2025-01-02"


# ---------------------------------------------------------------------------
# QUBO matrix builder
# ---------------------------------------------------------------------------

class TestBuildQUBOMatrix:
    """Tests for build_qubo_matrix() in qaoa.py."""

    def test_output_is_square_matrix(self):
        from src.quantum.qaoa import build_qubo_matrix

        mean_returns, cov_matrix = _make_returns_and_cov(4)
        Q = build_qubo_matrix(mean_returns, cov_matrix, risk_penalty=0.5, target_assets=2)

        assert Q.shape == (4, 4)

    def test_matrix_is_not_all_zeros(self):
        from src.quantum.qaoa import build_qubo_matrix

        mean_returns, cov_matrix = _make_returns_and_cov(4)
        Q = build_qubo_matrix(mean_returns, cov_matrix)

        assert np.any(Q != 0)

    def test_diagonal_has_return_and_budget_penalty(self):
        """Diagonal entries encode both return reward and budget penalty."""
        from src.quantum.qaoa import build_qubo_matrix

        mean_returns, cov_matrix = _make_returns_and_cov(3)
        Q1 = build_qubo_matrix(mean_returns, cov_matrix, budget_penalty=1.0, target_assets=2)
        Q2 = build_qubo_matrix(mean_returns, cov_matrix, budget_penalty=2.0, target_assets=2)

        # Higher budget_penalty → more negative diagonal (stronger constraint)
        assert Q2[0, 0] < Q1[0, 0]

    def test_scales_with_n_stocks(self):
        """Matrix size should match the number of stocks."""
        from src.quantum.qaoa import build_qubo_matrix

        for n in [2, 5, 8]:
            mean_returns, cov_matrix = _make_returns_and_cov(n)
            Q = build_qubo_matrix(mean_returns, cov_matrix)
            assert Q.shape == (n, n)
