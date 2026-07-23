# Data Module

## Purpose
Provides market-data normalization, historical price fetching, and Qdrant persistence adapters.

## Responsibilities
- Fetch current and historical market data.
- Merge and normalize timestamped yfinance, Finnhub, Alpha Vantage, and SEC evidence.
- Preserve SEC current tickers, exchanges, and former company names for identity-sensitive research.
- Search and deduplicate symbols while preserving exchange and instrument metadata.
- Manage Qdrant collections, inserts, and filtered similarity searches.

## Key Files
- `market_data_service.py`: normalized market snapshots, news, fundamentals, search, and provider quality.
- `fetch.py`: legacy historical price helpers.
- `vector_db.py`: Qdrant adapter.

## Boundaries
Consumers should use the normalized service instead of calling providers directly. RAG orchestration belongs in `rag/`; ingestion belongs in `services/`.

## Testing
Mock provider payloads and cover normalization, duplicate symbols, malformed responses, timeouts, missing data, source quality, and deterministic indicators.

## Latest Change
- Added quote timestamps, linked SEC evidence, and current/former issuer identity metadata for runtime-grounded chat responses.
