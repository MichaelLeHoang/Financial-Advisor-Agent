# API Module

## Purpose
Provides the FastAPI application and thin transport adapters for Quanfora backend capabilities.

## Responsibilities
- Register routers, middleware, authentication dependencies, and health/status endpoints.
- Expose Sabi-routed agent chat, selected-capability metadata, structured overviews, queued jobs, bounded RAG queries, market quote/search plus a bounded provider-backed earnings calendar, prediction, portfolio, watchlist, and service endpoints.
- Expose owned chat-history truncation for edit-and-regenerate and retry workflows.
- Expose authenticated, owner-scoped memory review, confirmation, editing, settings, and deletion routes.
- Stream owner-scoped, resumable agent activity and equity-research events over SSE, with polling contracts retained as a fallback.
- Delegate domain behavior, including stateless chat-response caching, to dedicated modules and normalize HTTP errors/timeouts.

## Key Files
- `app.py`: application composition and core API surface.
- `equity_research.py`: Quanfora 2.1 run, event, share, workspace, and report routes.
- `news_routes.py`: categorized financial-news endpoints.
- `memory.py`: user-controlled conversational-memory CRUD and approval routes.
- `routes/intelligence.py`: Market Intelligence briefing, picks, and report endpoint.

## Boundaries
Route handlers should validate and translate requests only. Business logic belongs in agent, data, SaaS, billing, risk, backtesting, or service modules.

## Testing
Use FastAPI `TestClient` with mocked dependencies for route contracts, authorization, resumable SSE cursors, provider timeouts, overview/workspace payloads, status rollups, and error responses.

## Latest Change
- Extended consensus responses with per-ticker verdicts, exact agreement, evidence coverage and status, measured risks, limitations, freshness, provider sources, and specialist availability metadata.
