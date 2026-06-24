# Machine Learning Module

## Purpose
Provides price prediction, model ensembling, financial sentiment, feature preprocessing, and valuation calculations.

## Responsibilities
- Engineer market features and training datasets.
- Train and evaluate Random Forest and LSTM predictors.
- Produce weighted ensemble forecasts with validation and agreement metadata.
- Run FinBERT sentiment analysis.
- Calculate valuation outputs from deterministic financial inputs.

## Key Files
- `ensemble.py`: prediction orchestration, weighting, validation, and response data.
- `models.py`: predictor implementations and metrics.
- `preprocessing.py`: feature engineering.
- `sentiment.py`: FinBERT adapter.
- `valuation.py`: valuation calculations and unavailable-data fallback.

## Boundaries
Historical data should come through existing data helpers. Agent formatting belongs in `agent/tools.py`; HTTP response models belong in `api/` or `models/`.

## Testing
Mock data and model providers. Cover leakage prevention, partial model failures, weighting, agreement, insufficient history, valuation edge cases, and stable output contracts.

## Latest Change
- Expanded valuation regression coverage for invalid numeric inputs, provider failures, unavailable-data fallbacks, and normalized combined signals; fixed whitespace handling in signal inputs.
