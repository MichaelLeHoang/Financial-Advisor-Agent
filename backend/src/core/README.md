# Core Module

## Purpose
Provides shared configuration, caching, and Redis infrastructure used across backend modules.

## Responsibilities
- Parse environment settings and protect secrets.
- Provide local cached-value helpers.
- Create and wrap Redis clients for queues and shared state.

## Key Files
- `config.py`: typed application settings.
- `cache.py`: deterministic in-process cache helper.
- `redis_client.py`: Redis connection and JSON utilities.

## Boundaries
Core utilities must remain domain-neutral. Provider-specific market, LLM, billing, or database behavior belongs in dedicated modules.

## Testing
Cover environment parsing, safe defaults, secret handling, cache keys, and Redis failure wrappers without requiring a live Redis server in unit tests.

## Latest Change
- Extended shared configuration to support normalized market-data providers and their timeout and credential settings.
