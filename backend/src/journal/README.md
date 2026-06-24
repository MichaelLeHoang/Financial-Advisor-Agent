# Journal Module

## Purpose
Provides trade-journal creation, listing, and analytics endpoints.

## Responsibilities
- Enforce plan access for journal workflows.
- Store and retrieve user-scoped trade entries.
- Aggregate journal statistics and behavioral analytics.

## Key Files
- `routes.py`: journal API and analytics aggregation.

## Boundaries
Shared account models and persistence stay in `saas/`; market simulation belongs in `backtesting/`.

## Testing
Cover authorization, user scoping, create/list behavior, empty journals, and deterministic analytics.

## Latest Change
- Established the current journal route package and SaaS-backed persistence boundary during the backend restructure.
