# Core Module

## Purpose
Provides shared configuration, caching, and Redis infrastructure used across backend modules.

## Responsibilities
- Parse environment settings and protect secrets.
- Provide Redis-backed cached-value helpers with deterministic keys and graceful fallback.
- Create and wrap Redis clients for queues and shared state.

## Key Files
- `config.py`: typed application settings.
- `cache.py`: deterministic Redis cache helper used by market tools and agent response caching.
- `redis_client.py`: Redis connection and JSON utilities.

## Boundaries
Core utilities must remain domain-neutral. Provider-specific market, LLM, billing, or database behavior belongs in dedicated modules.

## Testing
Cover environment parsing, safe defaults, secret handling, cache keys, and Redis failure wrappers without requiring a live Redis server in unit tests.

## Latest Change
- Clarified shared cache behavior now used by stateless AI chat response caching.
