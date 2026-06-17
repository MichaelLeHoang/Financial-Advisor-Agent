from __future__ import annotations

import hashlib
import json
import sys
from collections.abc import Callable
from typing import TypeVar

from src.config import settings
from src.core.redis_client import RedisUnavailable, get_redis_client, redis_get_json, redis_set_json

T = TypeVar("T")


def stable_cache_key(namespace: str, payload: object) -> str:
    raw = json.dumps(payload, sort_keys=True, default=str)
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()
    return f"cache:{namespace}:{digest}"


def cached_value(namespace: str, payload: object, ttl_seconds: int, compute: Callable[[], T]) -> T:
    if settings.app_env == "test" or "pytest" in sys.modules:
        return compute()

    key = stable_cache_key(namespace, payload)
    try:
        client = get_redis_client()
        cached = redis_get_json(client, key)
        if cached is not None:
            return cached
        value = compute()
        redis_set_json(client, key, value, ttl_seconds)
        return value
    except (RedisUnavailable, OSError, TimeoutError):
        return compute()
