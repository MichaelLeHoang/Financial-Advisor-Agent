from uuid import uuid4

from fastapi.testclient import TestClient

from src.auth.supabase import GUEST_USER_ID, get_current_or_guest_user
from src.saas.models import AuthenticatedUser, Plan
from src.saas.repository import store


def _override_user(user_id, plan=Plan.FREE):
    async def dependency():
        return AuthenticatedUser(id=user_id, email=f"{user_id}@example.com", plan=plan, is_guest=True)

    return dependency


def test_portfolio_routes_are_user_scoped():
    from src.api.app import app

    user_a = uuid4()
    user_b = uuid4()
    client = TestClient(app)
    store.reset()

    app.dependency_overrides[get_current_or_guest_user] = _override_user(user_a)
    created = client.post("/api/v1/portfolios", json={"name": "Core", "base_currency": "USD"})
    assert created.status_code == 201
    portfolio_id = created.json()["id"]

    app.dependency_overrides[get_current_or_guest_user] = _override_user(user_b)
    hidden = client.get("/api/v1/portfolios")
    assert hidden.status_code == 200
    assert hidden.json() == []

    scoped = client.get(f"/api/v1/portfolios/{portfolio_id}/holdings")
    assert scoped.status_code == 404

    app.dependency_overrides.clear()
    store.reset()


def test_watchlist_routes_are_user_scoped():
    from src.api.app import app

    user_a = uuid4()
    user_b = uuid4()
    client = TestClient(app)
    store.reset()

    app.dependency_overrides[get_current_or_guest_user] = _override_user(user_a)
    created = client.post("/api/v1/watchlists", json={"name": "Tech"})
    assert created.status_code == 201
    watchlist_id = created.json()["id"]
    asset = client.post(f"/api/v1/watchlists/{watchlist_id}/assets", json={"symbol": "AAPL"})
    assert asset.status_code == 201

    app.dependency_overrides[get_current_or_guest_user] = _override_user(user_b)
    hidden = client.get("/api/v1/watchlists")
    assert hidden.status_code == 200
    assert hidden.json() == []

    scoped = client.get(f"/api/v1/watchlists/{watchlist_id}/assets")
    assert scoped.status_code == 404

    app.dependency_overrides.clear()
    store.reset()


def test_routes_allow_anonymous_free_guest_access():
    from src.api.app import app

    client = TestClient(app)
    store.reset()

    me = client.get("/api/v1/me")
    assert me.status_code == 200
    assert me.json()["id"] == str(GUEST_USER_ID)
    assert me.json()["plan"] == "free"
    assert me.json()["is_guest"] is True

    created = client.post("/api/v1/portfolios", json={"name": "Guest Portfolio", "base_currency": "USD"})
    assert created.status_code == 201
    assert created.json()["user_id"] == str(GUEST_USER_ID)

    listed = client.get("/api/v1/portfolios")
    assert listed.status_code == 200
    assert len(listed.json()) == 1

    store.reset()


def test_free_plan_portfolio_limit_returns_upgrade_required():
    from src.api.app import app

    user_id = uuid4()
    client = TestClient(app)
    store.reset()

    app.dependency_overrides[get_current_or_guest_user] = _override_user(user_id)
    first = client.post("/api/v1/portfolios", json={"name": "Core", "base_currency": "USD"})
    second = client.post("/api/v1/portfolios", json={"name": "Satellite", "base_currency": "USD"})

    assert first.status_code == 201
    assert second.status_code == 403
    assert second.json()["detail"]["error"] == "upgrade_required"
    assert second.json()["detail"]["feature_key"] == "portfolio"

    app.dependency_overrides.clear()
    store.reset()
