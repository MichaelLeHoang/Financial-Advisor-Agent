from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi.testclient import TestClient

from src.auth.supabase import get_current_or_guest_user
from src.notifications.evaluator import evaluate_active_alerts, evaluate_alert
from src.saas.models import AlertCreate, AuthenticatedUser, Plan
from src.saas.repository import get_store, store


def _use_memory_store(monkeypatch):
    from src.saas import repository

    monkeypatch.setattr(repository.settings, "supabase_url", None)
    monkeypatch.setattr(repository.settings, "supabase_service_role_key", None)


def _override_user(user_id, plan=Plan.TRADER):
    async def dependency():
        return AuthenticatedUser(id=user_id, email=f"{user_id}@example.com", plan=plan, is_guest=True)

    return dependency


class FakePriceProvider:
    def __init__(self, price: float) -> None:
        self.price = price

    def latest_price(self, symbol: str) -> float:
        return self.price


def test_free_plan_cannot_create_alert(monkeypatch):
    from src.api.app import app

    _use_memory_store(monkeypatch)
    user_id = uuid4()
    client = TestClient(app)
    app.dependency_overrides[get_current_or_guest_user] = _override_user(user_id, plan=Plan.FREE)

    response = client.post(
        "/api/v1/alerts",
        json={"name": "AAPL above 200", "alert_type": "price", "symbol": "AAPL", "condition": {"operator": "above", "price": 200}},
    )

    assert response.status_code == 403
    assert response.json()["detail"]["feature_key"] == "alerts"

    app.dependency_overrides.clear()
    store.reset()


def test_notification_channel_masks_secret_destination(monkeypatch):
    from src.api.app import app

    _use_memory_store(monkeypatch)
    user_id = uuid4()
    client = TestClient(app)
    app.dependency_overrides[get_current_or_guest_user] = _override_user(user_id, plan=Plan.TRADER)

    response = client.post(
        "/api/v1/notification-channels",
        json={
            "channel_type": "discord_webhook",
            "name": "Discord alerts",
            "destination": "https://discord.example/webhook/secret-token",
            "config": {"webhook_url": "https://discord.example/webhook/secret-token"},
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert "secret-token" not in str(data)
    assert data["destination_label"].endswith("...")
    assert data["config"]["webhook_url"] == "***"

    app.dependency_overrides.clear()
    store.reset()


def test_price_alert_evaluation_creates_event_and_deduplicates(monkeypatch):
    _use_memory_store(monkeypatch)
    user_id = uuid4()
    test_store = get_store()
    alert = test_store.create_alert(
        user_id,
        AlertCreate(
            name="AAPL breakout",
            alert_type="price",
            symbol="AAPL",
            condition={"operator": "above", "price": 200},
        ),
    )

    first = evaluate_active_alerts(FakePriceProvider(205))
    second = evaluate_active_alerts(FakePriceProvider(206))

    assert first == {"evaluated": 1, "triggered": 1}
    assert second == {"evaluated": 1, "triggered": 0}
    events = test_store.list_alert_events(user_id)
    assert len(events) == 1
    assert events[0].alert_id == alert.id
    assert "AAPL price condition triggered" in events[0].message

    store.reset()


def test_price_alert_respects_configured_repeat_interval():
    alert = AlertCreate(
        name="AAPL hourly",
        alert_type="price",
        symbol="AAPL",
        condition={"operator": "above", "price": 200, "cooldown_minutes": 60},
    )
    persisted = store.create_alert(uuid4(), alert).model_copy(
        update={"last_triggered_at": datetime.now(timezone.utc) - timedelta(minutes=90)}
    )

    event = evaluate_alert(persisted, FakePriceProvider(205))

    assert event is not None
    store.reset()


def test_trader_can_create_alert_and_list_events(monkeypatch):
    from src.api.app import app

    _use_memory_store(monkeypatch)
    user_id = uuid4()
    client = TestClient(app)
    app.dependency_overrides[get_current_or_guest_user] = _override_user(user_id, plan=Plan.TRADER)

    response = client.post(
        "/api/v1/alerts",
        json={"name": "MSFT risk watch", "alert_type": "price", "symbol": "MSFT", "condition": {"operator": "below", "price": 300}},
    )

    assert response.status_code == 200
    assert response.json()["symbol"] == "MSFT"
    assert client.get("/api/v1/alerts").json()[0]["name"] == "MSFT risk watch"
    assert client.get("/api/v1/alerts/events").status_code == 200

    app.dependency_overrides.clear()
    store.reset()


def test_alert_update_and_delete_are_owner_scoped(monkeypatch):
    from src.api.app import app

    _use_memory_store(monkeypatch)
    owner_id = uuid4()
    other_id = uuid4()
    client = TestClient(app)
    app.dependency_overrides[get_current_or_guest_user] = _override_user(owner_id, plan=Plan.TRADER)
    created = client.post(
        "/api/v1/alerts",
        json={"name": "AAPL watch", "alert_type": "price", "symbol": "AAPL", "condition": {"operator": "above", "price": 200}},
    ).json()

    updated = client.patch(
        f"/api/v1/alerts/{created['id']}",
        json={"name": "AAPL breakout", "condition": {"operator": "above", "price": 220}, "is_active": False},
    )

    assert updated.status_code == 200
    assert updated.json()["name"] == "AAPL breakout"
    assert updated.json()["condition"]["price"] == 220
    assert updated.json()["is_active"] is False

    app.dependency_overrides[get_current_or_guest_user] = _override_user(other_id, plan=Plan.TRADER)
    assert client.delete(f"/api/v1/alerts/{created['id']}").status_code == 404

    app.dependency_overrides[get_current_or_guest_user] = _override_user(owner_id, plan=Plan.TRADER)
    assert client.delete(f"/api/v1/alerts/{created['id']}").status_code == 204
    assert client.get("/api/v1/alerts").json() == []

    app.dependency_overrides.clear()
    store.reset()


def test_signed_in_user_can_opt_into_local_time_news_digest(monkeypatch):
    from src.api.app import app

    _use_memory_store(monkeypatch)
    user_id = uuid4()
    client = TestClient(app)

    async def signed_in_user():
        return AuthenticatedUser(id=user_id, email="reader@example.com", plan=Plan.FREE, is_guest=False)

    app.dependency_overrides[get_current_or_guest_user] = signed_in_user
    initial = client.get("/api/v1/news-digest/preferences")
    updated = client.put(
        "/api/v1/news-digest/preferences",
        json={"is_enabled": True, "timezone": "America/Toronto", "local_time": "08:30", "max_symbols": 12},
    )

    assert initial.status_code == 200
    assert initial.json()["is_enabled"] is False
    assert updated.status_code == 200
    assert updated.json()["email"] == "reader@example.com"
    assert updated.json()["local_time"] == "08:30"
    assert updated.json()["next_run_at"] is not None

    app.dependency_overrides.clear()
    store.reset()
