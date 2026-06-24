# Services Module

## Purpose
Provides reusable document ingestion, chunking, embedding, and financial-news fetching services.

## Responsibilities
- Split financial documents into metadata-preserving chunks.
- Create embeddings through a provider abstraction.
- Fetch and normalize yfinance news documents.
- Coordinate batch ingestion into Qdrant.

## Key Files
- `chunker.py`: sentence splitting and chunk construction.
- `embedding.py`: embedding provider interface and implementation.
- `news_fetcher.py`: news-to-document normalization.
- `ingestion.py`: embedding and Qdrant ingestion orchestration.

## Boundaries
Qdrant persistence belongs in `data/vector_db.py`; retrieval belongs in `rag/`; scheduled execution belongs in `jobs/`.

## Testing
Use deterministic text and mocked embedding/vector services. Cover empty content, chunk ordering, metadata preservation, batch failures, and duplicate documents.

## Latest Change
- Consolidated reusable ingestion services used by the current portfolio, chat-history, and RAG-oriented backend structure.
