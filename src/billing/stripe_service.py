import hashlib
import hmac
import json
import time
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from uuid import UUID

from fastapi import HTTPException, status
from pydantic import BaseModel

from src.config import settings
from src.saas.models import Plan, SubscriptionRead
from src.saas.repository import get_store


CHECKOUT_PLANS = {Plan.PRO, Plan.TRADER, Plan.QUANT, Plan.EXECUTION_ADDON}
ACTIVE_STRIPE_STATUSES = {"active", "trialing"}


class CheckoutSessionCreate(BaseModel):
    plan: Plan


class BillingPortalCreate(BaseModel):
    return_url: str | None = None


class BillingSessionResponse(BaseModel):
    url: str


class BillingSubscriptionResponse(BaseModel):
    subscription: SubscriptionRead
    publishable_plan: Plan
    configured: bool


def price_id_for_plan(plan: Plan) -> str:
    mapping = {
        Plan.PRO: settings.stripe_price_pro,
        Plan.TRADER: settings.stripe_price_trader,
        Plan.QUANT: settings.stripe_price_quant,
        Plan.EXECUTION_ADDON: settings.stripe_price_execution_addon,
    }
    price_id = mapping.get(plan)
    if not price_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Stripe price ID is not configured for {plan.value}.",
        )
    return price_id


def plan_for_price_id(price_id: str | None) -> Plan:
    mapping = {
        settings.stripe_price_pro: Plan.PRO,
        settings.stripe_price_trader: Plan.TRADER,
        settings.stripe_price_quant: Plan.QUANT,
        settings.stripe_price_execution_addon: Plan.EXECUTION_ADDON,
    }
    return mapping.get(price_id, Plan.FREE)


def billing_configured() -> bool:
    return bool(settings.secret_value("stripe_secret_key") and settings.secret_value("stripe_webhook_secret"))


def create_checkout_session(user_id: UUID, email: str | None, plan: Plan) -> str:
    if plan not in CHECKOUT_PLANS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported billing plan")

    store = get_store()
    subscription = store.get_subscription(user_id)
    price_id = price_id_for_plan(plan)
    payload: dict[str, str] = {
        "mode": "subscription",
        "client_reference_id": str(user_id),
        "line_items[0][price]": price_id,
        "line_items[0][quantity]": "1",
        "success_url": f"{settings.frontend_url.rstrip('/')}/billing?checkout=success",
        "cancel_url": f"{settings.frontend_url.rstrip('/')}/billing?checkout=cancelled",
        "metadata[user_id]": str(user_id),
        "metadata[plan]": plan.value,
        "subscription_data[metadata][user_id]": str(user_id),
        "subscription_data[metadata][plan]": plan.value,
    }
    if subscription.stripe_customer_id:
        payload["customer"] = subscription.stripe_customer_id
    elif email:
        payload["customer_email"] = email

    session = stripe_request("POST", "/v1/checkout/sessions", payload)
    url = session.get("url")
    if not isinstance(url, str):
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Stripe did not return a checkout URL")
    return url


def create_portal_session(user_id: UUID, return_url: str | None = None) -> str:
    subscription = get_store().get_subscription(user_id)
    if not subscription.stripe_customer_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No Stripe customer found for this user")

    session = stripe_request(
        "POST",
        "/v1/billing_portal/sessions",
        {
            "customer": subscription.stripe_customer_id,
            "return_url": return_url or f"{settings.frontend_url.rstrip('/')}/billing",
        },
    )
    url = session.get("url")
    if not isinstance(url, str):
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Stripe did not return a portal URL")
    return url


def stripe_request(method: str, path: str, payload: dict[str, str] | None = None) -> dict[str, Any]:
    secret_key = settings.secret_value("stripe_secret_key")
    if not secret_key:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="STRIPE_SECRET_KEY is not configured")

    data = urlencode(payload or {}).encode("utf-8") if payload is not None else None
    request = Request(
        f"https://api.stripe.com{path}",
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {secret_key}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
    )
    try:
        with urlopen(request, timeout=20) as response:
            return json.loads(response.read().decode("utf-8"))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Stripe request failed: {exc}")


