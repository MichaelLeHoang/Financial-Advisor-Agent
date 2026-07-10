# SaaS Module

## Purpose
Provides account plans, entitlements, usage limits, persistence, and user-scoped portfolio/watchlist resources.

## Responsibilities
- Define authenticated users, plans, subscriptions, portfolios, recurring buys, watchlists, alerts, journals, and related records.
- Enforce feature access and usage limits.
- Resolve paid plans only from active server-owned subscription records.
- Provide in-memory/Supabase-aware repository behavior.
- Expose user-scoped SaaS routes.

## Key Files
- `models.py`: account and persisted-resource schemas.
- `entitlements.py`: feature matrix and upgrade errors.
- `usage.py`: usage accounting and limits.
- `repository.py`: persistence abstraction.
- `routes.py`: thin resource endpoints.

## Boundaries
Authentication comes from `auth/`; billing provider logic stays in `billing/`; domain calculations remain in their domain modules.

## Testing
Cover plan matrices, user isolation, guest restrictions, resource limits, upgrade errors, portfolio sync behavior, and repository fallback behavior.

## Latest Change
- Removed the writable profile-plan fallback so inactive or unavailable subscriptions resolve to the free plan.
