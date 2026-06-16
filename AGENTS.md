# Repository Guidelines

## Project Structure & Module Organization
QuanAd backend code lives in `backend/src/`, with FastAPI routes in `api/`, agent logic in `agent/`, domain modules such as `risk/`, `backtesting/`, `billing/`, and `saas/`, and shared schemas in `models/`. Backend tests are under `backend/tests/unit/` and `backend/tests/integration/`.

The main web app is `frontend/`, a Next.js app with routes in `frontend/src/app/`, components in `frontend/src/components/`, hooks in `frontend/src/hooks/`, utilities in `frontend/src/lib/`, and assets in `frontend/public/`. `quantum-finance-ai/` is a separate Vite/React prototype. Supabase migrations are in `supabase/migrations/`; implementation notes are in `doc/`.

## Build, Test, and Development Commands
Run commands from the repository root unless noted.

- `make install`: install backend and frontend dependencies.
- `make dev`: start backend, frontend, and ngrok together.
- `make backend`: run FastAPI at `http://localhost:8000/docs`.
- `make frontend`: run Next.js at `http://localhost:3000`.
- `make test`: run all backend pytest tests.
- `make test-unit`: run fast backend unit tests only.
- `make test-integration`: run integration tests; may download embedding models.
- `make docker-up-d`: build and start Docker services in the background.
- `cd frontend && npm run build`: verify the production Next.js build.
- `cd quantum-finance-ai && npm run lint`: type-check the Vite prototype.

## Coding Style & Naming Conventions
Python targets 3.13 and uses `uv`. Keep modules snake_case, classes PascalCase, and tests named `test_*.py`. Use 4-space indentation and typed Pydantic models. `black` and `ruff` are available in backend dev dependencies.

TypeScript uses React 19 and Next.js 16 in `frontend/`. Use PascalCase for components, camelCase for functions and hooks, and keep route-specific UI inside the matching `src/app/...` folder. Read `frontend/AGENTS.md` before editing Next.js code.

## Testing Guidelines
Add unit tests for backend behavior in `backend/tests/unit/`. Put network/model-dependent checks in `backend/tests/integration/`. Prefer deterministic fixtures and mock market data, Stripe, Supabase, and LLM providers. Run `make test-unit` before small backend changes and `make test` before broader changes.

## Commit & Pull Request Guidelines
Recent history mixes conventional commits such as `feat: ...` with detailed summary bullets. Prefer `feat:`, `fix:`, `test:`, or `docs:` prefixes plus a short imperative summary. Pull requests should describe the behavior change, list test commands run, link related issues, and include screenshots or recordings for visible frontend changes.

## Security & Configuration Tips
Copy `.env.example` files instead of committing secrets. Keep API keys, Supabase credentials, Stripe secrets, and ngrok domains out of Git. For database changes, create a new numbered file in `supabase/migrations/` and document required variables in `.env.example`.