def verify_webhook_payload(payload: bytes, signature_header: str | None, tolerance_seconds: int = 300) -> dict[str, Any]:
    webhook_secret = settings.secret_value("stripe_webhook_secret")
    if not webhook_secret:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="STRIPE_WEBHOOK_SECRET is not configured")
    if not signature_header:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing Stripe signature")

    parts = {}
    for item in signature_header.split(","):
        key, _, value = item.partition("=")
        parts.setdefault(key, []).append(value)

    timestamp = parts.get("t", [None])[0]
    signatures = parts.get("v1", [])
    if not timestamp or not signatures:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid Stripe signature header")

    if abs(time.time() - int(timestamp)) > tolerance_seconds:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Expired Stripe webhook signature")

    signed_payload = f"{timestamp}.{payload.decode('utf-8')}".encode("utf-8")
    expected = hmac.new(webhook_secret.encode("utf-8"), signed_payload, hashlib.sha256).hexdigest()
    if not any(hmac.compare_digest(expected, signature) for signature in signatures):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid Stripe webhook signature")

    return json.loads(payload.decode("utf-8"))


def handle_stripe_event(event: dict[str, Any]) -> dict[str, str]:
    event_type = event.get("type")
    obj = (event.get("data") or {}).get("object") or {}

    if event_type == "checkout.session.completed":
        user_id = _user_id_from_obj(obj)
        if user_id:
            plan = Plan((obj.get("metadata") or {}).get("plan", Plan.FREE.value))
            get_store().upsert_subscription(
                user_id,
                stripe_customer_id=obj.get("customer"),
                stripe_subscription_id=obj.get("subscription"),
                plan=plan,
                status="active",
            )
        return {"status": "processed"}

    if event_type in {"customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"}:
        _sync_subscription_object(obj)
        return {"status": "processed"}

    if event_type == "invoice.paid":
        _sync_invoice_status(obj, "active")
        return {"status": "processed"}

    if event_type == "invoice.payment_failed":
        _sync_invoice_status(obj, "past_due")
        return {"status": "processed"}

    return {"status": "ignored"}


def _sync_subscription_object(obj: dict[str, Any]) -> None:
    user_id = _user_id_from_obj(obj)
    if not user_id:
        existing = get_store().find_subscription_by_customer(obj.get("customer", ""))
        user_id = existing.user_id if existing else None
    if not user_id:
        return

    status_value = obj.get("status") or "inactive"
    price_id = _subscription_price_id(obj)
    raw_plan = (obj.get("metadata") or {}).get("plan")
    plan = Plan(raw_plan) if raw_plan in {item.value for item in Plan} else plan_for_price_id(price_id)
    effective_plan = plan if status_value in ACTIVE_STRIPE_STATUSES else Plan.FREE
    get_store().upsert_subscription(
        user_id,
        stripe_customer_id=obj.get("customer"),
        stripe_subscription_id=obj.get("id"),
        plan=effective_plan,
        status=status_value,
        current_period_end=_datetime_from_timestamp(obj.get("current_period_end")),
    )


def _sync_invoice_status(obj: dict[str, Any], next_status: str) -> None:
    subscription_id = obj.get("subscription")
    customer_id = obj.get("customer")
    existing = None
    if subscription_id:
        existing = get_store().find_subscription_by_stripe_subscription(subscription_id)
    if existing is None and customer_id:
        existing = get_store().find_subscription_by_customer(customer_id)
    if existing is None:
        return
    get_store().upsert_subscription(
        existing.user_id,
        stripe_customer_id=customer_id or existing.stripe_customer_id,
        stripe_subscription_id=subscription_id or existing.stripe_subscription_id,
        plan=existing.plan if next_status in ACTIVE_STRIPE_STATUSES else Plan.FREE,
        status=next_status,
        current_period_end=existing.current_period_end,
    )


def _user_id_from_obj(obj: dict[str, Any]) -> UUID | None:
    raw = (obj.get("metadata") or {}).get("user_id") or obj.get("client_reference_id")
    if not raw:
        return None
    try:
        return UUID(raw)
    except ValueError:
        return None


def _subscription_price_id(obj: dict[str, Any]) -> str | None:
    items = ((obj.get("items") or {}).get("data") or [])
    if not items:
        return None
    price = items[0].get("price") or {}
    return price.get("id")


def _datetime_from_timestamp(value: Any) -> datetime | None:
    if value is None:
        return None
    return datetime.fromtimestamp(int(value), tz=timezone.utc)
