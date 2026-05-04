import hashlib
import hmac
import json
import time
from uuid import uuid4

from fastapi.testclient import TestClient
from pydantic import SecretStr

from src.auth.supabase import get_current_or_guest_user
from src.saas.models import AuthenticatedUser, Plan
from src.saas.repository import store


def _override_user(user_id, plan=Plan.FREE, is_guest=False):
    async def dependency():
        return AuthenticatedUser(id=user_id, email=f"{user_id}@example.com", plan=plan, is_guest=is_guest)

    return dependency


def _stripe_signature(payload: bytes, secret: str) -> str:
    timestamp = str(int(time.time()))
    signed_payload = f"{timestamp}.{payload.decode('utf-8')}".encode("utf-8")
    signature = hmac.new(secret.encode("utf-8"), signed_payload, hashlib.sha256).hexdigest()
    return f"t={timestamp},v1={signature}"


def test_checkout_session_uses_backend_price_id(monkeypatch):
    from src.api.app import app
    from src.billing import stripe_service

    user_id = uuid4()
    client = TestClient(app)
    store.reset()
    app.dependency_overrides[get_current_or_guest_user] = _override_user(user_id)

    monkeypatch.setattr(stripe_service.settings, "stripe_secret_key", SecretStr("sk_test_mock"))
    monkeypatch.setattr(stripe_service.settings, "stripe_price_pro", "price_pro_mock")

    captured = {}

    def fake_stripe_request(method, path, payload=None):
        captured.update({"method": method, "path": path, "payload": payload})
        return {"url": "https://checkout.stripe.test/session"}

    monkeypatch.setattr(stripe_service, "stripe_request", fake_stripe_request)

    response = client.post("/api/v1/billing/create-checkout-session", json={"plan": "pro"})

    assert response.status_code == 200
    assert response.json()["url"] == "https://checkout.stripe.test/session"
    assert captured["path"] == "/v1/checkout/sessions"
    assert captured["payload"]["line_items[0][price]"] == "price_pro_mock"
    assert captured["payload"]["metadata[user_id]"] == str(user_id)
    assert "price_pro_mock" not in json.dumps(response.json())

    app.dependency_overrides.clear()
    store.reset()


def test_guest_cannot_create_checkout_session():
    from src.api.app import app

    client = TestClient(app)
    store.reset()

    response = client.post("/api/v1/billing/create-checkout-session", json={"plan": "pro"})

    assert response.status_code == 401
    assert response.json()["detail"] == "Sign in to manage billing"
    store.reset()


def test_webhook_updates_subscription_and_effective_plan(monkeypatch):
    from src.api.app import app
    from src.billing import stripe_service

    user_id = uuid4()
    client = TestClient(app)
    store.reset()

    monkeypatch.setattr(stripe_service.settings, "stripe_webhook_secret", SecretStr("whsec_mock"))
    monkeypatch.setattr(stripe_service.settings, "stripe_price_trader", "price_trader_mock")

    event = {
        "type": "customer.subscription.updated",
        "data": {
            "object": {
                "id": "sub_mock",
                "customer": "cus_mock",
                "status": "active",
                "current_period_end": 1_800_000_000,
                "metadata": {"user_id": str(user_id), "plan": "trader"},
                "items": {"data": [{"price": {"id": "price_trader_mock"}}]},
            }
        },
    }
    payload = json.dumps(event).encode("utf-8")

    response = client.post(
        "/api/v1/billing/webhook",
        content=payload,
        headers={"stripe-signature": _stripe_signature(payload, "whsec_mock")},
    )

    assert response.status_code == 200
    subscription = store.get_subscription(user_id)
    assert subscription.plan == Plan.TRADER
    assert subscription.status == "active"
    assert subscription.stripe_customer_id == "cus_mock"
    assert subscription.stripe_subscription_id == "sub_mock"

    store.reset()
