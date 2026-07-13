from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from src.auth.supabase import GUEST_USER_ID, get_current_or_guest_user
from src.saas.models import AuthenticatedUser, Plan
from src.saas.repository import store


@pytest.fixture(autouse=True)
def use_in_memory_saas_store(monkeypatch):
    monkeypatch.setattr("src.saas.routes.get_store", lambda user=None: store)
    yield
    try:
        from src.api.app import app

        app.dependency_overrides.clear()
    except Exception:
        pass
    store.reset()


def _override_user(user_id, plan=Plan.FREE, is_guest=False):
    async def dependency():
        return AuthenticatedUser(id=user_id, email=f"{user_id}@example.com", plan=plan, is_guest=is_guest)

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


def test_holding_cost_currency_is_persisted_and_defaults_to_portfolio_base():
    from src.api.app import app

    user_id = uuid4()
    client = TestClient(app)
    store.reset()

    app.dependency_overrides[get_current_or_guest_user] = _override_user(user_id)
    created = client.post("/api/v1/portfolios", json={"name": "Core", "base_currency": "CAD"})
    assert created.status_code == 201
    portfolio_id = created.json()["id"]

    defaulted = client.post(
        f"/api/v1/portfolios/{portfolio_id}/holdings",
        json={"symbol": "AAPL", "asset_type": "equity", "quantity": 2, "average_cost": 100},
    )
    assert defaulted.status_code == 201
    assert defaulted.json()["cost_currency"] == "CAD"

    explicit = client.post(
        f"/api/v1/portfolios/{portfolio_id}/holdings",
        json={"symbol": "RY", "asset_type": "equity", "quantity": 3, "average_cost": 80, "cost_currency": "usd"},
    )
    assert explicit.status_code == 201
    assert explicit.json()["cost_currency"] == "USD"

    holding_id = explicit.json()["id"]
    updated = client.patch(
        f"/api/v1/portfolios/{portfolio_id}/holdings/{holding_id}",
        json={"average_cost": 84, "cost_currency": "cad"},
    )
    assert updated.status_code == 200
    assert updated.json()["average_cost"] == 84
    assert updated.json()["cost_currency"] == "CAD"

    listed = client.get(f"/api/v1/portfolios/{portfolio_id}/holdings")
    assert listed.status_code == 200
    assert [holding["cost_currency"] for holding in listed.json()] == ["CAD", "CAD"]

    app.dependency_overrides.clear()
    store.reset()


def test_recurring_buy_syncs_linked_holding_and_delete_removes_both():
    from src.api.app import app

    user_id = uuid4()
    client = TestClient(app)
    store.reset()

    app.dependency_overrides[get_current_or_guest_user] = _override_user(user_id)
    created = client.post("/api/v1/portfolios", json={"name": "Core", "base_currency": "CAD"})
    assert created.status_code == 201
    portfolio_id = created.json()["id"]

    recurring = client.post(
        f"/api/v1/portfolios/{portfolio_id}/recurring-buys",
        json={
            "symbol": "nvda",
            "account": "TFSA",
            "entered_amount": 5,
            "entered_currency": "cad",
            "filled_quantity": 0.0177,
            "fill_price": 195.1999,
            "fill_currency": "usd",
            "exchange_rate": 1.446687,
            "purchase_mode": "amount",
            "recurrence_frequency": "weekly",
            "schedule_time": "10:15",
            "schedule_day_of_week": 2,
            "executed_at": "2026-07-07T16:05:00Z",
        },
    )
    assert recurring.status_code == 201
    body = recurring.json()
    assert body["symbol"] == "NVDA"
    assert body["entered_currency"] == "CAD"
    assert body["fill_currency"] == "USD"
    assert body["purchase_mode"] == "amount"
    assert body["recurrence_frequency"] == "weekly"
    assert body["schedule_time"] == "10:15"
    assert body["schedule_day_of_week"] == 2
    assert body["linked_holding_id"]

    holdings = client.get(f"/api/v1/portfolios/{portfolio_id}/holdings")
    assert holdings.status_code == 200
    assert holdings.json() == [
        {
            "id": body["linked_holding_id"],
            "portfolio_id": portfolio_id,
            "symbol": "NVDA",
            "asset_type": "equity",
            "quantity": 0.0177,
            "average_cost": 195.1999,
            "cost_currency": "USD",
            "book_type": "unclassified",
            "classification_source": "import",
            "classified_at": None,
            "classified_by": None,
            "created_at": holdings.json()[0]["created_at"],
        }
    ]

    deleted = client.delete(f"/api/v1/portfolios/{portfolio_id}/recurring-buys/{body['id']}")
    assert deleted.status_code == 204
    assert client.get(f"/api/v1/portfolios/{portfolio_id}/recurring-buys").json() == []
    assert client.get(f"/api/v1/portfolios/{portfolio_id}/holdings").json() == []

    app.dependency_overrides.clear()
    store.reset()


