# API Module

## Purpose
Provides the FastAPI application and thin transport adapters for QuanAd backend capabilities.

## Responsibilities
- Register routers, middleware, authentication dependencies, and health/status endpoints.
- Expose agent chat, queued jobs, market quote/search, prediction, portfolio, watchlist, and service endpoints.
- Delegate domain behavior to dedicated modules and normalize HTTP errors/timeouts.

## Key Files
- `app.py`: application composition and core API surface.
- `equity_research.py`: QuanAd 2.1 run, event, share, and report routes.
- `news_routes.py`: categorized financial-news endpoints.

## Boundaries
Route handlers should validate and translate requests only. Business logic belongs in agent, data, SaaS, billing, risk, backtesting, or service modules.

## Testing
Use FastAPI `TestClient` with mocked dependencies for route contracts, authorization, provider timeouts, status rollups, and error responses.

## Latest Change
- Expanded prediction responses with current price, ML direction, valuation metadata, combined signals, confidence, and model error metrics.
