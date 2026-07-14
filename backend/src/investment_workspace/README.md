# Investment Workspace Module

## Purpose
Persists the owner-authored thesis and decision records that make Investment reviews durable.

## Responsibilities
- Store one current thesis for each Investment holding.
- Store immutable Hold and Trim decisions with rationale.
- Enforce signed-in ownership and Investment-book eligibility.
- Expose owner-scoped list, upsert, and create routes.

## Key Files
- `models.py`: thesis and decision contracts.
- `routes.py`: authenticated Investment workspace endpoints.

## Boundaries
Portfolio ownership and holdings reuse `saas/`. Deterministic concentration rules remain in `investment_policy/`. Research generation and trade execution are outside this module.

## Testing
Cover ownership isolation, book eligibility, schema validation, thesis upserts, and immutable decision creation.

## Latest Change
- Added durable per-holding investment theses and owner-authored Hold/Trim decisions.
