# Backend Source Modules

## Purpose
`backend/src` contains the FastAPI application, financial-agent workflows, domain services, provider adapters, shared schemas, and infrastructure used by QuanAd.

## Structure
- `api/` exposes HTTP and WebSocket entry points.
- `agent/`, `risk/`, `backtesting/`, `quant/`, and `quantum/` contain domain workflows.
- `data/`, `services/`, `llm/`, and `core/` provide reusable infrastructure and provider boundaries.
- `models/`, `saas/`, `auth/`, `billing/`, `notifications/`, and `journal/` define shared contracts and account features.
- `config.py` exposes the shared application settings instance backed by `core/config.py`.

## Documentation Rule
Every maintained package has its own `README.md`. Update the affected package README and its `Latest Change` section whenever backend behavior changes.

## Testing
Use deterministic unit tests under `backend/tests/unit/`; reserve external provider, model, database, and network coverage for `backend/tests/integration/`.

## Latest Change
- Added per-module documentation and established the requirement that backend changes update the corresponding module README.
