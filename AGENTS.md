# Repository Guidelines

## Project Structure & Module Organization
QuanAd backend code lives in `backend/src/`, with FastAPI routes in `api/`, agent logic in `agent/`, domain modules such as `risk/`, `backtesting/`, `billing/`, and `saas/`, and shared schemas in `models/`. Backend tests are under `backend/tests/unit/` and `backend/tests/integration/`.

The main web app is `frontend/`, a Next.js app with routes in `frontend/src/app/`, components in `frontend/src/components/`, hooks in `frontend/src/hooks/`, utilities in `frontend/src/lib/`, and assets in `frontend/public/`. Supabase migrations are in `supabase/migrations/`; implementation notes are in `doc/`.

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

## Coding Style & Naming Conventions
Python targets 3.13 and uses `uv`. Keep modules snake_case, classes PascalCase, and tests named `test_*.py`. Use 4-space indentation and typed Pydantic models. `black` and `ruff` are available in backend dev dependencies.

TypeScript uses React 19 and Next.js 16 in `frontend/`. Use PascalCase for components, camelCase for functions and hooks, and keep route-specific UI inside the matching `src/app/...` folder. Read `frontend/AGENTS.md` before editing Next.js code.

## Implementation Principles
Before adding new modules, endpoints, services, schemas, or utilities, inspect the existing codebase for reusable functionality. Prefer extending, composing, or adapting existing abstractions over creating parallel implementations. Create new code only when the current structure does not fit the requirement clearly.

Keep new behavior aligned with the existing project structure. Backend domain logic should live in the appropriate `backend/src/` module, shared request and response shapes should live in `models/`, FastAPI route handlers should stay thin, and service-specific logic should remain behind dedicated adapters or service modules.

When a new feature connects to existing behavior, verify both sides of the connection. For example, changes to agent workflows should respect existing agent, consensus, risk, market data, and response-format behavior. Changes to billing or SaaS features should reuse existing entitlement, Stripe, Supabase, and plan-limit logic where possible.

Do not duplicate existing functionality unless there is a clear reason. If temporary duplication is necessary, document why, keep the boundary explicit, and prefer a follow-up refactor once the correct abstraction is clear.

## Module Documentation
Each maintained backend package under `backend/src/` has a `README.md` describing its purpose, responsibilities, key files, boundaries, testing, and a `Latest Change` section.

When changing a backend module, update that module's `README.md` in the same change. Revise `Latest Change` to summarize the newly introduced behavior and update other sections when responsibilities, public interfaces, dependencies, routes, schemas, or testing expectations change. If a change spans multiple modules, update every affected module README. Documentation-only wording changes do not require recursively updating `Latest Change`.

## Testing Guidelines
Add backend unit tests in `backend/tests/unit/` for deterministic application behavior: pure business logic, Pydantic schema validation, API route behavior with mocked dependencies, consensus and risk calculations, billing logic, entitlement checks, and error handling. Unit tests must not call external services, download models, or depend on live market data.

Put integration tests in `backend/tests/integration/` when the test intentionally exercises network, database, model, or service boundaries such as yfinance market data, Qdrant, embedding models, FinBERT, Supabase, Stripe webhooks, or real LLM provider adapters.

Prefer deterministic fixtures over live data. Mock or fake market data, Stripe, Supabase, Qdrant, and LLM providers unless the test is explicitly marked as integration. Use small, stable sample payloads for prices, headlines, portfolios, checkout sessions, and agent responses so tests are repeatable in CI.

Before making non-trivial backend changes, run the most relevant existing tests first to establish a baseline. If tests already fail, document the pre-existing failure before changing code. After implementing changes, rerun the affected tests. If the change introduces failures, fix the issue and rerun the relevant tests until they pass.

When modifying existing behavior, protect the previous expected behavior with regression tests before or alongside the new tests. Tests should cover both the new behavior and the connection between new code and existing code. Do not only test the new function in isolation when the feature depends on existing agent workflows, risk logic, billing entitlements, portfolio analysis, market data, Supabase, Stripe, Qdrant, or LLM providers.

Tests should be thoughtful, meaningful, and focused on behavior rather than implementation details. Cover important success cases, failure cases, and edge cases such as empty input, invalid tickers, missing market data, malformed provider responses, provider timeouts, unauthorized users, duplicated webhooks, plan-limit failures, agent disagreement, and risk-veto scenarios.

