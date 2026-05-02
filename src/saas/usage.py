from collections import defaultdict
from datetime import date
from threading import Lock
from uuid import UUID

from src.saas.entitlements import FeatureKey, get_entitlement, raise_upgrade_required
from src.saas.models import AuthenticatedUser


class UsageTracker:
    def __init__(self) -> None:
        self._lock = Lock()
        self._counts: dict[tuple[UUID, str, str], int] = defaultdict(int)

    def reset(self) -> None:
        with self._lock:
            self._counts.clear()

    def current(self, user_id: UUID, key: str) -> int:
        period = date.today().isoformat()
        with self._lock:
            return self._counts[(user_id, key, period)]

    def increment(self, user: AuthenticatedUser, feature_key: FeatureKey, limit_key: str, quantity: int = 1) -> int:
        limit = get_entitlement(user.plan).limits.get(limit_key)
        period = date.today().isoformat()
        counter_key = (user.id, limit_key, period)

        with self._lock:
            next_count = self._counts[counter_key] + quantity
            if limit is not None and next_count > limit:
                raise_upgrade_required(
                    feature_key,
                    user.plan,
                    message="You have reached the current plan limit for this feature.",
                    metadata={"limit_key": limit_key, "limit": limit, "used": self._counts[counter_key]},
                )
            self._counts[counter_key] = next_count
            return next_count


usage_tracker = UsageTracker()
