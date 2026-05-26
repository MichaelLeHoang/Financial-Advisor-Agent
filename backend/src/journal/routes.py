from collections import defaultdict

from fastapi import APIRouter, Depends

from src.auth.supabase import get_current_or_guest_user
from src.saas.entitlements import FeatureKey, enforce_feature
from src.saas.models import AuthenticatedUser, JournalEntryCreate, JournalEntryRead
from src.saas.repository import get_store


router = APIRouter(prefix="/api/v1/journal", tags=["journal"])


@router.get("/entries", response_model=list[JournalEntryRead])
async def list_journal_entries(
    limit: int = 50,
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
) -> list[JournalEntryRead]:
    enforce_feature(user, FeatureKey.TRADE_JOURNAL)
    return get_store(user).list_journal_entries(user.id, limit=max(1, min(limit, 100)))


@router.post("/entries", response_model=JournalEntryRead)
async def create_journal_entry(
    payload: JournalEntryCreate,
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
) -> JournalEntryRead:
    enforce_feature(user, FeatureKey.TRADE_JOURNAL)
    return get_store(user).create_journal_entry(user.id, payload)


@router.get("/analytics")
async def journal_analytics(user: AuthenticatedUser = Depends(get_current_or_guest_user)) -> dict:
    enforce_feature(user, FeatureKey.TRADE_JOURNAL)
    entries = get_store(user).list_journal_entries(user.id, limit=500)
    closed_entries = [entry for entry in entries if entry.pnl is not None]
    total_pnl = sum(entry.pnl or 0 for entry in closed_entries)
    wins = [entry for entry in closed_entries if (entry.pnl or 0) > 0]

    return {
        "total_entries": len(entries),
        "closed_entries": len(closed_entries),
        "total_pnl": round(total_pnl, 2),
        "win_rate": round(len(wins) / len(closed_entries), 4) if closed_entries else 0,
        "by_symbol": _group_pnl(closed_entries, lambda entry: entry.symbol),
        "by_strategy": _group_pnl(closed_entries, lambda entry: str(entry.strategy_id) if entry.strategy_id else "Unassigned"),
        "by_tag": _group_tags(closed_entries),
        "by_weekday": _group_pnl(
            closed_entries,
            lambda entry: (entry.closed_at or entry.created_at).strftime("%A"),
        ),
    }


def _group_pnl(entries: list[JournalEntryRead], key_fn) -> dict[str, dict[str, float | int]]:
    buckets: dict[str, dict[str, float | int]] = defaultdict(lambda: {"count": 0, "pnl": 0.0})
    for entry in entries:
        key = key_fn(entry)
        buckets[key]["count"] = int(buckets[key]["count"]) + 1
        buckets[key]["pnl"] = round(float(buckets[key]["pnl"]) + (entry.pnl or 0), 2)
    return dict(buckets)


def _group_tags(entries: list[JournalEntryRead]) -> dict[str, dict[str, float | int]]:
    buckets: dict[str, dict[str, float | int]] = defaultdict(lambda: {"count": 0, "pnl": 0.0})
    for entry in entries:
        for tag in entry.tags or ["Untagged"]:
            buckets[tag]["count"] = int(buckets[tag]["count"]) + 1
            buckets[tag]["pnl"] = round(float(buckets[tag]["pnl"]) + (entry.pnl or 0), 2)
    return dict(buckets)
