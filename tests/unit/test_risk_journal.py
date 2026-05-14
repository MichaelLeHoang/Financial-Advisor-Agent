from uuid import uuid4

import pandas as pd
from fastapi.testclient import TestClient

from src.auth.supabase import get_current_or_guest_user
from src.saas.models import AuthenticatedUser, HoldingCreate, Plan, PortfolioCreate
from src.saas.repository import get_store, store


def _use_memory_store(monkeypatch):
    from src.saas import repository

    monkeypatch.setattr(repository.settings, "supabase_url", None)
    monkeypatch.setattr(repository.settings, "supabase_service_role_key", None)


def _override_user(user_id, plan=Plan.PRO):
    async def dependency():
        return AuthenticatedUser(id=user_id, email=f"{user_id}@example.com", plan=plan, is_guest=True)

    return dependency


def _prices(values: list[float]) -> pd.Series:
    return pd.Series(values, index=pd.date_range("2025-01-01", periods=len(values), freq="D"))


def test_free_plan_cannot_use_risk_dashboard(monkeypatch):
    from src.api.app import app

    _use_memory_store(monkeypatch)
    user_id = uuid4()
    client = TestClient(app)
    app.dependency_overrides[get_current_or_guest_user] = _override_user(user_id, plan=Plan.FREE)

    response = client.get(f"/api/v1/risk/portfolios/{uuid4()}")

    assert response.status_code == 403
    assert response.json()["detail"]["feature_key"] == "risk_dashboard"

    app.dependency_overrides.clear()
    store.reset()


def test_pro_user_can_generate_risk_snapshot(monkeypatch):
    from src.api.app import app
    from src.risk import routes

    _use_memory_store(monkeypatch)
    user_id = uuid4()
    client = TestClient(app)
    store.reset()
    app.dependency_overrides[get_current_or_guest_user] = _override_user(user_id, plan=Plan.PRO)

    data_store = get_store()
    portfolio = data_store.create_portfolio(user_id, PortfolioCreate(name="Core", base_currency="USD"))
    data_store.add_holding(user_id, portfolio.id, HoldingCreate(symbol="AAPL", asset_type="equity", quantity=10, average_cost=100))
    data_store.add_holding(user_id, portfolio.id, HoldingCreate(symbol="BND", asset_type="bond", quantity=20, average_cost=80))

    class FakeProvider:
        def fetch_history(self, symbols, start_date, end_date):
            return {"AAPL": _prices([100, 103, 102, 105]), "BND": _prices([80, 80.5, 81, 82])}

    monkeypatch.setattr(routes, "YFinanceRiskDataProvider", FakeProvider)

    response = client.get(f"/api/v1/risk/portfolios/{portfolio.id}")

    assert response.status_code == 200
    snapshot = response.json()["snapshot"]
    assert snapshot["metrics"]["total_value"] == 2690
    assert snapshot["allocations"]["by_asset"]["AAPL"]["weight"] > 0
    assert "Risk snapshots are research tools" in response.json()["disclaimer"]

    app.dependency_overrides.clear()
    store.reset()


def test_trade_journal_requires_trader(monkeypatch):
    from src.api.app import app

    _use_memory_store(monkeypatch)
    user_id = uuid4()
    client = TestClient(app)
    app.dependency_overrides[get_current_or_guest_user] = _override_user(user_id, plan=Plan.PRO)

    response = client.post(
        "/api/v1/journal/entries",
        json={"symbol": "AAPL", "direction": "long", "entry_price": 100, "exit_price": 110, "quantity": 2, "fees": 1},
    )

    assert response.status_code == 403
    assert response.json()["detail"]["feature_key"] == "trade_journal"

    app.dependency_overrides.clear()
    store.reset()


def test_trader_can_create_journal_entry_and_view_analytics(monkeypatch):
    from src.api.app import app

    _use_memory_store(monkeypatch)
    user_id = uuid4()
    client = TestClient(app)
    store.reset()
    app.dependency_overrides[get_current_or_guest_user] = _override_user(user_id, plan=Plan.TRADER)

    response = client.post(
        "/api/v1/journal/entries",
        json={
            "symbol": "MSFT",
            "direction": "long",
            "entry_price": 100,
            "exit_price": 112,
            "quantity": 3,
            "fees": 2,
            "tags": ["breakout"],
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["pnl"] == 34
    assert data["return_pct"] == 0.113333

    analytics = client.get("/api/v1/journal/analytics")
    assert analytics.status_code == 200
    assert analytics.json()["total_pnl"] == 34
    assert analytics.json()["by_tag"]["breakout"]["count"] == 1

    app.dependency_overrides.clear()
    store.reset()
