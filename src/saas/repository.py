from threading import Lock
from typing import Any
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from uuid import UUID, uuid4
from datetime import datetime, timezone

from src.config import settings
from src.saas.models import (
    AuthenticatedUser,
    HoldingCreate,
    HoldingRead,
    PortfolioCreate,
    PortfolioRead,
    Plan,
    SubscriptionRead,
    WatchlistAssetCreate,
    WatchlistAssetRead,
    WatchlistCreate,
    WatchlistRead,
)


class UserScopedStore:
    """Local user-scoped store used until Supabase data access is wired.

    The API keeps user ownership checks here as well as in Supabase RLS. This
    lets tests verify scoping without relying only on frontend checks or RLS.
    """

    def __init__(self) -> None:
        self._lock = Lock()
        self._portfolios: dict[UUID, PortfolioRead] = {}
        self._holdings: dict[UUID, list[HoldingRead]] = {}
        self._watchlists: dict[UUID, WatchlistRead] = {}
        self._watchlist_assets: dict[UUID, list[WatchlistAssetRead]] = {}
        self._subscriptions: dict[UUID, SubscriptionRead] = {}

    def reset(self) -> None:
        with self._lock:
            self._portfolios.clear()
            self._holdings.clear()
            self._watchlists.clear()
            self._watchlist_assets.clear()
            self._subscriptions.clear()

    def get_subscription(self, user_id: UUID) -> SubscriptionRead:
        with self._lock:
            return self._subscriptions.get(user_id) or SubscriptionRead(user_id=user_id)

    def get_user_plan(self, user_id: UUID) -> Plan | None:
        subscription = self.get_subscription(user_id)
        return subscription.plan if subscription.status in {"active", "trialing"} else None

    def upsert_subscription(
        self,
        user_id: UUID,
        *,
        stripe_customer_id: str | None = None,
        stripe_subscription_id: str | None = None,
        plan: Plan = Plan.FREE,
        status: str = "inactive",
        current_period_end: datetime | None = None,
    ) -> SubscriptionRead:
        with self._lock:
            existing = self._subscriptions.get(user_id)
            subscription = SubscriptionRead(
                id=existing.id if existing else uuid4(),
                user_id=user_id,
                stripe_customer_id=stripe_customer_id or existing.stripe_customer_id if existing else stripe_customer_id,
                stripe_subscription_id=stripe_subscription_id or existing.stripe_subscription_id if existing else stripe_subscription_id,
                plan=plan,
                status=status,
                current_period_end=current_period_end,
                created_at=existing.created_at if existing else datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
            )
            self._subscriptions[user_id] = subscription
            return subscription

    def find_subscription_by_customer(self, stripe_customer_id: str) -> SubscriptionRead | None:
        with self._lock:
            return next((sub for sub in self._subscriptions.values() if sub.stripe_customer_id == stripe_customer_id), None)

    def find_subscription_by_stripe_subscription(self, stripe_subscription_id: str) -> SubscriptionRead | None:
        with self._lock:
            return next((sub for sub in self._subscriptions.values() if sub.stripe_subscription_id == stripe_subscription_id), None)

    def list_portfolios(self, user_id: UUID) -> list[PortfolioRead]:
        with self._lock:
            return [portfolio for portfolio in self._portfolios.values() if portfolio.user_id == user_id]

    def create_portfolio(self, user_id: UUID, payload: PortfolioCreate) -> PortfolioRead:
        portfolio = PortfolioRead(
            id=uuid4(),
            user_id=user_id,
            name=payload.name,
            base_currency=payload.base_currency.upper(),
        )
        with self._lock:
            self._portfolios[portfolio.id] = portfolio
        return portfolio

    def get_portfolio(self, user_id: UUID, portfolio_id: UUID) -> PortfolioRead | None:
        with self._lock:
            portfolio = self._portfolios.get(portfolio_id)
            if portfolio is None or portfolio.user_id != user_id:
                return None
            return portfolio

    def add_holding(self, user_id: UUID, portfolio_id: UUID, payload: HoldingCreate) -> HoldingRead | None:
        if self.get_portfolio(user_id, portfolio_id) is None:
            return None

        holding = HoldingRead(
            id=uuid4(),
            portfolio_id=portfolio_id,
            symbol=payload.symbol.upper(),
            asset_type=payload.asset_type,
            quantity=payload.quantity,
            average_cost=payload.average_cost,
        )
        with self._lock:
            self._holdings.setdefault(portfolio_id, []).append(holding)
        return holding

    def list_holdings(self, user_id: UUID, portfolio_id: UUID) -> list[HoldingRead] | None:
        if self.get_portfolio(user_id, portfolio_id) is None:
            return None
        with self._lock:
            return list(self._holdings.get(portfolio_id, []))

    def list_watchlists(self, user_id: UUID) -> list[WatchlistRead]:
        with self._lock:
            return [watchlist for watchlist in self._watchlists.values() if watchlist.user_id == user_id]

    def create_watchlist(self, user_id: UUID, payload: WatchlistCreate) -> WatchlistRead:
        watchlist = WatchlistRead(id=uuid4(), user_id=user_id, name=payload.name)
        with self._lock:
            self._watchlists[watchlist.id] = watchlist
        return watchlist

    def get_watchlist(self, user_id: UUID, watchlist_id: UUID) -> WatchlistRead | None:
        with self._lock:
            watchlist = self._watchlists.get(watchlist_id)
            if watchlist is None or watchlist.user_id != user_id:
                return None
            return watchlist

    def add_watchlist_asset(
        self, user_id: UUID, watchlist_id: UUID, payload: WatchlistAssetCreate
    ) -> WatchlistAssetRead | None:
        if self.get_watchlist(user_id, watchlist_id) is None:
            return None

        asset = WatchlistAssetRead(
            id=uuid4(),
            watchlist_id=watchlist_id,
            symbol=payload.symbol.upper(),
            asset_type=payload.asset_type,
        )
        with self._lock:
            self._watchlist_assets.setdefault(watchlist_id, []).append(asset)
        return asset

    def list_watchlist_assets(self, user_id: UUID, watchlist_id: UUID) -> list[WatchlistAssetRead] | None:
        if self.get_watchlist(user_id, watchlist_id) is None:
            return None
        with self._lock:
            return list(self._watchlist_assets.get(watchlist_id, []))


