from __future__ import annotations

from dataclasses import dataclass
from math import isfinite
from typing import Callable, Iterable, Mapping

import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.preprocessing import MinMaxScaler

from src.data.fetch import fetch_stock_history
from src.ml.models import LSTMPredictor, RandomForestPredictor, StockPredictor
from src.ml.preprocessing import compute_features


MODEL_RANDOM_FOREST = "random_forest"
MODEL_LSTM = "lstm"
MODEL_SIMPLE_AVERAGE = "simple_average"
MODEL_WEIGHTED_ENSEMBLE = "weighted_ensemble"
BASE_MODELS = (MODEL_RANDOM_FOREST, MODEL_LSTM)

DEFAULT_RISK_NOTES = [
    "Prediction is based on historical data and may not generalize.",
    "High volatility can make short-horizon forecasts unstable.",
    "This is educational analysis, not financial advice.",
]


class PredictionDataError(ValueError):
    """Raised when historical data cannot support the requested prediction."""


@dataclass(frozen=True)
class ModelPrediction:
    predicted_return: float
    predicted_price: float

    def as_dict(self) -> dict[str, float | str]:
        return {
            "predicted_return": self.predicted_return,
            "predicted_price": self.predicted_price,
            "direction": _direction_from_return(self.predicted_return),
        }


@dataclass(frozen=True)
class ValidationMetric:
    mae: float
    rmse: float
    directional_accuracy: float
    mape: float | None = None

    def as_dict(self) -> dict[str, float | None]:
        payload: dict[str, float | None] = {
            "mae": self.mae,
            "rmse": self.rmse,
            "directional_accuracy": self.directional_accuracy,
        }
        if self.mape is not None:
            payload["mape"] = self.mape
        return payload


@dataclass(frozen=True)
class SupervisedData:
    features: pd.DataFrame
    latest_features: pd.DataFrame
    target: pd.Series
    close: pd.Series
    current_price: float


def calculate_simple_average(values: Mapping[str, float] | Iterable[float]) -> float:
    if isinstance(values, Mapping):
        clean_values = [float(value) for value in values.values() if _is_valid_number(value)]
    else:
        clean_values = [float(value) for value in values if _is_valid_number(value)]
    if not clean_values:
        raise PredictionDataError("No model predictions are available for simple average.")
    return float(np.mean(clean_values))


def calculate_model_weights(
    validation_metrics: Mapping[str, Mapping[str, float] | ValidationMetric] | None,
    available_models: Iterable[str] = BASE_MODELS,
) -> dict[str, float | str]:
    available = set(available_models)
    weights: dict[str, float | str] = {
        MODEL_RANDOM_FOREST: 0.0,
        MODEL_LSTM: 0.0,
        "method": "inverse_validation_mae",
    }

    if available == {MODEL_RANDOM_FOREST}:
        weights[MODEL_RANDOM_FOREST] = 1.0
        weights["method"] = "single_model_available"
        return weights
    if available == {MODEL_LSTM}:
        weights[MODEL_LSTM] = 1.0
        weights["method"] = "single_model_available"
        return weights

    rf_mae = _metric_value(validation_metrics, MODEL_RANDOM_FOREST, "mae")
    lstm_mae = _metric_value(validation_metrics, MODEL_LSTM, "mae")
    if not _is_positive_number(rf_mae) or not _is_positive_number(lstm_mae):
        weights[MODEL_RANDOM_FOREST] = 0.5
        weights[MODEL_LSTM] = 0.5
        weights["method"] = "equal_weight_fallback"
        return weights

    epsilon = 1e-12
    rf_score = 1.0 / max(float(rf_mae), epsilon)
    lstm_score = 1.0 / max(float(lstm_mae), epsilon)
    total = rf_score + lstm_score
    weights[MODEL_RANDOM_FOREST] = float(rf_score / total)
    weights[MODEL_LSTM] = float(lstm_score / total)
    return weights


