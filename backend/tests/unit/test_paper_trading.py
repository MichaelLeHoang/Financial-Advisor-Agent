from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from src.auth.supabase import get_current_or_guest_user
from src.paper_trading.models import PaperQuoteTick
from src.paper_trading.repository import paper_store
from src.saas.models import AuthenticatedUser, Plan


@pytest.fixture(autouse=True)
def reset_paper_store(monkeypatch):
    monkeypatch.setattr("src.paper_trading.routes.get_paper_store", lambda user: paper_store)
    paper_store.reset()
    yield
    paper_store.reset()
    from src.api.app import app

    app.dependency_overrides.clear()


def _override_user(user_id, *, is_guest=False):
    async def dependency():
        return AuthenticatedUser(
            id=user_id,
            email=None if is_guest else f"{user_id}@example.com",
            plan=Plan.FREE,
            is_guest=is_guest,
        )

    return dependency


def _client_for(user_id):
    from src.api.app import app

    app.dependency_overrides[get_current_or_guest_user] = _override_user(user_id)
    return TestClient(app)


def test_market_order_debits_cash_creates_fill_position_and_ledger(monkeypatch):
    client = _client_for(uuid4())
    monkeypatch.setattr(
        "src.paper_trading.routes.fetch_quote",
        lambda symbol: PaperQuoteTick(price=100, high=101, low=99),
    )

    accounts = client.get("/api/v1/paper/accounts")
    assert accounts.status_code == 200
    account_id = accounts.json()[0]["id"]

    submitted = client.post(
        f"/api/v1/paper/accounts/{account_id}/orders",
        json={"symbol": "aapl", "side": "buy", "quantity": 10, "order_type": "market"},
    )
    assert submitted.status_code == 201
    assert submitted.json()["status"] == "filled"
    assert submitted.json()["average_fill_price"] == 100

    snapshot = client.get(f"/api/v1/paper/accounts/{account_id}/snapshot")
    assert snapshot.status_code == 200
    body = snapshot.json()
    assert body["summary"]["cash_available"] == 99_000
    assert body["summary"]["equity"] == 100_000
    assert body["positions"][0]["symbol"] == "AAPL"
    assert body["positions"][0]["quantity"] == 10
    assert len(body["fills"]) == 1
    assert [entry["entry_type"] for entry in body["ledger"]] == ["buy", "deposit"]


def test_limit_order_reserves_cash_then_fills_when_candle_crosses(monkeypatch):
    quote = PaperQuoteTick(price=100, high=101, low=99)
    monkeypatch.setattr("src.paper_trading.routes.fetch_quote", lambda symbol: quote)
    client = _client_for(uuid4())
    account_id = client.get("/api/v1/paper/accounts").json()[0]["id"]

    submitted = client.post(
        f"/api/v1/paper/accounts/{account_id}/orders",
        json={
            "symbol": "NVDA",
            "side": "buy",
            "quantity": 5,
            "order_type": "limit",
            "limit_price": 90,
            "time_in_force": "gtc",
        },
    )
    assert submitted.status_code == 201
    assert submitted.json()["status"] == "open"
    assert client.get(f"/api/v1/paper/accounts/{account_id}/summary").json()["cash_reserved"] == 450

    quote.price = 89
    quote.high = 91
    quote.low = 88
    refreshed = client.post(f"/api/v1/paper/accounts/{account_id}/refresh")
    assert refreshed.status_code == 200
    assert refreshed.json()["orders"][0]["status"] == "filled"
    assert refreshed.json()["summary"]["cash_reserved"] == 0
    assert refreshed.json()["summary"]["cash_available"] == 99_555


def test_cancel_releases_reserved_cash_and_rejects_uncovered_sell(monkeypatch):
    monkeypatch.setattr(
        "src.paper_trading.routes.fetch_quote",
        lambda symbol: PaperQuoteTick(price=100, high=101, low=99),
    )
    client = _client_for(uuid4())
    account_id = client.get("/api/v1/paper/accounts").json()[0]["id"]
    order = client.post(
        f"/api/v1/paper/accounts/{account_id}/orders",
        json={"symbol": "AMD", "side": "buy", "quantity": 2, "order_type": "stop", "stop_price": 105},
    ).json()

    canceled = client.post(f"/api/v1/paper/orders/{order['id']}/cancel")
    assert canceled.status_code == 200
    assert canceled.json()["status"] == "canceled"
    assert client.get(f"/api/v1/paper/accounts/{account_id}/summary").json()["cash_reserved"] == 0

    rejected = client.post(
        f"/api/v1/paper/accounts/{account_id}/orders",
        json={"symbol": "AMD", "side": "sell", "quantity": 1, "order_type": "market"},
    )
    assert rejected.status_code == 409
    assert "already held" in rejected.json()["detail"]


