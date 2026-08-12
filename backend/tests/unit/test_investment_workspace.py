from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from src.auth.supabase import get_current_or_guest_user
from src.saas.models import AuthenticatedUser, Plan
from src.saas.repository import store


def _override_user(user_id, *, is_guest=False):
    async def dependency():
        return AuthenticatedUser(
            id=user_id,
            email=None if is_guest else f"{user_id}@example.com",
            plan=Plan.FREE,
            is_guest=is_guest,
        )
    return dependency


@pytest.fixture(autouse=True)
def use_in_memory_store(monkeypatch):
    monkeypatch.setattr("src.saas.routes.get_store", lambda user=None: store)
    monkeypatch.setattr("src.investment_workspace.routes.get_store", lambda user=None: store)
    yield
    from src.api.app import app
    app.dependency_overrides.clear()
    store.reset()


def _investment_holding(client: TestClient):
    portfolio = client.post("/api/v1/portfolios", json={"name": "Core"}).json()
    holding = client.post(
        f"/api/v1/portfolios/{portfolio['id']}/holdings",
        json={"symbol": "NVDA", "quantity": 5, "average_cost": 100},
    ).json()
    client.patch(
        f"/api/v1/portfolios/{portfolio['id']}/holdings/{holding['id']}/classification",
        json={"book_type": "investment"},
    )
    return portfolio, holding


def test_thesis_upsert_and_decision_history_are_owner_scoped():
    from src.api.app import app

    owner_id = uuid4()
    other_id = uuid4()
    client = TestClient(app)
    app.dependency_overrides[get_current_or_guest_user] = _override_user(owner_id)
    portfolio, holding = _investment_holding(client)

    thesis_payload = {
        "statement": "Accelerated computing demand supports durable earnings growth.",
        "supporting_evidence": ["Software switching costs"],
        "risk_evidence": ["Customer concentration"],
        "invalidation_conditions": ["Data-center growth falls below 10%"],
        "next_review_at": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
    }
    first = client.put(f"/api/v1/investment-theses/{holding['id']}", json=thesis_payload)
    assert first.status_code == 200
    updated = client.put(
        f"/api/v1/investment-theses/{holding['id']}",
        json={**thesis_payload, "statement": "Updated owner thesis."},
    )
    assert updated.status_code == 200
    assert updated.json()["id"] == first.json()["id"]
    assert len(client.get(f"/api/v1/investment-theses?portfolio_id={portfolio['id']}").json()) == 1

    decision = client.post(
        "/api/v1/investment-decisions",
        json={"holding_id": holding["id"], "action": "hold", "rationale": "Thesis remains intact."},
    )
    assert decision.status_code == 201
    assert client.post(
        "/api/v1/investment-decisions",
        json={"holding_id": holding["id"], "action": "trim", "rationale": "Reduce concentration."},
    ).status_code == 201
    assert len(client.get("/api/v1/investment-decisions?limit=10").json()) == 2

    app.dependency_overrides[get_current_or_guest_user] = _override_user(other_id)
    assert client.get(f"/api/v1/investment-theses?portfolio_id={portfolio['id']}").status_code == 404
    assert client.put(f"/api/v1/investment-theses/{holding['id']}", json=thesis_payload).status_code == 404


def test_records_require_investment_book_and_signed_in_user():
    from src.api.app import app

    user_id = uuid4()
    client = TestClient(app)
    app.dependency_overrides[get_current_or_guest_user] = _override_user(user_id)
    portfolio = client.post("/api/v1/portfolios", json={"name": "Core"}).json()
    holding = client.post(
        f"/api/v1/portfolios/{portfolio['id']}/holdings",
        json={"symbol": "AMD", "quantity": 2, "average_cost": 90},
    ).json()
    payload = {"statement": "Long-term thesis."}
    assert client.put(f"/api/v1/investment-theses/{holding['id']}", json=payload).status_code == 409
    assert client.post(
        "/api/v1/investment-decisions",
        json={"holding_id": holding["id"], "action": "buy", "rationale": "Invalid action."},
    ).status_code == 422

    app.dependency_overrides[get_current_or_guest_user] = _override_user(uuid4(), is_guest=True)
    assert client.get("/api/v1/investment-theses").status_code == 401
    assert client.get("/api/v1/investment-decisions").status_code == 401
