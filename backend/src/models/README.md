# Models Module

## Purpose
Defines shared Pydantic schemas and enums used across APIs, services, RAG, and equity research.

## Responsibilities
- Validate common document, chunk, retrieval, and RAG shapes.
- Define shared Overview, per-asset consensus assessment, Quanfora 2.1 run, report, event, snapshot, decision workspace, entitlement, and sharing contracts.
- Define bounded conversational-memory records, approval states, settings, and context-usage metadata.
- Define bounded public agent-activity events, step/tool summaries, citations, and terminal traces.
- Normalize values at module boundaries.

## Key Files
- `schemas.py`: document ingestion and RAG models.
- `equity_research.py`: Equity Research Desk schemas and validators.
- `overview.py`: reusable structured overview schemas for chat and research responses.
- `memory.py`: user memory, status, settings, CRUD, and disclosure schemas.
- `agent_activity.py`: safe public activity-event and persisted-trace contracts.

## Boundaries
Put cross-module request and response contracts here. Domain-internal calculation objects may remain in their domain package when they are not shared.

## Testing
Cover required fields, enum values, normalization, invalid tickers, defaults, serialization, bounded activity payloads, overview payloads, workspace sections, and backward-compatible optional fields.

## Latest Change
- Extended Overview metadata with per-asset verdict cards, evidence coverage and freshness, measured risks, limitations, and real provider sources for multi-stock consensus responses.
