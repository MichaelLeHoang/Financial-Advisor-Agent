# Risk Module

## Purpose
Calculates and exposes portfolio risk snapshots.

## Responsibilities
- Fetch price histories through a risk-market-data protocol.
- Calculate concentration, volatility, drawdown, VaR, and risk scores.
- Enforce plan access and persist user-scoped snapshots.
- Scope on-demand snapshots to an Investment or Trading position book when requested.

## Key Files
- `calculations.py`: deterministic portfolio risk metrics.
- `market_data.py`: protocol and yfinance adapter.
- `routes.py`: snapshot endpoints and persistence coordination.

## Boundaries
Portfolio records and entitlements reuse `saas/`. Risk calculations should remain independent of route and provider details.

## Testing
Use fixed holdings and price frames. Cover empty portfolios, missing prices, concentration, drawdown, VaR, plan restrictions, and persistence.

## Latest Change
- Added position-book filtering so centralized Portfolio risk snapshots analyze only the selected Investment or Trading holdings.
