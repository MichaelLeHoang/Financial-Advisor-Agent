from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from src.auth.supabase import get_current_or_guest_user
from src.saas.models import AuthenticatedUser, Plan
from src.saas.repository import store


def _override_user(user_id, *, is_guest=False, plan=Plan.FREE):
    async def dependency():
        return AuthenticatedUser(
            id=user_id,
            email=None if is_guest else f"{user_id}@example.com",
            plan=plan,
            is_guest=is_guest,
        )

    return dependency


@pytest.fixture(autouse=True)
def use_in_memory_store(monkeypatch):
    monkeypatch.setattr("src.saas.routes.get_store", lambda user=None: store)
    monkeypatch.setattr("src.investment_policy.routes.get_store", lambda user=None: store)
    yield
    from src.api.app import app

    app.dependency_overrides.clear()
    store.reset()


def test_policy_persists_and_validates_deterministic_portfolio_breaches():
    from src.api.app import app

    user_id = uuid4()
    client = TestClient(app)
    app.dependency_overrides[get_current_or_guest_user] = _override_user(user_id)

    portfolio = client.post("/api/v1/portfolios", json={"name": "Core"}).json()
    concentrated = client.post(
        f"/api/v1/portfolios/{portfolio['id']}/holdings",
        json={"symbol": "NVDA", "quantity": 9, "average_cost": 100},
    ).json()
    diversified = client.post(
        f"/api/v1/portfolios/{portfolio['id']}/holdings",
        json={"symbol": "MSFT", "quantity": 1, "average_cost": 100},
    ).json()
    for holding in (concentrated, diversified):
        assert client.patch(
            f"/api/v1/portfolios/{portfolio['id']}/holdings/{holding['id']}/classification",
            json={"book_type": "investment"},
        ).status_code == 200

    assert client.get("/api/v1/investment-policy").json() is None
    saved = client.put(
        "/api/v1/investment-policy",
        json={
            "name": "Long-term policy",
            "max_position_weight": 20,
            "max_sector_weight": 35,
            "max_drawdown": 18,
            "minimum_cash_weight": 5,
            "permitted_assets": ["equity", "cash", "equity"],
            "target_allocation": {"equity": 90, "cash": 5},
        },
    )
    assert saved.status_code == 200
    assert saved.json()["permitted_assets"] == ["cash", "equity"]
    assert client.get("/api/v1/investment-policy").json()["id"] == saved.json()["id"]

    validation = client.post(
        "/api/v1/investment-policy/validate",
        json={"portfolio_id": portfolio["id"]},
    )
    assert validation.status_code == 200
    body = validation.json()
    assert body["compliant"] is False
    alerts = {alert["code"]: alert for alert in body["alerts"]}
    assert alerts["max_position_weight"]["symbol"] == "NVDA"
    assert alerts["max_position_weight"]["observed"] == 90
    assert alerts["minimum_cash_weight"]["observed"] == 0
    assert alerts["target_allocation_total"]["observed"] == 95


def test_policy_validation_is_user_scoped_and_guests_cannot_persist():
    from src.api.app import app

    owner_id = uuid4()
    other_id = uuid4()
    client = TestClient(app)
    app.dependency_overrides[get_current_or_guest_user] = _override_user(owner_id)
    portfolio = client.post("/api/v1/portfolios", json={"name": "Private"}).json()
    assert client.put("/api/v1/investment-policy", json={}).status_code == 200

    app.dependency_overrides[get_current_or_guest_user] = _override_user(other_id)
    assert client.get("/api/v1/investment-policy").json() is None
    assert client.post(
        "/api/v1/investment-policy/validate",
        json={"portfolio_id": portfolio["id"]},
    ).status_code == 404

    app.dependency_overrides[get_current_or_guest_user] = _override_user(uuid4(), is_guest=True)
    assert client.get("/api/v1/investment-policy").status_code == 401
    assert client.put("/api/v1/investment-policy", json={}).status_code == 401


def test_policy_rejects_unknown_fields_and_non_finite_or_out_of_range_limits():
    from src.api.app import app

    client = TestClient(app)
    app.dependency_overrides[get_current_or_guest_user] = _override_user(uuid4())
    assert client.put("/api/v1/investment-policy", json={"max_position_weight": 0}).status_code == 422
    assert client.put("/api/v1/investment-policy", json={"max_position_weight": "NaN"}).status_code == 422
    assert client.put("/api/v1/investment-policy", json={"agent_override": True}).status_code == 422


def test_policy_weights_only_the_investment_book():
    from src.api.app import app

    user_id = uuid4()
    client = TestClient(app)
    app.dependency_overrides[get_current_or_guest_user] = _override_user(user_id)
    portfolio = client.post("/api/v1/portfolios", json={"name": "Mixed"}).json()
    investment = client.post(
        f"/api/v1/portfolios/{portfolio['id']}/holdings",
        json={"symbol": "NVDA", "quantity": 9, "average_cost": 100},
    ).json()
    trading = client.post(
        f"/api/v1/portfolios/{portfolio['id']}/holdings",
        json={"symbol": "AMD", "quantity": 100, "average_cost": 100},
    ).json()
    for holding, book in ((investment, "investment"), (trading, "trading")):
        client.patch(
            f"/api/v1/portfolios/{portfolio['id']}/holdings/{holding['id']}/classification",
            json={"book_type": book},
        )
    client.put(
        "/api/v1/investment-policy",
        json={"max_position_weight": 50, "minimum_cash_weight": 0},
    )

    result = client.post(
        "/api/v1/investment-policy/validate",
        json={"portfolio_id": portfolio["id"]},
    ).json()
    alert = next(item for item in result["alerts"] if item["code"] == "max_position_weight")
    assert alert["symbol"] == "NVDA"
    assert alert["observed"] == 100


def test_scope_validation_aggregates_same_symbol_across_portfolios():
    from src.api.app import app

    user_id = uuid4()
    client = TestClient(app)
    app.dependency_overrides[get_current_or_guest_user] = _override_user(user_id, plan=Plan.PRO)
    portfolio_ids = []
    for name, symbol, value in (("Brokerage", "NVDA", 600), ("Retirement", "NVDA", 400), ("Paper", "MSFT", 1000)):
        portfolio = client.post("/api/v1/portfolios", json={"name": name}).json()
        portfolio_ids.append(portfolio["id"])
        holding = client.post(
            f"/api/v1/portfolios/{portfolio['id']}/holdings",
            json={"symbol": symbol, "quantity": 1, "average_cost": value},
        ).json()
        client.patch(
            f"/api/v1/portfolios/{portfolio['id']}/holdings/{holding['id']}/classification",
            json={"book_type": "investment"},
        )
    client.put(
        "/api/v1/investment-policy",
        json={"max_position_weight": 40, "minimum_cash_weight": 0},
    )

    response = client.post(
        "/api/v1/investment-policy/validate-scope",
        json={"portfolio_ids": portfolio_ids},
    )
    assert response.status_code == 200
    nvda = next(item for item in response.json()["alerts"] if item["symbol"] == "NVDA")
    assert nvda["observed"] == 50
    assert len(nvda["holding_ids"]) == 2

    response = client.post(
        "/api/v1/investment-policy/validate-scope",
        json={"portfolio_ids": [*portfolio_ids, str(uuid4())]},
    )
    assert response.status_code == 404