def calculate_weighted_ensemble(predictions: Mapping[str, float], weights: Mapping[str, float | str]) -> float:
    total_weight = 0.0
    weighted_sum = 0.0
    for model_name, prediction in predictions.items():
        if not _is_valid_number(prediction):
            continue
        weight = weights.get(model_name, 0.0)
        if not isinstance(weight, (int, float)) or weight <= 0:
            continue
        weighted_sum += float(prediction) * float(weight)
        total_weight += float(weight)
    if total_weight <= 0:
        return calculate_simple_average(predictions)
    return float(weighted_sum / total_weight)


def calculate_model_agreement(predictions: Mapping[str, float]) -> dict[str, float | str]:
    rf = predictions.get(MODEL_RANDOM_FOREST)
    lstm = predictions.get(MODEL_LSTM)
    if not _is_valid_number(rf) or not _is_valid_number(lstm):
        return {
            "status": "limited_agreement",
            "spread": 0.0,
            "message": "Only one base model produced a usable prediction.",
        }

    spread = abs(float(rf) - float(lstm))
    same_direction = (float(rf) >= 0 and float(lstm) >= 0) or (float(rf) < 0 and float(lstm) < 0)
    if same_direction and spread <= 0.0025:
        status = "strong_agreement"
        message = "RF and LSTM predictions are directionally aligned with a small magnitude spread."
    elif same_direction and spread <= 0.01:
        status = "moderate_agreement"
        message = "RF and LSTM predictions are directionally aligned but differ in magnitude."
    else:
        status = "disagreement"
        message = "RF and LSTM predictions differ materially in direction or magnitude."
    return {"status": status, "spread": float(spread), "message": message}


def assign_prediction_confidence(
    validation_metrics: Mapping[str, Mapping[str, float] | ValidationMetric] | None,
    agreement: Mapping[str, float | str],
    warnings: Iterable[str] | None = None,
) -> str:
    warning_list = list(warnings or [])
    weighted_directional_accuracy = _metric_value(validation_metrics, MODEL_WEIGHTED_ENSEMBLE, "directional_accuracy")
    weighted_mae = _metric_value(validation_metrics, MODEL_WEIGHTED_ENSEMBLE, "mae")
    rf_mae = _metric_value(validation_metrics, MODEL_RANDOM_FOREST, "mae")
    lstm_mae = _metric_value(validation_metrics, MODEL_LSTM, "mae")
    agreement_status = str(agreement.get("status", "limited_agreement"))

    if warning_list or agreement_status in {"disagreement", "limited_agreement"}:
        return "low"
    if not _is_valid_number(weighted_directional_accuracy) or not _is_valid_number(weighted_mae):
        return "low"

    best_base_mae = min(
        [value for value in [rf_mae, lstm_mae] if _is_valid_number(value)],
        default=None,
    )
    near_best = best_base_mae is not None and float(weighted_mae) <= float(best_base_mae) * 1.05
    if float(weighted_directional_accuracy) >= 0.58 and near_best:
        return "high"
    return "medium"


def generate_walk_forward_splits(
    n_rows: int,
    lookback: int,
    min_train_size: int,
    test_size: int,
    max_windows: int = 4,
) -> list[tuple[np.ndarray, np.ndarray]]:
    if n_rows <= lookback + min_train_size:
        return []
    splits: list[tuple[np.ndarray, np.ndarray]] = []
    start = max(min_train_size, lookback + 1)
    while start < n_rows and len(splits) < max_windows:
        stop = min(start + test_size, n_rows)
        if stop <= start:
            break
        train_idx = np.arange(0, start)
        test_idx = np.arange(start, stop)
        splits.append((train_idx, test_idx))
        start = stop
    return splits


