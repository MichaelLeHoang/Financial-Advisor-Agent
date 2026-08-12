from datetime import datetime, timezone
from uuid import uuid4

from src.notifications.digest import deterministic_digest_summary, next_digest_run, parse_ai_digest
from src.saas.models import WatchlistAssetCreate, WatchlistCreate
from src.saas.repository import store


def test_next_digest_run_respects_local_timezone_and_rolls_forward():
    now = datetime(2026, 8, 7, 13, 0, tzinfo=timezone.utc)

    same_day = next_digest_run("America/Toronto", "10:00", now)
    next_day = next_digest_run("America/Toronto", "08:00", now)

    assert same_day == datetime(2026, 8, 7, 14, 0, tzinfo=timezone.utc)
    assert next_day == datetime(2026, 8, 8, 12, 0, tzinfo=timezone.utc)


def test_empty_watchlist_digest_has_general_market_fallback_copy():
    summary = deterministic_digest_summary({"articles": [], "is_personalized": False})

    assert "broader market" in summary["overview"]
    assert summary["items"] == []


def test_invalid_ai_output_uses_deterministic_fallback():
    fallback = {"headline": "Fallback", "overview": "Stable", "items": []}

    assert parse_ai_digest({"candidates": [{"content": {"parts": [{"text": "not json"}]}}]}, fallback) == fallback


def test_digest_delivery_claim_is_idempotent_and_symbols_are_deduplicated():
    user_id = uuid4()
    watchlist = store.create_watchlist(user_id, WatchlistCreate(name="Core"))
    store.add_watchlist_asset(user_id, watchlist.id, WatchlistAssetCreate(symbol="AAPL"))
    store.add_watchlist_asset(user_id, watchlist.id, WatchlistAssetCreate(symbol="AAPL"))
    digest_date = datetime(2026, 8, 7, tzinfo=timezone.utc).date()

    first = store.claim_news_digest_delivery(user_id, digest_date)
    second = store.claim_news_digest_delivery(user_id, digest_date)

    assert first is not None
    assert second is None
    assert store.list_user_watchlist_symbols(user_id) == ["AAPL"]
    store.reset()
