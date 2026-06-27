# Models Module

## Purpose
Defines shared Pydantic schemas and enums used across APIs, services, RAG, and equity research.

## Responsibilities
- Validate common document, chunk, retrieval, and RAG shapes.
- Define QuanAd 2.1 run, report, event, snapshot, entitlement, and sharing contracts.
- Normalize values at module boundaries.

## Key Files
- `schemas.py`: document ingestion and RAG models.
- `equity_research.py`: Equity Research Desk schemas and validators.

## Boundaries
Put cross-module request and response contracts here. Domain-internal calculation objects may remain in their domain package when they are not shared.

## Testing
Cover required fields, enum values, normalization, invalid tickers, defaults, serialization, and backward-compatible optional fields.

## Latest Change
- Added excluded guest ownership metadata to Equity Research Desk run models so backend access checks can bind guest runs to a browser session without exposing the token in API responses.
