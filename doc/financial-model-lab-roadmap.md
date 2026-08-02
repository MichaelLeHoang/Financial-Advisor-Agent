# Financial Model Lab Roadmap

## Purpose

This document defines a reproducible research workspace for evaluating and extending the Financial Advisor Platform's Random Forest and LSTM forecasting models. It translates the research plan, *Reproducible Experiment Lab for Evaluating and Extending LSTM and Random Forest Crypto Forecasting Models*, into an implementation sequence that fits the existing product architecture.

The immediate goal is not to produce a production model. The first goal is to create a workplace where researchers can inspect data quality, datasets, experiment runs, forecasts, residuals, model comparisons, economic performance, and reproducibility metadata. The ultimate goal is to promote a validated model into the Financial Advisor Platform through a controlled model-registry and shadow-deployment process.

This is a planning document. It does not authorize live trading or the use of experimental forecasts as financial advice.

## Repository Architecture

Keep the product and research lab as separate repositories under one parent directory:

```text
Financial Advisor Platform/
├── financial-advisor-platform/
│   ├── frontend/
│   ├── backend/
│   └── supabase/
│
└── financial-model-lab/
    ├── data/
    ├── experiments/
    ├── models/
    ├── evaluation/
    ├── dashboards/
    └── artifacts/
```

The operating boundary should be:

```text
Exchange or provider data
        ↓
Financial Model Lab
ingestion → validation → features → experiments → model registry
        ↓
Versioned model bundle
        ↓
Financial Advisor Platform
inference → shadow monitoring → user-facing predictions
```

The Financial Advisor Platform must not import research notebooks or train models during a user request. The lab produces validated and immutable model bundles; the platform performs inference using promoted bundles.

## Existing Platform Capabilities to Reuse

The current platform provides useful starting points, but research implementations must correct their known limitations rather than copying them unchanged.

| Current component | Reuse in the lab | Required correction |
|---|---|---|
| `backend/src/data/fetch.py` | Provider-adapter shape and OHLCV conventions | Treat `yfinance` as a validation source rather than the canonical minute-level crypto source. |
| `backend/src/data/market_data_service.py` | Normalized timestamps, provider status, and evidence patterns | Add immutable raw response storage and reproducible dataset generation. |
| `backend/src/ml/preprocessing.py` | Initial feature definitions and window creation | Remove full-dataset scaler fitting; fit preprocessing inside each training fold. |
| `backend/src/ml/ensemble.py` | Walk-forward structure, fold-local scaling, ensemble contracts, and directional metrics | Add embargo gaps, nested tuning, statistical tests, saved predictions, and full lineage. |
| `backend/src/ml/models.py` | Initial Random Forest and PyTorch LSTM architectures | Add deterministic seeds, validation curves, early stopping, checkpoints, and inference signatures. |
| `backend/src/backtesting/engine.py` | Fee, slippage, trade, and equity-curve concepts | Add forecast-native execution, crypto annualization, execution delay, and cost sensitivity. |

Important existing limitations:

- `prepare_training_data` fits a scaler before splitting the dataset, creating information leakage.
- The current prediction service trains models during a request; production should instead load a promoted artifact or call an inference service.
- The current backtesting annualization and trading assumptions are equity-oriented rather than continuous crypto-market assumptions.
- The existing walk-forward validation is a useful foundation but is not nested and does not apply an embargo gap.
- Existing training metrics and artifacts are not yet connected to dataset hashes, experiment lineage, or a model registry.

## Stage 1: Define the First Experiment

Write a one-page experiment charter before creating the lab implementation.

Recommended first experiment:

- Asset: BTC spot.
- Canonical venue: one exchange selected after confirming API access and data rights.
- Source frequency: 1-minute candles.
- Initial modeling frequency: 15-minute bars deterministically resampled from the 1-minute source.
- Initial target: 1-hour forward log return.
- Models: naive baselines, Random Forest, and PyTorch LSTM.
- Evaluation: chronological walk-forward evaluation only.
- Example transaction-cost scenarios: 2, 5, and 10 basis points per side.
- Research question: determine whether either model generalizes out of sample after conservative execution costs.

Start with one symbol, one target, and one horizon. Validate the laboratory before creating a large model catalog.

### Completion gate

- The target, horizon, venue, instrument, timeframe, costs, and evaluation policy are written and versioned.
- The experiment makes no profitability or production-readiness claim.

## Stage 2: Establish the Repository Boundary

Create `financial-model-lab` as a separate Git repository.

Do not:

- import `financial-advisor-platform/backend/src` through relative paths;
- store experiments inside the product backend;
- use the product's Supabase database as a time-series data lake;
- commit datasets, checkpoints, or MLflow artifacts directly to Git;
- make the product depend on notebooks or experiment-runner code.

