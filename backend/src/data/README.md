# Data Module

## Purpose
Provides equity and crypto market-data normalization, historical price fetching, and Qdrant persistence adapters.

## Responsibilities
- Fetch current and historical market data.
- Fetch normalized crypto overviews, long-term price series, sentiment, and Bitcoin network context.
- Merge and normalize timestamped yfinance, Finnhub, Alpha Vantage, and SEC evidence.
- Preserve SEC current tickers, exchanges, and former company names for identity-sensitive research.
- Search and deduplicate symbols while preserving exchange and instrument metadata.
- Manage Qdrant collections, inserts, and filtered similarity searches.

## Key Files
- `market_data_service.py`: normalized market snapshots, news, fundamentals, search, and provider quality.
- `crypto_market_service.py`: CoinGecko, Alternative.me, Blockchain.com, mempool.space, and DefiLlama normalization with isolated provider failures, bounded caching, yfinance history/overview fallbacks, and a Bitcoin price-only safety net.
- `fetch.py`: legacy historical price helpers.
- `vector_db.py`: Qdrant adapter.

## Boundaries
Consumers should use the normalized service instead of calling providers directly. RAG orchestration belongs in `rag/`; ingestion belongs in `services/`.

## Testing
Mock provider payloads and cover normalization, duplicate symbols, malformed responses, timeouts, missing data, source quality, deterministic indicators, crypto moving averages, sentiment boundaries, and halving progress.

## Latest Change
- Added a CoinGecko → normalized yfinance → mempool.space Bitcoin overview chain so provider rate limits no longer blank the primary crypto quote.
