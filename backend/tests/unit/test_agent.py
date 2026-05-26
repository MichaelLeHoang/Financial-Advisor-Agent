import pytest
import numpy as np
import pandas as pd
from unittest.mock import patch, MagicMock


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_price_df(close: list[float] = None) -> pd.DataFrame:
    """Build a minimal OHLCV DataFrame for two rows."""
    close = close or [150.0, 153.0]
    return pd.DataFrame(
        {
            "Open": [c - 1 for c in close],
            "High": [c + 2 for c in close],
            "Low": [c - 2 for c in close],
            "Close": close,
            "Volume": [1_000_000] * len(close),
        }
    )


# ---------------------------------------------------------------------------
# get_stock_info
# ---------------------------------------------------------------------------

class TestGetStockInfoTool:
    """Tests for the get_stock_info agent tool."""

    def test_returns_formatted_string_on_success(self):
        from src.agent.tools import get_stock_info

        with patch("src.agent.tools.fetch_stock_history", return_value=_make_price_df()) as mock_fetch:
            result = get_stock_info.invoke({"ticker": "AAPL"})

        mock_fetch.assert_called_once_with(["AAPL"], period="5d")
        assert "AAPL" in result
        assert "$" in result
        assert "Daily Change" in result

    def test_returns_error_string_on_empty_data(self):
        from src.agent.tools import get_stock_info

        with patch("src.agent.tools.fetch_stock_history", return_value=pd.DataFrame()):
            result = get_stock_info.invoke({"ticker": "FAKE"})

        assert "No data found" in result

    def test_returns_error_string_on_exception(self):
        from src.agent.tools import get_stock_info

        with patch("src.agent.tools.fetch_stock_history", side_effect=RuntimeError("network down")):
            result = get_stock_info.invoke({"ticker": "AAPL"})

        assert "Error" in result


# ---------------------------------------------------------------------------
# analyze_sentiment
# ---------------------------------------------------------------------------

class TestAnalyzeSentimentTool:
    """Tests for the analyze_sentiment agent tool."""

    def _mock_analyzer(self):
        analyzer = MagicMock()
        analyzer.get_market_mood.return_value = {
            "mood": "positive",
            "signal": "BULLISH",
            "bullish_score": 0.42,
            "breakdown": {"positive": 2, "negative": 0, "neutral": 1},
        }
        analyzer.analyze_batch.return_value = [
            {"label": "positive", "score": 0.95},
            {"label": "positive", "score": 0.88},
            {"label": "neutral", "score": 0.72},
        ]
        return analyzer

    def test_returns_formatted_mood_output(self):
        from src.agent.tools import analyze_sentiment

        with patch("src.agent.tools.SentimentAnalyzer", return_value=self._mock_analyzer()):
            result = analyze_sentiment.invoke({"texts": ["AAPL soars", "Market rally", "Flat day"]})

        assert "POSITIVE" in result
        assert "BULLISH" in result
        assert "Bullish Score" in result

    def test_returns_error_string_on_exception(self):
        from src.agent.tools import analyze_sentiment

        with patch("src.agent.tools.SentimentAnalyzer", side_effect=RuntimeError("model failed")):
            result = analyze_sentiment.invoke({"texts": ["anything"]})

        assert "Error" in result


# ---------------------------------------------------------------------------
# predict_stock_price
# ---------------------------------------------------------------------------

class TestPredictStockPriceTool:
    """Tests for the predict_stock_price agent tool."""

    def _make_training_data(self, n: int = 50, features: int = 10) -> dict:
        X = np.random.rand(n, features)
        y = np.random.rand(n)
        split = int(n * 0.8)
        return {
            "X_train": X[:split],
            "y_train": y[:split],
            "X_test": X[split:],
            "y_test": y[split:],
            "scaler": MagicMock(
                n_features_in_=features,
                inverse_transform=lambda x: x,
            ),
        }

    def test_returns_prediction_string(self):
        from src.agent.tools import predict_stock_price

        mock_data = self._make_training_data()
        mock_metrics = {"test_mae_dollars": 2.5, "test_rmse_dollars": 3.1}

        with (
            patch("src.agent.tools.prepare_training_data", return_value=mock_data),
            patch("src.agent.tools.evaluate_model", return_value=mock_metrics),
        ):
            result = predict_stock_price.invoke({"ticker": "NVDA"})

        assert "NVDA" in result
        assert "Random Forest" in result
        assert "Predicted Direction" in result

    def test_returns_error_on_exception(self):
        from src.agent.tools import predict_stock_price

        with patch("src.agent.tools.prepare_training_data", side_effect=ValueError("no data")):
            result = predict_stock_price.invoke({"ticker": "XYZ"})

        assert "Error" in result


# ---------------------------------------------------------------------------
# optimize_portfolio_tool
# ---------------------------------------------------------------------------

class TestOptimizePortfolioTool:
    """Tests for the optimize_portfolio_tool agent tool."""

    def _classical_result(self) -> dict:
        return {
            "method": "classical_markowitz",
            "expected_annual_return": 0.18,
            "annual_volatility": 0.22,
            "sharpe_ratio": 0.82,
            "weights": {"AAPL": 0.4, "NVDA": 0.35, "GOOGL": 0.25},
        }

    def _quantum_result(self) -> dict:
        return {
            "method": "qaoa",
            "selected_stocks": ["AAPL", "NVDA"],
            "best_probability": 0.31,
        }

    def test_classical_method_returns_allocation(self):
        from src.agent.tools import optimize_portfolio_tool

        with patch("src.agent.tools.optimize_portfolio", return_value=self._classical_result()):
            result = optimize_portfolio_tool.invoke(
                {"tickers": ["AAPL", "NVDA", "GOOGL"], "method": "classical", "risk_tolerance": 1.0}
            )

        assert "Classical Markowitz" in result
        assert "Expected Return" in result
        assert "Sharpe Ratio" in result

    def test_quantum_method_returns_selected_stocks(self):
        from src.agent.tools import optimize_portfolio_tool

        with patch("src.agent.tools.quantum_optimize_portfolio", return_value=self._quantum_result()):
            result = optimize_portfolio_tool.invoke(
                {"tickers": ["AAPL", "NVDA", "GOOGL"], "method": "quantum", "risk_tolerance": 0.5}
            )

        assert "Quantum QAOA" in result
        assert "AAPL" in result

    def test_returns_error_on_exception(self):
        from src.agent.tools import optimize_portfolio_tool

        with patch("src.agent.tools.optimize_portfolio", side_effect=RuntimeError("no data")):
            result = optimize_portfolio_tool.invoke(
                {"tickers": ["AAPL"], "method": "classical", "risk_tolerance": 1.0}
            )

        assert "Error" in result