For bug fixes, add or update a regression test that fails before the fix and passes after the fix. Do not weaken, delete, or rewrite existing tests just to make them pass. Only update tests when the expected behavior has intentionally changed, and make that behavior change clear in the commit or pull request.

Run `make test-unit` before and after small backend changes. Run `make test-integration` when touching service adapters, model-loading paths, RAG, billing webhooks, database-backed flows, or external-provider integrations and the required local services and credentials are available. Run `make test` before broader backend changes or before opening a pull request.

## Commit & Pull Request Guidelines
Prefer conventional commit prefixes such as `feat:`, `fix:`, `test:`, `refactor:`, `docs:`, `chore:`, `perf:`, or `style:`. Use a short imperative summary, for example `fix(agent): handle invalid ticker responses`.

For meaningful feature, fix, refactor, or test commits, use this structure:

```text
<type>(<scope>): <short imperative summary>

Why:
- <Reason for the change, bug, requirement, or design decision>

What changed:
- <Main implementation change>
- <Important supporting change>
- <How existing modules, services, schemas, or tests were reused or extended>

Testing:
- <Command run, e.g. make test-unit>
- <Command run, e.g. make test-integration>
- <Command run, e.g. make test>
- <If not run, explain why>

Notes:
- <Breaking changes, migrations, known limitations, follow-up work, or risk notes>
```

For small documentation, chore, style, or narrow test-only commits, a compact format is acceptable:

```text
<type>(<scope>): <short imperative summary>

- <Main change>
- <Test command run, or "Not run" with reason>
- <Important note, if any>
```

Choose scopes that reflect the affected area, such as `agent`, `risk`, `billing`, `saas`, `rag`, `market`, `portfolio`, `frontend`, `docs`, `tests`, or `config`.

Do not claim tests were run unless they were actually run. If tests were skipped, state the reason clearly. If existing tests failed before the change, mention the pre-existing failure separately from any new failures introduced by the change.

Pull requests should describe the behavior change, explain why the change was needed, list test commands run, link related issues, and include screenshots or recordings for visible frontend changes. PR notes should also mention any reused existing functionality, intentional behavior changes, migrations, new environment variables, or follow-up tasks.

## Merge Guidelines
Do not merge changes into the main branch until the branch is up to date, relevant tests have passed, and the pull request clearly describes the behavior change.

Before merging, verify:

- The branch has no unresolved merge conflicts.
- The change reuses existing modules, services, schemas, and tests where appropriate.
- Relevant unit, integration, or full test commands have been run and documented.
- Any failing tests are either fixed or clearly identified as pre-existing.
- Frontend-visible changes include screenshots or recordings when useful.
- Database migrations, environment variables, breaking changes, and follow-up tasks are documented.

Use a clear merge title that summarizes the final behavior change, not the temporary branch name. Prefer an imperative conventional-style title, such as:

- `feat(agent): add consensus response validation`
- `fix(billing): handle duplicate Stripe webhook events`
- `test(risk): add regression coverage for portfolio edge cases`
- `docs(repo): update testing and merge guidelines`

Use the merge description to summarize:

- Why the change was needed.
- What changed.
- What existing functionality was reused or extended.
- What tests were run.
- Any migrations, environment variables, breaking changes, known limitations, or follow-up tasks.

A good merge description format is:

```text
Summary:
- <High-level behavior change>
- <Important implementation detail>
- <Existing modules/services/schemas reused or extended>

Testing:
- <Command run>
- <Command run>
- <Not run, with reason if applicable>

Notes:
- <Migration, env var, breaking change, limitation, or follow-up task>
```

Prefer squash merges for feature branches to keep `main` history clean, especially when the branch contains many small work-in-progress commits. Use regular merge commits only when preserving the full branch history is important. Do not force-push or rewrite the main branch.

After resolving merge conflicts, rerun the affected tests because conflict resolution can accidentally change behavior. If a conflict touches existing behavior, check both the old behavior and the new behavior before merging.

## Security & Configuration Tips
Copy `.env.example` files instead of committing secrets. Keep API keys, Supabase credentials, Stripe secrets, and ngrok domains out of Git. For database changes, create a new numbered file in `supabase/migrations/` and document required variables in `.env.example`.
