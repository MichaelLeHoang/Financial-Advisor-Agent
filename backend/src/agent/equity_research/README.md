# Equity Research Module

## Purpose
Runs Quanfora 2.1 multi-stage equity research from one shared, source-aware market snapshot.

## Responsibilities
- Apply guest and plan entitlements.
- Enforce research depth access and monthly report limits.
- Build normalized company, market, news, filing, technical, and risk snapshots.
- Coordinate analyst, debate, trader, risk, and portfolio-manager reports for investment and trading report objectives.
- Derive saved decision workspaces and structured Overview payloads with evidence, signals, assumption backtest, regime, agent debate, next steps, and report tabs.
- Store run state, reports, events, workspaces, overviews, sharing state, legacy recommendations, investment decisions, and trading biases.
- Publish primary news and provider evidence as source events for the AI Desk activity stream.

## Key Files
- `entitlements.py`: depth, model, analyst, monthly-limit, and guest ticker restrictions.
- `snapshot.py`: deterministic research evidence collection.
- `orchestrator.py`: run lifecycle, reports, events, decision workspace, and final recommendation.

## Boundaries
API transport stays in `api/equity_research.py`; shared request and response models stay in `models/equity_research.py`. Market providers should be reused through existing data services where possible.

## Testing
Test entitlement normalization, report objective gating, report limits, invalid tickers, missing prices, source events, deterministic final decisions, structured overviews, decision workspace tabs, and run-state transitions without live providers.

## Latest Change
- Added resumable, numbered research activity streaming and genuine source events derived from the shared evidence snapshot.