class EnsemblePredictionService:
    def __init__(
        self,
        *,
        history_fetcher: Callable[[list[str], str], pd.DataFrame] | None = None,
        rf_factory: Callable[[], StockPredictor] | None = None,
        lstm_factory: Callable[[], StockPredictor] | None = None,
        min_train_size: int = 160,
        validation_window: int = 20,
        max_validation_windows: int = 4,
    ) -> None:
        self.history_fetcher = history_fetcher or (lambda tickers, period: fetch_stock_history(tickers, period=period))
        self.rf_factory = rf_factory or (lambda: RandomForestPredictor(n_estimators=100, max_depth=12))
        self.lstm_factory = lstm_factory or (lambda: LSTMPredictor(epochs=8, hidden_size=64, batch_size=32))
        self.min_train_size = min_train_size
        self.validation_window = validation_window
        self.max_validation_windows = max_validation_windows

    def predict_with_models(
        self,
        ticker: str,
        *,
        horizon_days: int = 1,
        lookback_period: str = "2y",
        target: str = "return",
        include_validation: bool = True,
        include_backtest: bool = True,
        sequence_length: int = 30,
    ) -> dict:
        normalized = ticker.strip().upper()
        if not normalized:
            raise PredictionDataError("Ticker is required.")
        if target != "return":
            raise PredictionDataError("Only target='return' is supported for ensemble predictions.")
        if horizon_days < 1:
            raise PredictionDataError("horizon_days must be at least 1.")
        if sequence_length < 2:
            raise PredictionDataError("sequence_length must be at least 2.")

        raw = self.history_fetcher([normalized], lookback_period)
        supervised = _prepare_supervised_data(raw, horizon_days)
        if len(supervised.features) < max(self.min_train_size, sequence_length + 40):
            raise PredictionDataError(
                f"Insufficient historical data for {normalized}: need at least {max(self.min_train_size, sequence_length + 40)} usable rows."
            )

        validation = self.walk_forward_validate(supervised, sequence_length) if include_validation or include_backtest else {}
        predictions, warnings = self._predict_base_models(supervised, sequence_length)
        if not predictions:
            raise RuntimeError("All prediction models failed.")

        prediction_returns = {model: prediction.predicted_return for model, prediction in predictions.items()}
        simple_return = calculate_simple_average(prediction_returns)
        predictions[MODEL_SIMPLE_AVERAGE] = ModelPrediction(
            predicted_return=simple_return,
            predicted_price=_return_to_price(supervised.current_price, simple_return),
        )

        weights = calculate_model_weights(validation, available_models=prediction_returns.keys())
        weighted_return = calculate_weighted_ensemble(prediction_returns, weights)
        predictions[MODEL_WEIGHTED_ENSEMBLE] = ModelPrediction(
            predicted_return=weighted_return,
            predicted_price=_return_to_price(supervised.current_price, weighted_return),
        )

        agreement = calculate_model_agreement(prediction_returns)
        confidence = assign_prediction_confidence(validation, agreement, warnings)
        current_price = round(float(supervised.current_price), 4)
        final_prediction = predictions[MODEL_WEIGHTED_ENSEMBLE]
        validation_payload = _validation_to_dict(validation)
        summary = _build_prediction_summary(normalized, final_prediction, horizon_days)
        caveat = (
            "This is AI-generated analysis based on historical market data and walk-forward validation. "
            "It is not professional financial advice. Historical model performance does not guarantee future results."
        )

        return {
            "ticker": normalized,
            "summary": summary,
            "current_price": current_price,
            "currentPrice": current_price,
            "horizon_days": horizon_days,
            "target": target,
            "predictions": {name: prediction.as_dict() for name, prediction in predictions.items()},
            "finalPrediction": _prediction_to_public_dict(final_prediction, confidence),
            "modelBreakdown": _model_breakdown_to_public_dict(predictions),
            "weights": weights,
            "validation": validation_payload,
            "agreement": agreement,
            "agreementDisplay": _agreement_to_public_dict(agreement),
            "confidence": confidence,
            "warnings": warnings,
            "risk_notes": DEFAULT_RISK_NOTES,
            "caveat": caveat,
        }

    def walk_forward_validate(self, supervised: SupervisedData, sequence_length: int) -> dict[str, ValidationMetric]:
        splits = generate_walk_forward_splits(
            len(supervised.features),
            lookback=sequence_length,
            min_train_size=self.min_train_size,
            test_size=self.validation_window,
            max_windows=self.max_validation_windows,
        )
        if not splits:
            return {}

        actuals: list[float] = []
        model_predictions: dict[str, list[float]] = {MODEL_RANDOM_FOREST: [], MODEL_LSTM: []}

        for train_idx, test_idx in splits:
            try:
                rf_train_x, rf_train_y, rf_test_x, test_y = _make_supervised_arrays(
                    supervised.features,
                    supervised.target,
                    sequence_length,
                    train_end=int(train_idx[-1]) + 1,
                    test_start=int(test_idx[0]),
                    test_end=int(test_idx[-1]) + 1,
                    flatten=True,
                )
                lstm_train_x, lstm_train_y, lstm_test_x, _ = _make_supervised_arrays(
                    supervised.features,
                    supervised.target,
                    sequence_length,
                    train_end=int(train_idx[-1]) + 1,
                    test_start=int(test_idx[0]),
                    test_end=int(test_idx[-1]) + 1,
                    flatten=False,
                )
                if len(test_y) == 0:
                    continue
                rf_model = self.rf_factory()
                rf_model.train(rf_train_x, rf_train_y)
                lstm_model = self.lstm_factory()
                lstm_model.train(lstm_train_x, lstm_train_y)
                rf_pred = rf_model.predict(rf_test_x)
                lstm_pred = lstm_model.predict(lstm_test_x)
                actuals.extend([float(value) for value in test_y])
                model_predictions[MODEL_RANDOM_FOREST].extend([float(value) for value in rf_pred])
                model_predictions[MODEL_LSTM].extend([float(value) for value in lstm_pred])
            except Exception:
                continue

        if not actuals:
            return {}

        validation: dict[str, ValidationMetric] = {
            model_name: _calculate_validation_metric(actuals, predictions)
            for model_name, predictions in model_predictions.items()
            if predictions
        }

        if set(BASE_MODELS).issubset(validation):
            simple = [
                calculate_simple_average({MODEL_RANDOM_FOREST: rf, MODEL_LSTM: lstm})
                for rf, lstm in zip(model_predictions[MODEL_RANDOM_FOREST], model_predictions[MODEL_LSTM])
            ]
            weights = calculate_model_weights(validation)
            weighted = [
                calculate_weighted_ensemble({MODEL_RANDOM_FOREST: rf, MODEL_LSTM: lstm}, weights)
                for rf, lstm in zip(model_predictions[MODEL_RANDOM_FOREST], model_predictions[MODEL_LSTM])
            ]
            validation[MODEL_SIMPLE_AVERAGE] = _calculate_validation_metric(actuals, simple)
            validation[MODEL_WEIGHTED_ENSEMBLE] = _calculate_validation_metric(actuals, weighted)

        return validation

    def _predict_base_models(self, supervised: SupervisedData, sequence_length: int) -> tuple[dict[str, ModelPrediction], list[str]]:
        predictions: dict[str, ModelPrediction] = {}
        warnings: list[str] = []
        model_specs = {
            MODEL_RANDOM_FOREST: (self.rf_factory, True),
            MODEL_LSTM: (self.lstm_factory, False),
        }
        for model_name, (factory, flatten) in model_specs.items():
            try:
                train_x, train_y, latest_x = _make_latest_arrays(
                    supervised.features,
                    supervised.latest_features,
                    supervised.target,
                    sequence_length,
                    flatten=flatten,
                )
                model = factory()
                model.train(train_x, train_y)
                predicted_return = float(model.predict(latest_x)[0])
                predictions[model_name] = ModelPrediction(
                    predicted_return=predicted_return,
                    predicted_price=_return_to_price(supervised.current_price, predicted_return),
                )
            except Exception as exc:
                warnings.append(f"{model_name} prediction failed: {exc}")
        return predictions, warnings