store = UserScopedStore()


class SupabaseRestStore:
    """Small Supabase REST adapter for SaaS foundation CRUD."""

    def __init__(self, supabase_url: str, service_role_key: str) -> None:
        self._base_url = supabase_url.rstrip("/")
        self._service_role_key = service_role_key

    def _request(self, method: str, table: str, query: dict[str, str] | None = None, body: dict[str, Any] | None = None) -> list[dict]:
        url = f"{self._base_url}/rest/v1/{table}"
        if query:
            url = f"{url}?{urlencode(query)}"

        data = None
        if body is not None:
            import json

            data = json.dumps(body).encode("utf-8")

        request = Request(
            url,
            data=data,
            method=method,
            headers={
                "apikey": self._service_role_key,
                "Authorization": f"Bearer {self._service_role_key}",
                "Content-Type": "application/json",
                "Prefer": "return=representation",
            },
        )
        with urlopen(request, timeout=20) as response:
            raw = response.read().decode("utf-8")
            if not raw:
                return []

            import json

            payload = json.loads(raw)
            return payload if isinstance(payload, list) else [payload]

    def list_portfolios(self, user_id: UUID) -> list[PortfolioRead]:
        rows = self._request("GET", "portfolios", {"select": "*", "user_id": f"eq.{user_id}"})
        return [PortfolioRead.model_validate(row) for row in rows]

    def create_portfolio(self, user_id: UUID, payload: PortfolioCreate) -> PortfolioRead:
        rows = self._request(
            "POST",
            "portfolios",
            body={"user_id": str(user_id), "name": payload.name, "base_currency": payload.base_currency.upper()},
        )
        return PortfolioRead.model_validate(rows[0])

    def get_portfolio(self, user_id: UUID, portfolio_id: UUID) -> PortfolioRead | None:
        rows = self._request(
            "GET",
            "portfolios",
            {"select": "*", "id": f"eq.{portfolio_id}", "user_id": f"eq.{user_id}", "limit": "1"},
        )
        return PortfolioRead.model_validate(rows[0]) if rows else None

    def add_holding(self, user_id: UUID, portfolio_id: UUID, payload: HoldingCreate) -> HoldingRead | None:
        if self.get_portfolio(user_id, portfolio_id) is None:
            return None
        rows = self._request(
            "POST",
            "holdings",
            body={
                "portfolio_id": str(portfolio_id),
                "symbol": payload.symbol.upper(),
                "asset_type": payload.asset_type,
                "quantity": payload.quantity,
                "average_cost": payload.average_cost,
            },
        )
        return HoldingRead.model_validate(rows[0])

    def list_holdings(self, user_id: UUID, portfolio_id: UUID) -> list[HoldingRead] | None:
        if self.get_portfolio(user_id, portfolio_id) is None:
            return None
        rows = self._request("GET", "holdings", {"select": "*", "portfolio_id": f"eq.{portfolio_id}"})
        return [HoldingRead.model_validate(row) for row in rows]

    def list_watchlists(self, user_id: UUID) -> list[WatchlistRead]:
        rows = self._request("GET", "watchlists", {"select": "*", "user_id": f"eq.{user_id}"})
        return [WatchlistRead.model_validate(row) for row in rows]

    def create_watchlist(self, user_id: UUID, payload: WatchlistCreate) -> WatchlistRead:
        rows = self._request("POST", "watchlists", body={"user_id": str(user_id), "name": payload.name})
        return WatchlistRead.model_validate(rows[0])

    def get_watchlist(self, user_id: UUID, watchlist_id: UUID) -> WatchlistRead | None:
        rows = self._request(
            "GET",
            "watchlists",
            {"select": "*", "id": f"eq.{watchlist_id}", "user_id": f"eq.{user_id}", "limit": "1"},
        )
        return WatchlistRead.model_validate(rows[0]) if rows else None

    def add_watchlist_asset(
        self, user_id: UUID, watchlist_id: UUID, payload: WatchlistAssetCreate
    ) -> WatchlistAssetRead | None:
        if self.get_watchlist(user_id, watchlist_id) is None:
            return None
        rows = self._request(
            "POST",
            "watchlist_assets",
            body={"watchlist_id": str(watchlist_id), "symbol": payload.symbol.upper(), "asset_type": payload.asset_type},
        )
        return WatchlistAssetRead.model_validate(rows[0])

    def list_watchlist_assets(self, user_id: UUID, watchlist_id: UUID) -> list[WatchlistAssetRead] | None:
        if self.get_watchlist(user_id, watchlist_id) is None:
            return None
        rows = self._request("GET", "watchlist_assets", {"select": "*", "watchlist_id": f"eq.{watchlist_id}"})
        return [WatchlistAssetRead.model_validate(row) for row in rows]

    def get_subscription(self, user_id: UUID) -> SubscriptionRead:
        rows = self._request("GET", "subscriptions", {"select": "*", "user_id": f"eq.{user_id}", "limit": "1"})
        return SubscriptionRead.model_validate(rows[0]) if rows else SubscriptionRead(user_id=user_id)

    def get_user_plan(self, user_id: UUID) -> Plan | None:
        subscription = self.get_subscription(user_id)
        if subscription.status in {"active", "trialing"}:
            return subscription.plan

        rows = self._request("GET", "profiles", {"select": "plan", "id": f"eq.{user_id}", "limit": "1"})
        if rows:
            try:
                return Plan(rows[0].get("plan", Plan.FREE.value))
            except ValueError:
                return Plan.FREE
        return None

    def upsert_subscription(
        self,
        user_id: UUID,
        *,
        stripe_customer_id: str | None = None,
        stripe_subscription_id: str | None = None,
        plan: Plan = Plan.FREE,
        status: str = "inactive",
        current_period_end: datetime | None = None,
    ) -> SubscriptionRead:
        existing = self.get_subscription(user_id)
        body = {
            "user_id": str(user_id),
            "stripe_customer_id": stripe_customer_id or existing.stripe_customer_id,
            "stripe_subscription_id": stripe_subscription_id or existing.stripe_subscription_id,
            "plan": plan.value,
            "status": status,
            "current_period_end": current_period_end.isoformat() if current_period_end else None,
        }
        if existing.status != "inactive" or existing.stripe_customer_id or existing.stripe_subscription_id:
            rows = self._request("PATCH", "subscriptions", {"user_id": f"eq.{user_id}"}, body=body)
        else:
            rows = self._request("POST", "subscriptions", body=body)

        effective_plan = plan if status in {"active", "trialing"} else Plan.FREE
        self._request("PATCH", "profiles", {"id": f"eq.{user_id}"}, body={"plan": effective_plan.value})
        return SubscriptionRead.model_validate(rows[0]) if rows else self.get_subscription(user_id)

    def find_subscription_by_customer(self, stripe_customer_id: str) -> SubscriptionRead | None:
        rows = self._request("GET", "subscriptions", {"select": "*", "stripe_customer_id": f"eq.{stripe_customer_id}", "limit": "1"})
        return SubscriptionRead.model_validate(rows[0]) if rows else None

    def find_subscription_by_stripe_subscription(self, stripe_subscription_id: str) -> SubscriptionRead | None:
        rows = self._request("GET", "subscriptions", {"select": "*", "stripe_subscription_id": f"eq.{stripe_subscription_id}", "limit": "1"})
        return SubscriptionRead.model_validate(rows[0]) if rows else None


def get_store(user: AuthenticatedUser | None = None) -> UserScopedStore | SupabaseRestStore:
    if user and user.is_guest:
        return store

    service_role_key = settings.secret_value("supabase_service_role_key")
    if settings.supabase_url and service_role_key:
        return SupabaseRestStore(settings.supabase_url, service_role_key)
    return store