Share behavior through versioned schemas and model bundles. If a common package becomes necessary later, publish it as a small versioned dependency instead of relying on cross-repository filesystem imports.

### Recommended environment policy

- Use PyTorch for the primary LSTM because the product already uses PyTorch.
- Select a Python version supported by all required ML and GPU dependencies, then pin it.
- Maintain a human-readable environment specification and a deterministic lockfile.
- Package reproducible runs in a Docker image whose base image is pinned by digest.
- Record the environment-lock hash and container digest with every experiment.

### Completion gate

- A clean machine can create the environment and run a smoke test.
- Product and lab repositories remain independently installable.

## Stage 3: Define the `MarketBar v1` Contract

Define the canonical market-bar schema before ingestion:

- `venue`
- `instrument`
- `base_asset`
- `quote_asset`
- `bar_interval`
- `open_time`
- `close_time`
- `open`
- `high`
- `low`
- `close`
- `volume`
- `trade_count`, when available
- `source_timestamp`
- `retrieved_at`
- `provider_revision`
- `is_missing`
- `is_imputed`

Contract rules:

- Store all timestamps in UTC.
- Permit one row per venue, instrument, interval, and open time.
- Define and enforce a compound uniqueness key.
- Document the numeric precision policy.
- Do not silently remove duplicates or fill missing values.
- Never forward-fill a target.
- Preserve missing-bar and imputation information.

This schema becomes the compatibility agreement between the lab and the platform.

### Completion gate

- Schema validation accepts known valid fixtures and rejects duplicates, invalid timestamps, and impossible OHLC values.
- The schema has an explicit version and migration policy.

## Stage 4: Build Bronze, Silver, and Gold Data Layers

### Bronze: immutable provider data

- Preserve exact provider responses.
- Record request parameters, retrieval time, response checksum, and provider status.
- Make bronze files append-only.
- Partition by venue, symbol, and retrieval date.
- Keep a manifest that maps each request to its stored response.

### Silver: canonical market bars

- Normalize bronze data into `MarketBar v1`.
- Deduplicate deterministically.
- Validate OHLC relationships and timestamps.
- Resample onto an evenly spaced UTC index.
- Preserve missingness and imputation flags.
- Write partitioned Parquet.

### Gold: experiment-ready datasets

- Add targets, features, and split membership.
- Produce tabular rows for tree models.
- Produce deterministic sequence-window indices for sequence models.
- Store feature definitions and dataset manifests with the data.

Do not materialize every possible LSTM tensor initially. Store the canonical feature table and deterministic window indices unless profiling shows that materialized tensors are necessary.

### Completion gate

- A gold dataset can be regenerated from bronze data and configuration without manual edits.
- Repeated generation from the same inputs produces the same dataset identity.

## Stage 5: Add Data-Quality Gates

Every dataset build should fail when:

- timestamps are duplicated or unordered;
- bars fall outside the requested range;
- `low` is greater than `high`;
- open or close falls outside the high-low range;
- prices are non-positive;
- missing intervals exceed an agreed threshold;
- an immutable partition changes unexpectedly;
- timestamps are not UTC;
- a target or future observation appears in a feature.

Produce a data-health report containing:

- expected versus received bars;
- missing and imputed bars;
- duplicate count;
- zero-volume periods;
- price discontinuities;
- provider coverage;
- source and dataset checksums;
- dataset ID.

This report becomes the first section of the research dashboard.

### Completion gate

- Invalid datasets cannot reach feature generation.
- Every accepted dataset has a machine-readable and human-readable health report.

## Stage 6: Create Reproducible Dataset Identity

Derive every gold dataset ID from:

```text
raw checksums
+ cleaning configuration
+ feature-set version
+ target definition
+ split definition
+ code revision
```

Track at minimum:

- `dataset_id`
- Git SHA
- DVC revision
- source manifest
- date range
- symbol universe
- timeframe
- feature-set ID
- target ID
- split ID

Use DVC for dataset lineage. A local DVC remote is acceptable during the first vertical slice; move to S3-compatible storage once the workflow stabilizes.

### Completion gate

- Every experiment points to an immutable dataset identity.
- Dataset lineage can be resolved without inspecting a researcher's local machine.

## Stage 7: Create a Feature Registry

Organize features into explicit, versioned packs:

- `core_v1`: OHLCV returns, ranges, volatility, volume changes, and calendar signals.
- `technical_v1`: RSI, moving averages, ATR, MACD, and related indicators.
- `tree_v1`: wider lag expansions and selected interactions.
- `sequence_v1`: minimally transformed sequential features.

