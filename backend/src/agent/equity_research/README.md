# Equity Research Module

## Purpose
Runs QuanAd 2.1 multi-stage equity research from one shared, source-aware market snapshot.

## Responsibilities
- Apply guest and plan entitlements.
- Build normalized company, market, news, filing, technical, and risk snapshots.
- Coordinate analyst, debate, trader, risk, and portfolio-manager reports for investment and trading report objectives.
- Store run state, reports, events, sharing state, and final decisions.

## Key Files
- `entitlements.py`: depth, model, analyst, and guest ticker restrictions.
- `snapshot.py`: deterministic research evidence collection.
- `orchestrator.py`: run lifecycle, reports, events, and final recommendation.

## Boundaries
API transport stays in `api/equity_research.py`; shared request and response models stay in `models/equity_research.py`. Market providers should be reused through existing data services where possible.

## Testing
Test entitlement normalization, report objective gating, invalid tickers, missing prices, deterministic final decisions, and run-state transitions without live providers.

## Latest Change
- Added investment vs trading report objectives with Trader-plan gating and objective-specific final report structures.
