from __future__ import annotations

from collections.abc import Callable
from typing import Any

from src.config import settings
from src.core.cache import cached_value
from src.saas.models import Plan

CHAT_RESPONSE_CACHE_VERSION = 2


def normalized_chat_message(message: str) -> str:
    return " ".join(message.split()).casefold()


def chat_response_cache_payload(
    *,
    user_id: str,
    plan: Plan | str,
    mode: str,
    preferred_mode: str | None,
    message: str,
) -> dict[str, Any]:
    plan_value = plan.value if isinstance(plan, Plan) else str(plan)
    return {
        "version": CHAT_RESPONSE_CACHE_VERSION,
        "user_id": user_id,
        "plan": plan_value,
        "mode": mode,
        "preferred_mode": preferred_mode,
        "message": normalized_chat_message(message),
    }


def should_cache_chat_response(
    *,
    history: list[Any],
    is_guest: bool,
    ttl_seconds: int | None = None,
) -> bool:
    effective_ttl = (
        settings.llm_cache_ttl_seconds if ttl_seconds is None else ttl_seconds
    )
    return effective_ttl > 0 and not history and not is_guest


def cached_chat_response(
    *,
    user_id: str,
    plan: Plan | str,
    mode: str,
    preferred_mode: str | None,
    message: str,
    history: list[Any],
    is_guest: bool,
    compute: Callable[[], dict[str, Any]],
) -> dict[str, Any]:
    if not should_cache_chat_response(history=history, is_guest=is_guest):
        return compute()

    return cached_value(
        "ai_chat_response",
        chat_response_cache_payload(
            user_id=user_id,
            plan=plan,
            mode=mode,
            preferred_mode=preferred_mode,
            message=message,
        ),
        settings.llm_cache_ttl_seconds,
        compute,
    )
