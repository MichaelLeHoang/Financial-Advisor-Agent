# SaaS Module

## Purpose
Provides account plans, entitlements, usage limits, persistence, and user-scoped portfolio/watchlist resources.

## Responsibilities
- Define authenticated users, plans, subscriptions, portfolios, classified position books, recurring buys, watchlists, alerts, journals, and related records.
- Enforce feature access and usage limits.
- Resolve paid plans only from active server-owned subscription records.
- Provide in-memory/Supabase-aware repository behavior.
- Expose user-scoped SaaS routes.

## Key Files
- `models.py`: account and persisted-resource schemas.
- `entitlements.py`: feature matrix and upgrade errors.
- `usage.py`: usage accounting and limits.
- `repository.py`: persistence abstraction and owner-scoped classification event access.
- `portfolio_books.py`: deterministic cost-basis aggregation and combined book risk context.
- `routes.py`: thin resource endpoints.

## Boundaries
Authentication comes from `auth/`; billing provider logic stays in `billing/`; domain calculations remain in their domain modules.

## Testing
Cover plan matrices, user isolation, guest restrictions, resource limits, upgrade errors, portfolio reconciliation and classification events, portfolio sync behavior, and repository fallback behavior.

## Latest Change
- Recurring-buy reads now tolerate an unapplied optional Supabase schema, while writes return a clear service-unavailable response and validate the schema before synchronizing holdings.
