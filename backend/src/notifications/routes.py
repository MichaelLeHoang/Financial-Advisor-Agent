from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status

from src.auth.supabase import get_current_or_guest_user
from src.notifications.crypto import encrypt_json, encrypt_text
from src.notifications.evaluator import evaluate_active_alerts
from src.notifications.digest import next_digest_run
from src.saas.entitlements import FeatureKey, enforce_feature, get_entitlement, raise_upgrade_required
from src.saas.models import (
    AlertCreate,
    AlertEventRead,
    AlertRead,
    AlertUpdate,
    AuthenticatedUser,
    NotificationChannelCreate,
    NotificationChannelRead,
    NewsDigestPreferenceRead,
    NewsDigestPreferenceUpsert,
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


@router.patch("/alerts/{alert_id}", response_model=AlertRead)
async def update_alert(
    alert_id: UUID,
    payload: AlertUpdate,
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
) -> AlertRead:
    enforce_feature(user, FeatureKey.ALERTS)
    alert = get_store(user).update_alert(user.id, alert_id, payload)
    if alert is None:
        raise HTTPException(status_code=404, detail="Alert not found")
    return alert


@router.delete("/alerts/{alert_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_alert(
    alert_id: UUID,
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
) -> Response:
    enforce_feature(user, FeatureKey.ALERTS)
    if not get_store(user).delete_alert(user.id, alert_id):
        raise HTTPException(status_code=404, detail="Alert not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


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


@router.get("/news-digest/preferences", response_model=NewsDigestPreferenceRead)
async def get_news_digest_preferences(
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
) -> NewsDigestPreferenceRead:
    if user.is_guest:
        raise HTTPException(status_code=401, detail="Sign in to manage news digests")
    preference = get_store(user).get_news_digest_preference(user.id)
    if preference:
        return preference
    return NewsDigestPreferenceRead(user_id=user.id, email=user.email)


@router.put("/news-digest/preferences", response_model=NewsDigestPreferenceRead)
async def update_news_digest_preferences(
    payload: NewsDigestPreferenceUpsert,
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
) -> NewsDigestPreferenceRead:
    if user.is_guest:
        raise HTTPException(status_code=401, detail="Sign in to manage news digests")
    if payload.is_enabled and not user.email:
        raise HTTPException(status_code=400, detail="An account email is required")
    next_run_at = next_digest_run(payload.timezone, payload.local_time, datetime.now(timezone.utc)) if payload.is_enabled else None
    return get_store(user).upsert_news_digest_preference(user.id, user.email, payload, next_run_at)