def test_portfolio_books_reconcile_and_classification_is_audited():
    from src.api.app import app

    user_id = uuid4()
    client = TestClient(app)
    store.reset()
    app.dependency_overrides[get_current_or_guest_user] = _override_user(user_id)

    created = client.post("/api/v1/portfolios", json={"name": "Core", "base_currency": "USD"})
    portfolio_id = created.json()["id"]
    holdings = []
    for symbol, quantity, average_cost in (("NVDA", 10, 100), ("MSFT", 5, 200), ("AMD", 4, 125)):
        response = client.post(
            f"/api/v1/portfolios/{portfolio_id}/holdings",
            json={"symbol": symbol, "quantity": quantity, "average_cost": average_cost},
        )
        assert response.status_code == 201
        holdings.append(response.json())

    for holding, book in zip(holdings[:2], ("investment", "trading"), strict=True):
        response = client.patch(
            f"/api/v1/portfolios/{portfolio_id}/holdings/{holding['id']}/classification",
            json={"book_type": book},
        )
        assert response.status_code == 200
        assert response.json()["book_type"] == book
        assert response.json()["classification_source"] == "user"
        assert response.json()["classified_by"] == str(user_id)
        assert response.json()["classified_at"] is not None

    summary = client.get(f"/api/v1/portfolios/{portfolio_id}/books")
    assert summary.status_code == 200
    body = summary.json()
    totals = {book["book_type"]: book for book in body["books"]}
    assert body["total_cost_basis"] == 2500
    assert sum(book["cost_basis"] for book in body["books"]) == body["total_cost_basis"]
    assert totals["investment"]["cost_basis"] == 1000
    assert totals["trading"]["cost_basis"] == 1000
    assert totals["unclassified"]["cost_basis"] == 500
    assert body["risk"]["unclassified_count"] == 1
    assert body["risk"]["unclassified_weight"] == 20
    assert body["risk"]["largest_position_weight"] == 40

    events = client.get(f"/api/v1/portfolios/{portfolio_id}/book-events")
    assert events.status_code == 200
    assert [event["symbol"] for event in events.json()] == ["MSFT", "NVDA"]
    assert events.json()[0]["previous_book_type"] == "unclassified"
    assert events.json()[0]["new_book_type"] == "trading"

    repeated = client.patch(
        f"/api/v1/portfolios/{portfolio_id}/holdings/{holdings[1]['id']}/classification",
        json={"book_type": "trading"},
    )
    assert repeated.status_code == 200
    assert len(client.get(f"/api/v1/portfolios/{portfolio_id}/book-events").json()) == 2


def test_portfolio_book_routes_reject_invalid_books_and_cross_user_access():
    from src.api.app import app

    owner_id = uuid4()
    other_id = uuid4()
    client = TestClient(app)
    store.reset()
    app.dependency_overrides[get_current_or_guest_user] = _override_user(owner_id)

    portfolio = client.post("/api/v1/portfolios", json={"name": "Core"}).json()
    holding = client.post(
        f"/api/v1/portfolios/{portfolio['id']}/holdings",
        json={"symbol": "NVDA", "quantity": 1, "average_cost": 100},
    ).json()
    invalid = client.patch(
        f"/api/v1/portfolios/{portfolio['id']}/holdings/{holding['id']}/classification",
        json={"book_type": "investment", "classification_source": "agent_suggestion"},
    )
    assert invalid.status_code == 422

    app.dependency_overrides[get_current_or_guest_user] = _override_user(other_id)
    assert client.get(f"/api/v1/portfolios/{portfolio['id']}/books").status_code == 404
    assert client.get(f"/api/v1/portfolios/{portfolio['id']}/book-events").status_code == 404
    assert client.patch(
        f"/api/v1/portfolios/{portfolio['id']}/holdings/{holding['id']}/classification",
        json={"book_type": "investment"},
    ).status_code == 404


def test_recurring_buy_routes_are_user_scoped():
    from src.api.app import app

    user_a = uuid4()
    user_b = uuid4()
    client = TestClient(app)
    store.reset()

    app.dependency_overrides[get_current_or_guest_user] = _override_user(user_a)
    created = client.post("/api/v1/portfolios", json={"name": "Core", "base_currency": "USD"})
    assert created.status_code == 201
    portfolio_id = created.json()["id"]
    recurring = client.post(
        f"/api/v1/portfolios/{portfolio_id}/recurring-buys",
        json={
            "symbol": "AAPL",
            "entered_amount": 10,
            "entered_currency": "USD",
            "filled_quantity": 0.05,
            "fill_price": 200,
            "fill_currency": "USD",
            "purchase_mode": "shares",
            "recurrence_frequency": "monthly",
            "schedule_time": "09:30",
            "schedule_day_of_month": 15,
        },
    )
    assert recurring.status_code == 201

    app.dependency_overrides[get_current_or_guest_user] = _override_user(user_b)
    scoped = client.get(f"/api/v1/portfolios/{portfolio_id}/recurring-buys")
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


def test_routes_restrict_anonymous_guest_persistence():
    from src.api.app import app

    client = TestClient(app)
    store.reset()

    me = client.get("/api/v1/me")
    assert me.status_code == 200
    assert me.json()["id"] == str(GUEST_USER_ID)
    assert me.json()["plan"] == "free"
    assert me.json()["is_guest"] is True

    created = client.post("/api/v1/portfolios", json={"name": "Guest Portfolio", "base_currency": "USD"})
    assert created.status_code == 401

    listed = client.get("/api/v1/portfolios")
    assert listed.status_code == 200
    assert listed.json() == []

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
