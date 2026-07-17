# API Module

## Purpose
Provides the FastAPI application and thin transport adapters for Quanfora backend capabilities.

## Responsibilities
- Register routers, middleware, authentication dependencies, and health/status endpoints.
- Expose Sabi-routed agent chat, selected-capability metadata, structured overviews, queued jobs, bounded RAG queries, market quote/search, prediction, portfolio, watchlist, and service endpoints.
- Delegate domain behavior, including stateless chat-response caching, to dedicated modules and normalize HTTP errors/timeouts.

## Key Files
- `app.py`: application composition and core API surface.
- `equity_research.py`: Quanfora 2.1 run, event, share, workspace, and report routes.
- `news_routes.py`: categorized financial-news endpoints.
- `routes/intelligence.py`: Market Intelligence briefing, picks, and report endpoint.

## Boundaries
Route handlers should validate and translate requests only. Business logic belongs in agent, data, SaaS, billing, risk, backtesting, or service modules.

## Testing
Use FastAPI `TestClient` with mocked dependencies for route contracts, authorization, provider timeouts, overview/workspace payloads, status rollups, and error responses.

## Latest Change
- Made Sabi the default mode on the existing agent chat and queued-job contracts while preserving manual and legacy modes.
