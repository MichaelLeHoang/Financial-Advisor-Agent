from uuid import uuid4

import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from src.auth.supabase import get_current_or_guest_user
from src.saas.models import AuthenticatedUser, Plan


def _history(rows: int = 260) -> pd.DataFrame:
    index = pd.bdate_range("2024-01-01", periods=rows)
    trend = np.linspace(100, 130, rows)
    seasonal = np.sin(np.linspace(0, 12, rows)) * 2
    close = trend + seasonal
    return pd.DataFrame(
        {
            "Open": close - 0.3,
            "High": close + 0.8,
            "Low": close - 0.8,
            "Close": close,
            "Volume": np.full(rows, 1_000_000),
        },
        index=index,
    )


class ConstantPredictor:
    def __init__(self, offset: float = 0.0) -> None:
        self.offset = offset
        self.value = 0.0

    def train(self, X_train, y_train):
        self.value = float(np.mean(y_train)) + self.offset
        return {"train_mae": 0.0, "train_rmse": 0.0}

    def predict(self, X):
        return np.full(len(X), self.value)

    def save(self, path: str) -> None:
        return None

    def load(self, path: str) -> None:
        return None


class FailingPredictor(ConstantPredictor):
    def train(self, X_train, y_train):
        raise RuntimeError("model failed")


class IdentityScaler:
    n_features_in_ = 1

    def inverse_transform(self, values):
        return np.asarray(values, dtype=float)


class FixedPredictor:
    def train(self, X_train, y_train):
        return {"train_mae": 0.01, "train_rmse": 0.02}

    def predict(self, X):
        return np.full(len(X), 110.0)


def test_simple_average_calculation_is_correct():
    from src.ml.ensemble import calculate_simple_average

    assert calculate_simple_average({"random_forest": 0.012, "lstm": 0.018}) == pytest.approx(0.015)


def test_inverse_error_model_weights_are_correct():
    from src.ml.ensemble import calculate_model_weights

    weights = calculate_model_weights({
        "random_forest": {"mae": 0.018},
        "lstm": {"mae": 0.024},
    })

    assert weights["random_forest"] == pytest.approx(0.571428, rel=1e-4)
    assert weights["lstm"] == pytest.approx(0.428571, rel=1e-4)
    assert weights["method"] == "inverse_validation_mae"


def test_weighted_ensemble_calculation_is_correct():
    from src.ml.ensemble import calculate_weighted_ensemble

    result = calculate_weighted_ensemble(
        {"random_forest": 0.01, "lstm": 0.02},
        {"random_forest": 0.75, "lstm": 0.25},
    )

    assert result == pytest.approx(0.0125)


def test_lower_rf_mae_receives_higher_weight():
    from src.ml.ensemble import calculate_model_weights

    weights = calculate_model_weights({
        "random_forest": {"mae": 0.01},
        "lstm": {"mae": 0.03},
    })

    assert weights["random_forest"] > weights["lstm"]


def test_missing_validation_metrics_default_to_equal_weights():
    from src.ml.ensemble import calculate_model_weights

    weights = calculate_model_weights(None)

    assert weights["random_forest"] == pytest.approx(0.5)
    assert weights["lstm"] == pytest.approx(0.5)
    assert weights["method"] == "equal_weight_fallback"


@pytest.mark.parametrize(
    ("rf", "lstm", "status"),
    [
        (0.010, 0.011, "strong_agreement"),
        (0.010, 0.016, "moderate_agreement"),
        (0.010, -0.004, "disagreement"),
    ],
)
def test_agreement_detection(rf, lstm, status):
    from src.ml.ensemble import calculate_model_agreement

    agreement = calculate_model_agreement({"random_forest": rf, "lstm": lstm})

    assert agreement["status"] == status


def test_walk_forward_split_helper_has_no_future_leakage():
    from src.ml.ensemble import generate_walk_forward_splits

    splits = generate_walk_forward_splits(n_rows=120, lookback=10, min_train_size=40, test_size=15, max_windows=3)

    assert splits
    for train_idx, test_idx in splits:
        assert train_idx.max() < test_idx.min()


