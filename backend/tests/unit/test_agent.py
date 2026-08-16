import pytest
import numpy as np
import pandas as pd
from types import SimpleNamespace
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

        snapshot = SimpleNamespace(
            latest_price=153.0,
            history=[],
            company_name="Apple Inc.",
            daily_change=2.0,
            volume=1_000_000,
            day_high=155.0,
            day_low=150.0,
            data_sources=["finnhub_quote"],
            source_quality={"limitations": []},
        )
        with patch("src.agent.tools.market_data_service.fetch_snapshot", return_value=snapshot) as mock_fetch:
            result = get_stock_info.invoke({"ticker": "AAPL"})

        mock_fetch.assert_called_once_with("AAPL", period="5d", interval="1d", include_news=False, include_sec=False)
        assert "AAPL" in result
        assert "$" in result
        assert "Daily Change" in result

    def test_returns_error_string_on_empty_data(self):
        from src.agent.tools import get_stock_info

        snapshot = SimpleNamespace(latest_price=None, history=[])
        with patch("src.agent.tools.market_data_service.fetch_snapshot", return_value=snapshot):
            result = get_stock_info.invoke({"ticker": "FAKE"})

        assert "No data found" in result

    def test_returns_error_string_on_exception(self):
        from src.agent.tools import get_stock_info

        with patch("src.agent.tools.market_data_service.fetch_snapshot", side_effect=RuntimeError("network down")):
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

def test_single_agent_prompt_prefers_ensemble_prediction():
    from src.agent.agent import SYSTEM_PROMPT

    assert 'predict_stock_price with model="ensemble"' in SYSTEM_PROMPT
    assert "Do not say a company is private from memory" in SYSTEM_PROMPT


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

    def test_returns_ensemble_prediction_string_by_default(self):
        from src.agent.tools import predict_stock_price

        class FakeService:
            def predict_with_models(self, *args, **kwargs):
                return {
                    "ticker": "NVDA",
                    "summary": "The ensemble model predicts an UP ↑ direction for NVDA over the next trading period.",
                    "current_price": 100.0,
                    "predictions": {
                        "random_forest": {"predicted_return": 0.01, "predicted_price": 101.0, "direction": "UP"},
                        "lstm": {"predicted_return": 0.02, "predicted_price": 102.0, "direction": "UP"},
                        "simple_average": {"predicted_return": 0.015, "predicted_price": 101.5, "direction": "UP"},
                        "weighted_ensemble": {"predicted_return": 0.014, "predicted_price": 101.4, "direction": "UP"},
                    },
                    "weights": {"random_forest": 0.6, "lstm": 0.4, "method": "inverse_validation_mae"},
                    "validation": {
                        "random_forest": {"mae": 0.02, "rmse": 0.03, "directional_accuracy": 0.55},
                        "lstm": {"mae": 0.03, "rmse": 0.04, "directional_accuracy": 0.52},
                        "simple_average": {"mae": 0.021, "rmse": 0.031, "directional_accuracy": 0.56},
                        "weighted_ensemble": {"mae": 0.018, "rmse": 0.028, "directional_accuracy": 0.58},
                    },
                    "agreement": {"status": "moderate_agreement", "message": "aligned"},
                    "agreementDisplay": {"status": "moderate", "spread": 0.01, "explanation": "aligned"},
                    "confidence": "medium",
                    "ml_prediction": "UP",
                    "valuation_status": "available",
                    "valuation_target": 120.0,
                    "implied_upside": 0.2,
                    "valuation_signal": "Undervalued",
                    "final_signal": "Strong Bullish",
                    "warnings": [],
                    "risk_notes": ["This is educational analysis, not financial advice."],
                    "caveat": "This is AI-generated analysis based on historical market data and walk-forward validation. It is not professional financial advice.",
                }

        with (
            patch("src.agent.tools.fetch_stock_history", return_value=_make_price_df([100 + i for i in range(50)])),
            patch("src.agent.tools.EnsemblePredictionService", return_value=FakeService()),
        ):
            result = predict_stock_price.invoke({"ticker": "NVDA"})

        assert "NVDA" in result
        assert "ensemble model predicts" in result
        assert "Weighted Ensemble" in result
        assert "Validation summary" in result
        assert "Model agreement" in result
        assert "Confidence: Medium" in result
        assert "ML Direction: UP" in result
        assert "Valuation Target: $120.00" in result
        assert "Implied Upside/Downside: +20.00%" in result
        assert "Valuation Signal: Undervalued" in result
        assert "Final Signal: Strong Bullish" in result
        assert "not professional financial advice" in result.lower()

    def test_returns_explicit_unavailable_valuation_when_fundamentals_are_missing(self):
        from src.agent.tools import _format_ensemble_prediction_for_agent

        result = _format_ensemble_prediction_for_agent(
            {
                "ticker": "NVDA",
                "current_price": 100.0,
                "ml_prediction": "NEUTRAL",
                "valuation_status": "unavailable",
                "valuation_target": None,
                "implied_upside": None,
                "valuation_signal": None,
                "final_signal": "Neutral",
                "predictions": {
                    "weighted_ensemble": {
                        "predicted_return": 0.0,
                        "predicted_price": 100.0,
                        "direction": "NEUTRAL",
                    },
                },
                "confidence": "low",
            }
        )

        assert "Valuation Target: Unavailable" in result
        assert "Final Signal: Neutral" in result
        assert "None" not in result

    def test_resolves_spacex_alias_before_prediction(self):
        from src.agent.tools import predict_stock_price

        calls = []

        class FakeService:
            def predict_with_models(self, ticker, *args, **kwargs):
                calls.append(ticker)
                return {
                    "ticker": ticker,
                    "summary": f"The ensemble model generated a prediction for {ticker}.",
                    "current_price": 100.0,
                    "predictions": {
                        "weighted_ensemble": {"predicted_return": 0.014, "predicted_price": 101.4, "direction": "UP"},
                    },
                    "weights": {},
                    "validation": {},
                    "agreement": {},
                    "confidence": "medium",
                    "ml_prediction": "UP",
                    "final_signal": "Bullish",
                    "warnings": [],
                    "caveat": "This is AI-generated analysis, not professional financial advice.",
                }

        with (
            patch("src.agent.tools.fetch_stock_history", return_value=_make_price_df([100 + i for i in range(50)])),
            patch("src.agent.tools.EnsemblePredictionService", return_value=FakeService()),
        ):
            result = predict_stock_price.invoke({"ticker": "spacex"})

        assert calls == ["SPCX"]
        assert "SPCX" in result

    def test_returns_random_forest_prediction_string_when_requested(self):
        from src.agent.tools import predict_stock_price

        mock_data = self._make_training_data()
        mock_metrics = {"test_mae_dollars": 2.5, "test_rmse_dollars": 3.1}

        with (
            patch("src.agent.tools.fetch_stock_history", return_value=_make_price_df([100 + i for i in range(50)])),
            patch("src.agent.tools.prepare_training_data", return_value=mock_data),
            patch("src.agent.tools.evaluate_model", return_value=mock_metrics),
        ):
            result = predict_stock_price.invoke({"ticker": "NVDA", "model": "random_forest"})

        assert "NVDA" in result
        assert "Random Forest" in result
        assert "Predicted Direction" in result

    def test_returns_error_on_exception(self):
        from src.agent.tools import predict_stock_price

        with patch("src.agent.tools.fetch_stock_history", side_effect=ValueError("no data")):
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
        assert "Trailing Annualized Arithmetic Return (not a forecast)" in result
        assert "Return/Volatility Ratio (0% benchmark)" in result

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
