from fastapi import APIRouter, Depends

from src.auth.supabase import get_current_or_guest_user
from src.notifications.crypto import encrypt_json, encrypt_text
from src.notifications.evaluator import evaluate_active_alerts
from src.saas.entitlements import FeatureKey, enforce_feature, get_entitlement, raise_upgrade_required
from src.saas.models import (
    AlertCreate,
    AlertEventRead,
    AlertRead,
    AuthenticatedUser,
    NotificationChannelCreate,
    NotificationChannelRead,
)
from src.saas.repository import get_store


router = APIRouter(prefix="/api/v1", tags=["notifications"])


@router.get("/notification-channels", response_model=list[NotificationChannelRead])
async def list_notification_channels(
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
) -> list[NotificationChannelRead]:
    enforce_feature(user, FeatureKey.ALERTS)
    return get_store(user).list_notification_channels(user.id)


@router.post("/notification-channels", response_model=NotificationChannelRead)
async def create_notification_channel(
    payload: NotificationChannelCreate,
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
) -> NotificationChannelRead:
    enforce_feature(user, FeatureKey.ALERTS)
    return get_store(user).create_notification_channel(
        user.id,
        payload,
        encrypted_destination=encrypt_text(payload.destination),
        encrypted_config=encrypt_json(payload.config),
    )


@router.get("/alerts", response_model=list[AlertRead])
async def list_alerts(user: AuthenticatedUser = Depends(get_current_or_guest_user)) -> list[AlertRead]:
    enforce_feature(user, FeatureKey.ALERTS)
    return get_store(user).list_alerts(user.id)


@router.post("/alerts", response_model=AlertRead)
async def create_alert(
    payload: AlertCreate,
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
) -> AlertRead:
    enforce_feature(user, FeatureKey.ALERTS)
    current_count = len(get_store(user).list_alerts(user.id))
    limit = get_entitlement(user.plan).limits.get("alerts")
    if limit is not None and current_count >= limit:
        raise_upgrade_required(
            FeatureKey.ALERTS,
            user.plan,
            message="You have reached the alert limit for your current plan.",
            metadata={"limit": limit, "used": current_count},
        )
    return get_store(user).create_alert(user.id, payload)


@router.get("/alerts/events", response_model=list[AlertEventRead])
async def list_alert_events(
    limit: int = 20,
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
) -> list[AlertEventRead]:
    enforce_feature(user, FeatureKey.ALERTS)
    return get_store(user).list_alert_events(user.id, limit=max(1, min(limit, 50)))


@router.post("/alerts/evaluate")
async def evaluate_alerts(user: AuthenticatedUser = Depends(get_current_or_guest_user)) -> dict[str, int]:
    enforce_feature(user, FeatureKey.ALERTS)
    return evaluate_active_alerts()
