# Backtesting Module

## Purpose
Executes deterministic strategy simulations and manages saved runs and replay sessions.

## Responsibilities
- Validate backtest requests and strategy parameters.
- Fetch OHLC market data through an adapter.
- Simulate trades, fees, slippage, equity curves, and performance metrics.
- Expose run and replay lifecycle routes with SaaS entitlement checks.

## Key Files
- `engine.py`: simulation and metrics.
- `market_data.py`: market-data protocol and yfinance adapter.
- `models.py`: request, response, trade, and replay schemas.
- `routes.py`: thin FastAPI endpoints.

## Boundaries
Market access stays behind `MarketDataAdapter`; persisted account records reuse the SaaS repository. Advanced comparisons belong in `quant/`.

## Testing
Use fixed OHLC frames for calculations, trades, route lifecycle, authorization, fees, slippage, and insufficient-data cases.

## Latest Change
- Standardized price-series conversion across backtest call sites and preserved the canonical replay route used by saved sessions.
