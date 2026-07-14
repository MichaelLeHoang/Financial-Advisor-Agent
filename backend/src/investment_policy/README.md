# Investment Policy Module

## Purpose
Persists owner-defined investment constraints and evaluates recorded portfolio facts deterministically.

## Responsibilities
- Define the account investment-policy contract.
- Validate target allocation configuration.
- Detect position-weight, cash-weight, permitted-asset, and unclassified-position issues across one or multiple Investment portfolios.
- Expose owner-scoped read, update, and validation routes.

## Key Files
- `models.py`: policy, alert, and validation schemas.
- `validator.py`: deterministic checks that require no market-data or LLM calls.
- `routes.py`: authenticated policy endpoints.

## Boundaries
Holding ownership and persistence reuse `saas/`. Live risk metrics remain in `risk/`; thesis lifecycle and agent explanations remain separate.

## Testing
Cover policy schema validation, deterministic breach detection, guest rejection, and cross-user portfolio isolation.

## Latest Change
- Added Investment-only concentration math and cross-portfolio, symbol-aggregated policy validation.
