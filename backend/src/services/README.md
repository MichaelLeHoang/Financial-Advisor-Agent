# Services Module

## Purpose
Provides reusable document ingestion, chunking, embedding, financial-news fetching, and user-memory services.

## Responsibilities
- Split financial documents into metadata-preserving chunks.
- Create embeddings through a provider abstraction.
- Fetch and normalize yfinance news documents.
- Coordinate batch ingestion into Qdrant.
- Persist user-controlled conversational memory and rolling summaries in the existing SQLite conversation database.
- Construct prompt-safe, bounded personal context and schedule non-blocking LLM maintenance.

## Key Files
- `chunker.py`: sentence splitting and chunk construction.
- `embedding.py`: embedding provider interface and implementation.
- `news_fetcher.py`: news-to-document normalization.
- `ingestion.py`: embedding and Qdrant ingestion orchestration.
- `user_memory.py`: memory CRUD, confirmation, extraction, summaries, and context construction.

## Boundaries
Qdrant persistence belongs in `data/vector_db.py`; retrieval belongs in `rag/`; LLM memory maintenance runs through the existing agent queue. Structured account, portfolio, and market facts must never be sourced from conversational memory.

## Testing
Use deterministic text and mocked embedding/vector services. Cover empty content, chunk ordering, metadata preservation, batch failures, and duplicate documents.

## Latest Change
- Added SQLite-first, user-controlled agent memory with strict ownership, explicit confirmation, bounded context, and replaceable persistence boundaries.