Each feature definition must specify:

- name;
- formula;
- required source columns;
- lookback;
- output type;
- missing-value policy;
- timestamp semantics;
- version.

The first RF and LSTM comparison should use the same `core_v1` information. Otherwise, model-family effects and feature-set effects become confounded.

### Completion gate

- Every gold feature column maps to a versioned feature definition.
- Maximum effective lookback can be calculated from the selected feature pack.

## Stage 8: Define Targets and Leakage-Safe Splits

Prioritize forward returns over raw price prediction:

```text
target(t) = log(close[t + horizon] / close[t])
```

Build split membership before fitting scalers or imputers.

For every outer fold:

1. Define the historical training region.
2. Add an embargo gap at least as large as the maximum feature lookback plus forecast horizon.
3. Define the untouched outer test region.
4. Create chronological inner validation splits inside the training region.
5. Fit preprocessing only on the relevant training data.
6. Transform validation and test data using the frozen training state.

Persist every observation's fold assignment so the dashboard can display the exact training, validation, embargo, and test boundaries.

### Completion gate

- Automated checks prove that no training window uses a test or future timestamp.
- Scalers, imputers, feature selection, and tuning run inside the fold boundary.

## Stage 9: Establish Naive Baselines

Implement and track these baselines before RF or LSTM tuning:

- zero-return forecast;
- last-value or random-walk forecast;
- rolling-mean return;
- seasonal same-time-of-day forecast;
- simple linear model.

A candidate is not useful merely because its loss is low. It must beat appropriate naive forecasts consistently across untouched folds.

### Completion gate

- All model comparison tables include the same naive baselines.
- Candidate status requires improvement over the declared benchmark, not merely a positive backtest.

## Stage 10: Reproduce RF and LSTM Baselines

Use PyTorch for the primary LSTM to align with the existing product implementation. Do not add TensorFlow solely because the source research plan uses Keras.

### Random Forest

- Use the shared core and tree feature packs.
- Tune only inside inner walk-forward folds.
- Record permutation importance.
- Add SHAP after the baseline pipeline is stable.

### LSTM

- Use `core_v1` sequences.
- Preserve chronological validation.
- Add early stopping and checkpoints.
- Record training and validation curves.
- Run multiple seeds.
- Persist the scaler, model configuration, and checkpoint as one bundle.

### Training order

1. Untuned RF.
2. Untuned LSTM.
3. Tuned RF.
4. Tuned LSTM.
5. Simple ensemble.
6. Weighted ensemble based only on validation results.

### Completion gate

- Each model produces aligned out-of-sample predictions for every outer fold.
- Every prediction is associated with a timestamp, fold, model version, and dataset ID.

## Stage 11: Track Experiments with MLflow and TensorBoard

Every MLflow run should record:

- model family and configuration;
- dataset, feature, target, and split IDs;
- Git SHA and environment-lock hash;
- symbol, venue, and timeframe;
- forecast horizon;
- random seed;
- fold ID;
- training duration and hardware;
- preprocessing configuration;
- cost and execution assumptions;
- test predictions;
- metrics and confidence intervals;
- model and preprocessing artifacts.

Use TensorBoard for LSTM training diagnostics. MLflow remains the authoritative system for cross-model comparison and artifact lineage.

### Completion gate

- A researcher can move from any displayed result to its dataset, configuration, code revision, predictions, and artifact bundle.

## Stage 12: Build the Research Workplace

Build the first workplace as a Streamlit lab cockpit. Link to MLflow and TensorBoard rather than recreating their specialized interfaces in the product frontend.

The dashboard should read completed artifacts. It should not launch expensive training jobs initially.

### 1. Data Health

- Coverage, gaps, duplicates, and resampling.
- Provider and partition lineage.
- Dataset health status and checksum.

### 2. Dataset Explorer

- OHLCV series.
- Feature and target distributions.
- Missingness and imputation.
- Training, validation, embargo, and test regions.

### 3. Experiment Runs

- Searchable MLflow runs.
- Filters for model, symbol, timeframe, horizon, feature pack, and tag.
- Reproducibility status.

### 4. Forecast Diagnostics

- Actual versus predicted values.
- Rolling MAE and RMSE.
- Residual timeline and distribution.
- Error by volatility or market regime.

### 5. Model Explainability

- Permutation importance.
- SHAP for tree models.
- Importance stability across folds.
- Warnings for highly correlated features.

### 6. Economic Evaluation

- Cumulative net return.
- Drawdown.
- Turnover and trade count.
- Cost sensitivity.
- Exposure and performance by regime.

### 7. Reproducibility

- Code revision.
- Dataset manifest.
- Environment and container identity.
- Exact configuration and rerun command.
- Artifact checksums.

