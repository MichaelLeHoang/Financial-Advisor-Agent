from __future__ import annotations

import json
from typing import Any

from src.config import settings


class RedisUnavailable(RuntimeError):
    """Raised when Redis-backed features are requested without Redis."""


def _redis_url() -> str | None:
    value = settings.secret_value("redis_url")
    return value or None


def get_redis_client():
    """Return a Redis client or raise a clear configuration/import error."""
    url = _redis_url()
    if not url:
        raise RedisUnavailable("REDIS_URL is required for queued LLM jobs")

    try:
        from redis import Redis
    except ImportError as exc:
        raise RedisUnavailable("Install the redis package to use queued LLM jobs") from exc

    return Redis.from_url(url, decode_responses=True)


def redis_get_json(client: Any, key: str) -> Any | None:
    raw = client.get(key)
    if raw is None:
        return None
    return json.loads(raw)


def redis_set_json(client: Any, key: str, value: Any, ttl_seconds: int) -> None:
    client.setex(key, ttl_seconds, json.dumps(value, default=str))