def test_service_returns_partial_results_when_one_model_fails():
    from src.ml.ensemble import EnsemblePredictionService

    service = EnsemblePredictionService(
        history_fetcher=lambda tickers, period: _history(),
        rf_factory=lambda: ConstantPredictor(0.001),
        lstm_factory=lambda: FailingPredictor(),
        fundamentals_fetcher=lambda ticker: {"forward_eps": 8, "fair_pe_multiple": 20},
        min_train_size=60,
        validation_window=10,
        max_validation_windows=2,
    )

    result = service.predict_with_models("AAPL", sequence_length=5)

    assert "random_forest" in result["predictions"]
    assert "lstm" not in result["predictions"]
    assert "simple_average" in result["predictions"]
    assert "weighted_ensemble" in result["predictions"]
    assert result["finalPrediction"]["direction"] in {"UP", "DOWN", "NEUTRAL"}
    assert "randomForest" in result["modelBreakdown"]
    assert result["agreementDisplay"]["status"] in {"strong", "moderate", "weak", "disagreement"}
    assert result["caveat"]
    assert result["warnings"]
    assert result["weights"]["random_forest"] == pytest.approx(1.0)
    assert result["valuation_status"] == "available"
    assert result["valuation_target"] == pytest.approx(160)
    assert result["valuation_signal"] == "Undervalued"
    assert result["final_signal"] in {"Strong Bullish", "Neutral"}


def test_service_keeps_prediction_available_when_fundamentals_fetch_fails():
    from src.ml.ensemble import EnsemblePredictionService

    def failing_fundamentals_fetcher(ticker):
        raise TimeoutError(f"fundamentals unavailable for {ticker}")

    service = EnsemblePredictionService(
        history_fetcher=lambda tickers, period: _history(),
        rf_factory=lambda: ConstantPredictor(0.001),
        lstm_factory=lambda: FailingPredictor(),
        fundamentals_fetcher=failing_fundamentals_fetcher,
        min_train_size=60,
        validation_window=10,
        max_validation_windows=2,
    )

    result = service.predict_with_models("AAPL", sequence_length=5)

    assert result["predictions"]["weighted_ensemble"]
    assert result["valuation_status"] == "unavailable"
    assert result["valuation_target"] is None
    assert result["implied_upside"] is None
    assert result["valuation_signal"] is None
    assert result["final_signal"] == "Neutral"


