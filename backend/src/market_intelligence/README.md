# Market Intelligence Module

## Purpose
Transforms the existing categorized news feed into trader-native briefing cards, ranked research opportunities, and memo-style reports.

## Responsibilities
- Score news articles for freshness, relevance, source quality, sentiment, and risk.
- Convert raw category news into briefing, picks, and report payloads.
- Preserve source links, caveats, confidence, and risk flags for evidence-first review.

## Key Files
- `models.py`: Pydantic response models for intelligence cards and reports.
- `scoring.py`: deterministic scoring, sentiment, confidence, and risk helpers.
- `service.py`: orchestration from existing news responses to market intelligence output.

## Boundaries
This module reuses the current news feed and existing RAG/ingestion architecture. It does not introduce another embedding provider, vector database, or investment-advice engine. Deep ticker analysis remains in the Quanfora 2.1 equity-research flow.

## Testing
Use deterministic sample news payloads. Cover briefing transformation, risk flags, pick ranking, report packaging, and empty-source behavior without live provider calls.

## Latest Change
- Added the Market Intelligence workspace payload builder for news briefings, research opportunities, and editorial reports.
