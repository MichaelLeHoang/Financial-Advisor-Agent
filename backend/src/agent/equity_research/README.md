# Equity Research Module

## Purpose
Runs Quanfora 2.1 multi-stage equity research from one shared, source-aware market snapshot.

## Responsibilities
- Apply guest and plan entitlements.
- Enforce research depth access and monthly report limits.
- Build normalized company, market, news, filing, technical, and risk snapshots.
- Coordinate analyst, debate, trader, risk, and portfolio-manager reports for investment and trading report objectives.
- Derive saved decision workspaces with overview, evidence, signals, assumption backtest, regime, agent debate, next steps, and report tabs.
- Store run state, reports, events, workspaces, sharing state, legacy recommendations, investment decisions, and trading biases.

## Key Files
- `entitlements.py`: depth, model, analyst, monthly-limit, and guest ticker restrictions.
- `snapshot.py`: deterministic research evidence collection.
- `orchestrator.py`: run lifecycle, reports, events, decision workspace, and final recommendation.

## Boundaries
API transport stays in `api/equity_research.py`; shared request and response models stay in `models/equity_research.py`. Market providers should be reused through existing data services where possible.

## Testing
Test entitlement normalization, report objective gating, report limits, invalid tickers, missing prices, deterministic final decisions, decision workspace tabs, and run-state transitions without live providers.

## Latest Change
- Added deterministic ROI Forecast fields to Portfolio Manager final reports, and taught snapshot building to retry through market-symbol resolution when a prompt resolves to a company alias like SpaceX instead of a public ticker.
