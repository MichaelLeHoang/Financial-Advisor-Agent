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

    return Redis.from_url(
        url,
        decode_responses=True,
        socket_connect_timeout=2,
        socket_timeout=max(settings.llm_worker_poll_timeout_seconds + 2, 7),
        health_check_interval=30,
    )


def normalize_redis_error(exc: Exception) -> RedisUnavailable:
    """Convert redis-py transport errors into a stable app-level exception."""
    try:
        from redis.exceptions import RedisError
    except ImportError:
        RedisError = ()  # type: ignore[assignment]

    if isinstance(exc, RedisUnavailable):
        return exc
    if RedisError and isinstance(exc, RedisError):
        return RedisUnavailable(f"Redis is unavailable: {exc}")
    if isinstance(exc, (OSError, TimeoutError)):
        return RedisUnavailable(f"Redis is unavailable: {exc}")
    return RedisUnavailable(f"Redis operation failed: {exc}")


def redis_get_json(client: Any, key: str) -> Any | None:
    try:
        raw = client.get(key)
        if raw is None:
            return None
        return json.loads(raw)
    except Exception as exc:
        raise normalize_redis_error(exc) from exc


def redis_set_json(client: Any, key: str, value: Any, ttl_seconds: int) -> None:
    try:
        client.setex(key, ttl_seconds, json.dumps(value, default=str))
    except Exception as exc:
        raise normalize_redis_error(exc) from exc
