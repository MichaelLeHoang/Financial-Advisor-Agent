from uuid import uuid4

from fastapi.testclient import TestClient

from src.auth.supabase import get_current_or_guest_user
from src.notifications.evaluator import evaluate_active_alerts
from src.saas.models import AlertCreate, AuthenticatedUser, NotificationChannelCreate, Plan
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
