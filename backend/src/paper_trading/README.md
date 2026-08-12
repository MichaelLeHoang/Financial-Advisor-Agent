# Paper Trading Module

## Purpose
Provides owner-scoped paper brokerage accounts with deterministic order, cash, fill, and position accounting.

## Responsibilities
- Create standalone cash paper accounts for authenticated users and explicit guest sessions.
- Validate buying power, reserved cash, and cash-account sell constraints before accepting orders.
- Fill market orders immediately and evaluate open limit/stop orders against refreshed quotes.
- Maintain positions, realized/unrealized P&L, reserved cash, and an append-only cash ledger.
- Expose paper-account, order, fill, position, ledger, refresh, and snapshot routes.

## Key Files
- `models.py`: typed paper account, order, fill, position, quote, ledger, and summary contracts.
- `repository.py`: deterministic accounting with in-memory guest/local storage and Supabase transactional adapters.
- `routes.py`: thin API routes and market-data refresh boundary.

## Boundaries
Market prices reuse `data/`; authentication comes from `auth/`. Investment holdings remain in `saas/`, historical replay remains in `backtesting/`, and live brokerage execution is intentionally excluded.

## Testing
Cover owner isolation, guest tokens, cash debits, reservations, fills, cancellations, position updates, realized/unrealized P&L, and invalid order rejection with mocked quotes.

## Latest Change
- Added the first functional paper brokerage account, transactional order simulator, cash ledger, owner isolation, and protection against oversubscribed cash or positions.