### 8. Promotion Readiness

- Experimental, candidate, shadow, paper-evaluated, or production-ready status.
- Failed and passed promotion gates.
- Model-card and limitation links.

### Completion gate

- A researcher can understand data health, compare models, inspect one run, and reproduce its lineage without opening a notebook.

## Stage 13: Produce the Evaluation Packet

Every model, symbol, and horizon combination should report the following.

### Forecast accuracy

- MAE
- RMSE
- MAPE only for positive price-level targets
- correlation
- sign or directional accuracy

### Statistical validity

- block-bootstrap confidence intervals;
- Pesaran-Timmermann directional test;
- Diebold-Mariano comparison with a small-sample correction;
- Ljung-Box residual test;
- multiple-comparison correction when many variants are tested.

### Economic validity

- return after fees and slippage;
- crypto-appropriate annualized Sharpe-like ratio;
- maximum drawdown;
- turnover;
- trade count;
- exposure;
- performance under several cost assumptions.

Execute a signal no earlier than the bar after its prediction becomes available. This prevents the backtest from using information that would not have been available at execution time.

### Completion gate

- Comparison tables separate point accuracy, directionality, economic results, and statistical significance.
- No single undefined "accuracy" number determines the winning model.

## Stage 14: Expand the Model Families Carefully

Do not begin transformer or foundation-model work until:

- the same dataset can be reproduced twice from scratch;
- naive, RF, and LSTM results are visible in the dashboard;
- all test predictions are persisted by timestamp;
- the evaluation packet runs automatically;
- another machine can reproduce one complete benchmark.

Recommended extension order:

1. XGBoost.
2. 1D CNN or TCN.
3. PatchTST.
4. Zero-shot foundation models.
5. Fine-tuned foundation models.
6. Hybrids only when residual analysis demonstrates complementary errors.

### Completion gate

- Each added model uses the same data, target, split, cost, and evaluation contracts as the baselines.

## Stage 15: Define the Promotion Contract

A promoted model bundle should contain:

```text
model artifact
preprocessor or scaler
feature schema and version
target and horizon definition
training data range
library versions
input and output signature
benchmark results
model card
risk limitations
artifact checksums
```

Recommended lifecycle:

```text
experiment
   ↓
candidate
   ↓
shadow inference in the platform
   ↓
paper-trading evaluation
   ↓
production candidate
   ↓
production with monitoring and rollback
```

The platform prediction service should eventually become inference-only. It should load a promoted artifact or call a dedicated inference service rather than training RF and LSTM models during each prediction request.

## Production Acceptance Gates

Do not promote a model unless it:

- beats declared naive baselines across multiple untouched folds;
- remains stable across 5–10 seeds where applicable;
- performs consistently across different volatility regimes;
- survives conservative costs and execution delays;
- passes statistical comparison against its benchmark;
- has complete data and experiment lineage;
- can be recreated from a clean environment;
- has a fixed inference signature;
- succeeds in platform shadow mode;
- has drift monitoring and rollback behavior.

A model that minimizes RMSE, a model that predicts direction best, and a model that generates the strongest net-of-cost returns may be different models. Report those outcomes separately.

## First Vertical Slice

The first practical milestone should contain only:

```text
BTC 1-minute raw data
        ↓
validated 15-minute silver bars
        ↓
core_v1 features
        ↓
1-hour forward-return target
        ↓
chronological folds with an embargo
        ↓
naive baselines + RF + PyTorch LSTM
        ↓
MLflow runs and TensorBoard diagnostics
        ↓
Streamlit comparison dashboard
```

After this slice is reproducible, add another horizon and ETH. Do not begin transformer experiments until this milestone passes all data, evaluation, lineage, and rerun gates.

## Minimum Reproducible Deliverables

The first complete lab release should include:

- a top-level README with exact rerun commands;
- a pinned environment specification and lockfile;
- a Dockerfile with a base-image digest;
- DVC metadata and remote setup instructions;
- an MLflow tracking and artifact-store configuration;
- data dictionaries for each gold dataset and feature set;
- persisted out-of-sample predictions;
- saved figures and comparison tables;
- a model card for every shortlisted model;
- a benchmark manifest mapping every chart and table to its producing run;
- the Streamlit research dashboard;
- a promotion checklist and rollback policy.

## Guiding Principles

1. Reproducibility before model complexity.
2. Chronological evaluation before optimization.
3. Naive baselines before advanced architectures.
4. Stored predictions before summary metrics.
5. Statistical and economic evidence before promotion.
6. Versioned contracts between the lab and product.
7. Shadow deployment before user-facing use.
8. Research language without promised returns or financial-advice claims.