def _prepare_supervised_data(raw: pd.DataFrame, horizon_days: int) -> SupervisedData:
    if raw.empty or "Close" not in raw.columns:
        raise PredictionDataError("No historical OHLCV data was returned.")
    raw = raw.dropna(subset=["Close"]).copy()
    if raw.empty:
        raise PredictionDataError("Historical data contains no close prices.")
    features = compute_features(raw)
    close = raw["Close"].reindex(features.index).astype(float)
    target = (close.shift(-horizon_days) / close) - 1.0
    frame = features.copy()
    frame["target_return"] = target
    frame = frame.replace([np.inf, -np.inf], np.nan).dropna()
    if frame.empty:
        raise PredictionDataError("Feature engineering produced no usable rows.")
    supervised_features = frame.drop(columns=["target_return"])
    latest_features = features.replace([np.inf, -np.inf], np.nan).dropna()
    supervised_target = frame["target_return"].astype(float)
    supervised_close = close.reindex(supervised_features.index).astype(float)
    current_price = float(raw["Close"].dropna().iloc[-1])
    return SupervisedData(
        features=supervised_features,
        latest_features=latest_features,
        target=supervised_target,
        close=supervised_close,
        current_price=current_price,
    )


def _make_supervised_arrays(
    features: pd.DataFrame,
    target: pd.Series,
    sequence_length: int,
    *,
    train_end: int,
    test_start: int,
    test_end: int,
    flatten: bool,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    scaler = MinMaxScaler()
    train_features = features.iloc[:train_end].values
    all_features = features.iloc[:test_end].values
    scaler.fit(train_features)
    scaled = scaler.transform(all_features)
    target_values = target.iloc[:test_end].values.astype(float)

    train_indices = range(sequence_length - 1, train_end)
    test_indices = range(max(test_start, sequence_length - 1), test_end)
    x_train, y_train = _windows_for_indices(scaled, target_values, train_indices, sequence_length, flatten)
    x_test, y_test = _windows_for_indices(scaled, target_values, test_indices, sequence_length, flatten)
    if len(x_train) == 0 or len(x_test) == 0:
        raise PredictionDataError("Walk-forward split produced no train/test samples.")
    return x_train, y_train, x_test, y_test


def _make_latest_arrays(
    features: pd.DataFrame,
    latest_features: pd.DataFrame,
    target: pd.Series,
    sequence_length: int,
    *,
    flatten: bool,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    scaler = MinMaxScaler()
    scaled = scaler.fit_transform(features.values)
    scaled_latest = scaler.transform(latest_features.values)
    target_values = target.values.astype(float)
    train_indices = range(sequence_length - 1, len(target_values))
    x_train, y_train = _windows_for_indices(scaled, target_values, train_indices, sequence_length, flatten)
    if len(x_train) == 0:
        raise PredictionDataError("No training samples are available.")
    if len(scaled_latest) < sequence_length:
        raise PredictionDataError("No latest feature window is available.")
    latest_window = scaled_latest[-sequence_length:]
    if flatten:
        latest_x = latest_window.flatten().reshape(1, -1)
    else:
        latest_x = latest_window.reshape(1, sequence_length, scaled.shape[1])
    return x_train, y_train, latest_x


def _windows_for_indices(
    scaled_features: np.ndarray,
    target_values: np.ndarray,
    indices: Iterable[int],
    sequence_length: int,
    flatten: bool,
) -> tuple[np.ndarray, np.ndarray]:
    x_rows: list[np.ndarray] = []
    y_rows: list[float] = []
    for index in indices:
        start = index - sequence_length + 1
        if start < 0:
            continue
        window = scaled_features[start : index + 1]
        if len(window) != sequence_length:
            continue
        x_rows.append(window.flatten() if flatten else window)
        y_rows.append(float(target_values[index]))
    return np.asarray(x_rows), np.asarray(y_rows)


def _calculate_validation_metric(actuals: Iterable[float], predictions: Iterable[float]) -> ValidationMetric:
    y_true = np.asarray(list(actuals), dtype=float)
    y_pred = np.asarray(list(predictions), dtype=float)
    if len(y_true) != len(y_pred) or len(y_true) == 0:
        raise PredictionDataError("Validation predictions and actuals must be non-empty and aligned.")
    mae = float(mean_absolute_error(y_true, y_pred))
    rmse = float(np.sqrt(mean_squared_error(y_true, y_pred)))
    actual_direction = np.sign(y_true)
    predicted_direction = np.sign(y_pred)
    directional_accuracy = float(np.mean(actual_direction == predicted_direction))
    non_zero = np.abs(y_true) > 1e-12
    mape = float(np.mean(np.abs((y_true[non_zero] - y_pred[non_zero]) / y_true[non_zero]))) if np.any(non_zero) else None
    return ValidationMetric(mae=mae, rmse=rmse, directional_accuracy=directional_accuracy, mape=mape)


def _validation_to_dict(validation: Mapping[str, ValidationMetric]) -> dict[str, dict[str, float | None]]:
    return {model_name: metric.as_dict() for model_name, metric in validation.items()}


def _prediction_to_public_dict(prediction: ModelPrediction, confidence: str | None = None) -> dict[str, float | str]:
    payload: dict[str, float | str] = {
        "direction": _direction_from_return(prediction.predicted_return),
        "predictedPrice": prediction.predicted_price,
        "predictedReturn": prediction.predicted_return,
    }
    if confidence is not None:
        payload["confidence"] = confidence
    return payload


def _model_breakdown_to_public_dict(predictions: Mapping[str, ModelPrediction]) -> dict[str, dict[str, float | str]]:
    key_map = {
        MODEL_RANDOM_FOREST: "randomForest",
        MODEL_LSTM: "lstm",
        MODEL_SIMPLE_AVERAGE: "simpleAverage",
        MODEL_WEIGHTED_ENSEMBLE: "weightedEnsemble",
    }
    return {
        public_key: _prediction_to_public_dict(predictions[model_key])
        for model_key, public_key in key_map.items()
        if model_key in predictions
    }


def _agreement_to_public_dict(agreement: Mapping[str, float | str]) -> dict[str, float | str]:
    status = str(agreement.get("status", "limited_agreement"))
    public_status = {
        "strong_agreement": "strong",
        "moderate_agreement": "moderate",
        "limited_agreement": "weak",
        "disagreement": "disagreement",
    }.get(status, "weak")
    return {
        "status": public_status,
        "spread": float(agreement.get("spread", 0.0) or 0.0),
        "explanation": str(agreement.get("message", "")),
    }


def _build_prediction_summary(ticker: str, prediction: ModelPrediction, horizon_days: int) -> str:
    direction = _direction_label(prediction.predicted_return)
    period = "next trading period" if horizon_days == 1 else f"next {horizon_days} trading periods"
    article = "an" if direction.startswith("UP") else "a"
    return f"The ensemble model predicts {article} {direction} direction for {ticker} over the {period}."


def _direction_from_return(predicted_return: float) -> str:
    if not _is_valid_number(predicted_return) or abs(float(predicted_return)) < 0.0005:
        return "NEUTRAL"
    return "UP" if float(predicted_return) > 0 else "DOWN"


def _direction_label(predicted_return: float) -> str:
    direction = _direction_from_return(predicted_return)
    if direction == "UP":
        return "UP ↑"
    if direction == "DOWN":
        return "DOWN ↓"
    return "NEUTRAL →"


def _return_to_price(current_price: float, predicted_return: float) -> float:
    return round(float(current_price) * (1.0 + float(predicted_return)), 4)


def _metric_value(
    validation_metrics: Mapping[str, Mapping[str, float] | ValidationMetric] | None,
    model_name: str,
    metric_name: str,
) -> float | None:
    if not validation_metrics or model_name not in validation_metrics:
        return None
    metric = validation_metrics[model_name]
    if isinstance(metric, ValidationMetric):
        return getattr(metric, metric_name, None)
    value = metric.get(metric_name)
    return float(value) if _is_valid_number(value) else None


def _is_valid_number(value: object) -> bool:
    return isinstance(value, (int, float, np.integer, np.floating)) and isfinite(float(value))


def _is_positive_number(value: object) -> bool:
    return _is_valid_number(value) and float(value) > 0