def test_predict_endpoint_returns_ensemble_response(monkeypatch):
    from src.api import app as api_app

    class FakeService:
        def predict_with_models(self, *args, **kwargs):
            return {
                "ticker": "AAPL",
                "summary": "The ensemble model predicts an UP ↑ direction for AAPL over the next trading period.",
                "current_price": 123.45,
                "currentPrice": 123.45,
                "ml_prediction": "UP",
                "valuation_status": "available",
                "valuation_target": 148.14,
                "target_price": 148.14,
                "implied_upside": 0.2,
                "valuation_signal": "Undervalued",
                "final_signal": "Strong Bullish",
                "mae": 0.017,
                "rmse": 0.025,
                "horizon_days": 1,
                "target": "return",
                "predictions": {
                    "random_forest": {"predicted_return": 0.012, "predicted_price": 124.93, "direction": "UP"},
                    "lstm": {"predicted_return": 0.018, "predicted_price": 125.67, "direction": "UP"},
                    "simple_average": {"predicted_return": 0.015, "predicted_price": 125.3, "direction": "UP"},
                    "weighted_ensemble": {"predicted_return": 0.014, "predicted_price": 125.18, "direction": "UP"},
                },
                "finalPrediction": {
                    "direction": "UP",
                    "predictedPrice": 125.18,
                    "predictedReturn": 0.014,
                    "confidence": "medium",
                },
                "modelBreakdown": {
                    "randomForest": {"direction": "UP", "predictedPrice": 124.93, "predictedReturn": 0.012},
                    "lstm": {"direction": "UP", "predictedPrice": 125.67, "predictedReturn": 0.018},
                    "simpleAverage": {"direction": "UP", "predictedPrice": 125.3, "predictedReturn": 0.015},
                    "weightedEnsemble": {"direction": "UP", "predictedPrice": 125.18, "predictedReturn": 0.014},
                },
                "weights": {"random_forest": 0.62, "lstm": 0.38, "method": "inverse_validation_mae"},
                "validation": {
                    "random_forest": {"mae": 0.018, "rmse": 0.026, "directional_accuracy": 0.56},
                    "lstm": {"mae": 0.024, "rmse": 0.031, "directional_accuracy": 0.53},
                    "simple_average": {"mae": 0.02, "rmse": 0.027, "directional_accuracy": 0.55},
                    "weighted_ensemble": {"mae": 0.017, "rmse": 0.025, "directional_accuracy": 0.58},
                },
                "agreement": {"status": "moderate_agreement", "spread": 0.006, "message": "aligned"},
                "agreementDisplay": {"status": "moderate", "spread": 0.006, "explanation": "aligned"},
                "confidence": "medium",
                "warnings": [],
                "risk_notes": ["This is educational analysis, not financial advice."],
                "caveat": "This is AI-generated analysis based on historical market data and walk-forward validation. It is not professional financial advice.",
            }

    async def user():
        return AuthenticatedUser(id=uuid4(), email="trader@example.com", plan=Plan.TRADER, is_guest=False)

    monkeypatch.setattr(api_app, "EnsemblePredictionService", lambda: FakeService())
    api_app.app.dependency_overrides[get_current_or_guest_user] = user

    response = TestClient(api_app.app).post("/api/v1/predict", json={"ticker": "AAPL", "model": "ensemble"})

    api_app.app.dependency_overrides.clear()

    assert response.status_code == 200
    payload = response.json()
    assert set(["random_forest", "lstm", "simple_average", "weighted_ensemble"]).issubset(payload["predictions"])
    assert payload["validation"]["weighted_ensemble"]["directional_accuracy"] == 0.58
    assert payload["finalPrediction"]["direction"] == "UP"
    assert payload["modelBreakdown"]["weightedEnsemble"]["predictedReturn"] == 0.014
    assert payload["agreementDisplay"]["status"] == "moderate"
    assert payload["confidence"] == "medium"
    assert payload["current_price"] == 123.45
    assert payload["ml_prediction"] == "UP"
    assert payload["valuation_target"] == 148.14
    assert payload["implied_upside"] == 0.2
    assert payload["valuation_signal"] == "Undervalued"
    assert payload["final_signal"] == "Strong Bullish"
    assert payload["mae"] == 0.017
    assert payload["rmse"] == 0.025
    assert payload["risk_notes"]
    assert "not professional financial advice" in payload["caveat"]


def test_predict_endpoint_returns_single_model_contract_with_unavailable_valuation(monkeypatch):
    from src.api import app as api_app

    async def user():
        return AuthenticatedUser(id=uuid4(), email="trader@example.com", plan=Plan.TRADER, is_guest=False)

    monkeypatch.setattr(
        api_app,
        "prepare_training_data",
        lambda *args, **kwargs: {
            "X_train": np.array([[90.0], [95.0], [100.0]]),
            "y_train": np.array([90.0, 95.0, 100.0]),
            "X_test": np.array([[100.0]]),
            "y_test": np.array([100.0]),
            "scaler": IdentityScaler(),
        },
    )
    monkeypatch.setattr(api_app, "RandomForestPredictor", lambda **kwargs: FixedPredictor())
    monkeypatch.setattr(
        api_app,
        "evaluate_model",
        lambda *args, **kwargs: {
            "test_mae": 0.1,
            "test_rmse": 0.2,
            "test_mae_dollars": 10.0,
            "test_rmse_dollars": 20.0,
        },
    )
    api_app.app.dependency_overrides[get_current_or_guest_user] = user

    try:
        response = TestClient(api_app.app).post(
            "/api/v1/predict",
            json={"ticker": " aapl ", "model": "random_forest"},
        )
    finally:
        api_app.app.dependency_overrides.clear()

    assert response.status_code == 200
    payload = response.json()
    assert payload["ticker"] == "AAPL"
    assert payload["model_type"] == "random_forest"
    assert payload["current_price"] == 100.0
    assert payload["ml_prediction"] == "UP"
    assert payload["valuation_status"] == "unavailable"
    assert payload["valuation_target"] is None
    assert payload["implied_upside"] is None
    assert payload["valuation_signal"] is None
    assert payload["final_signal"] == "Neutral"
    assert payload["confidence"] == "low"
    assert payload["mae"] == 0.1
    assert payload["rmse"] == 0.2
