# Models Module

## Purpose
Defines shared Pydantic schemas and enums used across APIs, services, RAG, and equity research.

## Responsibilities
- Validate common document, chunk, retrieval, and RAG shapes.
- Define Quanfora 2.1 run, report, event, snapshot, decision workspace, entitlement, and sharing contracts.
- Normalize values at module boundaries.

## Key Files
- `schemas.py`: document ingestion and RAG models.
- `equity_research.py`: Equity Research Desk schemas and validators.

## Boundaries
Put cross-module request and response contracts here. Domain-internal calculation objects may remain in their domain package when they are not shared.

## Testing
Cover required fields, enum values, normalization, invalid tickers, defaults, serialization, workspace sections, and backward-compatible optional fields.

## Latest Change
- Added optional Quanfora 2.1 decision workspace response models while preserving existing run, report, snapshot, event, and shared-report contracts.