def test_sell_updates_cash_and_realized_pnl(monkeypatch):
    quote = PaperQuoteTick(price=100)
    monkeypatch.setattr("src.paper_trading.routes.fetch_quote", lambda symbol: quote)
    client = _client_for(uuid4())
    account_id = client.get("/api/v1/paper/accounts").json()[0]["id"]
    client.post(
        f"/api/v1/paper/accounts/{account_id}/orders",
        json={"symbol": "AMD", "side": "buy", "quantity": 10, "order_type": "market"},
    )

    quote.price = 110
    sold = client.post(
        f"/api/v1/paper/accounts/{account_id}/orders",
        json={"symbol": "AMD", "side": "sell", "quantity": 4, "order_type": "market"},
    )
    assert sold.status_code == 201
    snapshot = client.get(f"/api/v1/paper/accounts/{account_id}/snapshot").json()
    assert snapshot["summary"]["cash_available"] == 99_440
    assert snapshot["summary"]["realized_pnl"] == 40
    assert snapshot["positions"][0]["quantity"] == 6


def test_open_sell_orders_cannot_reserve_more_shares_than_the_position(monkeypatch):
    quote = PaperQuoteTick(price=100, high=101, low=99)
    monkeypatch.setattr("src.paper_trading.routes.fetch_quote", lambda symbol: quote)
    client = _client_for(uuid4())
    account_id = client.get("/api/v1/paper/accounts").json()[0]["id"]
    client.post(
        f"/api/v1/paper/accounts/{account_id}/orders",
        json={"symbol": "AMD", "side": "buy", "quantity": 10, "order_type": "market"},
    )

    first = client.post(
        f"/api/v1/paper/accounts/{account_id}/orders",
        json={"symbol": "AMD", "side": "sell", "quantity": 7, "order_type": "limit", "limit_price": 120},
    )
    assert first.status_code == 201
    assert first.json()["status"] == "open"

    second = client.post(
        f"/api/v1/paper/accounts/{account_id}/orders",
        json={"symbol": "AMD", "side": "sell", "quantity": 4, "order_type": "limit", "limit_price": 125},
    )
    assert second.status_code == 409
    assert "already held" in second.json()["detail"]


def test_gapped_stop_rejects_without_spending_cash_reserved_for_another_order(monkeypatch):
    quotes = {"AAA": PaperQuoteTick(price=100, high=101, low=99), "BBB": PaperQuoteTick(price=100, high=101, low=99)}
    monkeypatch.setattr("src.paper_trading.routes.fetch_quote", lambda symbol: quotes[symbol])
    client = _client_for(uuid4())
    account_id = client.get("/api/v1/paper/accounts").json()[0]["id"]
    client.post(
        f"/api/v1/paper/accounts/{account_id}/orders",
        json={"symbol": "AAA", "side": "buy", "quantity": 100, "order_type": "limit", "limit_price": 600},
    )
    client.post(
        f"/api/v1/paper/accounts/{account_id}/orders",
        json={"symbol": "BBB", "side": "buy", "quantity": 100, "order_type": "stop", "stop_price": 400},
    )

    quotes["AAA"] = PaperQuoteTick(price=700, high=710, low=690)
    quotes["BBB"] = PaperQuoteTick(price=500, high=510, low=490)
    refreshed = client.post(f"/api/v1/paper/accounts/{account_id}/refresh")

    assert refreshed.status_code == 200
    body = refreshed.json()
    statuses = {order["symbol"]: order["status"] for order in body["orders"]}
    assert statuses == {"AAA": "open", "BBB": "rejected"}
    assert body["summary"]["cash_reserved"] == 60_000
    assert body["summary"]["cash_available"] == 40_000


def test_accounts_are_owner_scoped_and_guests_require_matching_session(monkeypatch):
    from src.api.app import app

    user_a = uuid4()
    user_b = uuid4()
    client = _client_for(user_a)
    account_id = client.get("/api/v1/paper/accounts").json()[0]["id"]

    app.dependency_overrides[get_current_or_guest_user] = _override_user(user_b)
    assert client.get(f"/api/v1/paper/accounts/{account_id}/summary").status_code == 404

    app.dependency_overrides[get_current_or_guest_user] = _override_user(uuid4(), is_guest=True)
    assert client.get("/api/v1/paper/accounts").status_code == 400
    headers = {"X-Guest-Session-Id": "guest-session-alpha"}
    guest_account = client.get("/api/v1/paper/accounts", headers=headers)
    assert guest_account.status_code == 200
    guest_account_id = guest_account.json()[0]["id"]
    assert client.get(
        f"/api/v1/paper/accounts/{guest_account_id}/summary",
        headers={"X-Guest-Session-Id": "guest-session-other"},
    ).status_code == 404
