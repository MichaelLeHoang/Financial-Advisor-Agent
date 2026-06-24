# Quant Module

## Purpose
Provides advanced quantitative workflows for strategy comparison, signal ranking, validation, and code export.

## Responsibilities
- Compare strategy performance and rank signals.
- Validate strategies with deterministic metric blocks.
- Produce research-only strategy exports through the LLM coding mode.
- Enforce Quant-plan access.

## Key Files
- `calculations.py`: quantitative calculations and export helpers.
- `models.py`: request and response contracts.
- `routes.py`: entitlement-aware endpoints.

## Boundaries
Reuse backtesting engines and market adapters. Model routing belongs in `llm/`; account access belongs in `saas/`.

## Testing
Use fixed price series and mocked LLMs. Cover ranking order, validation output, plan restrictions, export persistence, and failure behavior.

## Latest Change
- Reused the standardized backtest price-series conversion across quantitative validation and strategy workflows.
