from uuid import uuid4

from fastapi.testclient import TestClient

from src.auth.supabase import get_current_user
from src.saas.models import AuthenticatedUser, Plan
from src.saas.repository import store


def _override_user(user_id):
    async def dependency():
        return AuthenticatedUser(id=user_id, email=f"{user_id}@example.com", plan=Plan.FREE)

    return dependency


def test_portfolio_routes_are_user_scoped():
    from src.api.app import app

    user_a = uuid4()
    user_b = uuid4()
    client = TestClient(app)
    store.reset()

    app.dependency_overrides[get_current_user] = _override_user(user_a)
    created = client.post("/api/v1/portfolios", json={"name": "Core", "base_currency": "USD"})
    assert created.status_code == 201
    portfolio_id = created.json()["id"]

    app.dependency_overrides[get_current_user] = _override_user(user_b)
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

    app.dependency_overrides[get_current_user] = _override_user(user_a)
    created = client.post("/api/v1/watchlists", json={"name": "Tech"})
    assert created.status_code == 201
    watchlist_id = created.json()["id"]
    asset = client.post(f"/api/v1/watchlists/{watchlist_id}/assets", json={"symbol": "AAPL"})
    assert asset.status_code == 201

    app.dependency_overrides[get_current_user] = _override_user(user_b)
    hidden = client.get("/api/v1/watchlists")
    assert hidden.status_code == 200
    assert hidden.json() == []

    scoped = client.get(f"/api/v1/watchlists/{watchlist_id}/assets")
    assert scoped.status_code == 404

    app.dependency_overrides.clear()
    store.reset()
