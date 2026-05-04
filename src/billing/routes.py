from fastapi import APIRouter, Depends, HTTPException, Request, status

from src.auth.supabase import get_current_or_guest_user
from src.billing.stripe_service import (
    BillingPortalCreate,
    BillingSessionResponse,
    BillingSubscriptionResponse,
    CheckoutSessionCreate,
    billing_configured,
    create_checkout_session,
    create_portal_session,
    handle_stripe_event,
    verify_webhook_payload,
)
from src.saas.models import AuthenticatedUser, Plan
from src.saas.repository import get_store


router = APIRouter(prefix="/api/v1/billing", tags=["billing"])


def require_account(user: AuthenticatedUser) -> None:
    if user.is_guest:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sign in to manage billing")


@router.post("/create-checkout-session", response_model=BillingSessionResponse)
async def create_checkout(
    payload: CheckoutSessionCreate,
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
) -> BillingSessionResponse:
    require_account(user)
    return BillingSessionResponse(url=create_checkout_session(user.id, user.email, payload.plan))


@router.post("/create-customer-portal-session", response_model=BillingSessionResponse)
async def create_customer_portal(
    payload: BillingPortalCreate,
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
) -> BillingSessionResponse:
    require_account(user)
    return BillingSessionResponse(url=create_portal_session(user.id, payload.return_url))


@router.get("/subscription", response_model=BillingSubscriptionResponse)
async def read_subscription(
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
) -> BillingSubscriptionResponse:
    subscription = get_store(user).get_subscription(user.id)
    effective_plan = subscription.plan if subscription.status in {"active", "trialing"} else Plan.FREE
    return BillingSubscriptionResponse(
        subscription=subscription,
        publishable_plan=effective_plan,
        configured=billing_configured(),
    )


@router.post("/webhook")
async def stripe_webhook(request: Request) -> dict[str, str]:
    payload = await request.body()
    event = verify_webhook_payload(payload, request.headers.get("stripe-signature"))
    return handle_stripe_event(event)
