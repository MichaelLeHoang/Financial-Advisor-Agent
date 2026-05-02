from enum import Enum
from typing import Any

from fastapi import Depends, HTTPException, status
from pydantic import BaseModel, Field

from src.auth.supabase import get_current_or_guest_user
from src.saas.models import AuthenticatedUser, Plan


class FeatureKey(str, Enum):
    AI_RESEARCH = "ai_research"
    SENTIMENT = "sentiment"
    ML_PREDICTION = "ml_prediction"
    CLASSICAL_OPTIMIZATION = "classical_optimization"
    QUANTUM_OPTIMIZATION = "quantum_optimization"
    PORTFOLIO = "portfolio"
    WATCHLIST = "watchlist"
    WATCHLIST_ASSET = "watchlist_asset"
    BACKTESTING = "backtesting"
    ALERTS = "alerts"
    TRADE_JOURNAL = "trade_journal"
    PREMIUM_LLM = "premium_llm"


class PlanEntitlement(BaseModel):
    plan: Plan
    features: set[FeatureKey] = Field(default_factory=set)
    limits: dict[str, int] = Field(default_factory=dict)


PLAN_ORDER: list[Plan] = [
    Plan.FREE,
    Plan.PRO,
    Plan.TRADER,
    Plan.QUANT,
    Plan.EXECUTION_ADDON,
]

PLAN_ENTITLEMENTS: dict[Plan, PlanEntitlement] = {
    Plan.FREE: PlanEntitlement(
        plan=Plan.FREE,
        features={
            FeatureKey.AI_RESEARCH,
            FeatureKey.SENTIMENT,
            FeatureKey.PORTFOLIO,
            FeatureKey.WATCHLIST,
            FeatureKey.WATCHLIST_ASSET,
        },
        limits={
            "ai_messages_per_day": 10,
            "sentiment_requests_per_day": 5,
            "portfolios": 1,
            "watchlists": 1,
            "watchlist_assets": 5,
        },
    ),
    Plan.PRO: PlanEntitlement(
        plan=Plan.PRO,
        features={
            FeatureKey.AI_RESEARCH,
            FeatureKey.SENTIMENT,
            FeatureKey.CLASSICAL_OPTIMIZATION,
            FeatureKey.PORTFOLIO,
            FeatureKey.WATCHLIST,
            FeatureKey.WATCHLIST_ASSET,
        },
        limits={
            "ai_messages_per_day": 100,
            "sentiment_requests_per_day": 50,
            "portfolios": 5,
            "watchlists": 5,
            "watchlist_assets": 50,
        },
    ),
    Plan.TRADER: PlanEntitlement(
        plan=Plan.TRADER,
        features={
            FeatureKey.AI_RESEARCH,
            FeatureKey.SENTIMENT,
            FeatureKey.ML_PREDICTION,
            FeatureKey.CLASSICAL_OPTIMIZATION,
            FeatureKey.PORTFOLIO,
            FeatureKey.WATCHLIST,
            FeatureKey.WATCHLIST_ASSET,
            FeatureKey.BACKTESTING,
            FeatureKey.ALERTS,
            FeatureKey.TRADE_JOURNAL,
        },
        limits={
            "ai_messages_per_day": 250,
            "sentiment_requests_per_day": 150,
            "portfolios": 10,
            "watchlists": 10,
            "watchlist_assets": 150,
            "alerts": 30,
        },
    ),
    Plan.QUANT: PlanEntitlement(
        plan=Plan.QUANT,
        features=set(FeatureKey),
        limits={
            "ai_messages_per_day": 750,
            "sentiment_requests_per_day": 500,
            "portfolios": 25,
            "watchlists": 25,
            "watchlist_assets": 500,
            "alerts": 100,
        },
    ),
    Plan.EXECUTION_ADDON: PlanEntitlement(
        plan=Plan.EXECUTION_ADDON,
        features=set(FeatureKey),
        limits={
            "ai_messages_per_day": 1000,
            "sentiment_requests_per_day": 750,
            "portfolios": 50,
            "watchlists": 50,
            "watchlist_assets": 1000,
            "alerts": 200,
        },
    ),
}


def get_entitlement(plan: Plan) -> PlanEntitlement:
    return PLAN_ENTITLEMENTS.get(plan, PLAN_ENTITLEMENTS[Plan.FREE])


def required_plan_for(feature_key: FeatureKey) -> Plan:
    for plan in PLAN_ORDER:
        if feature_key in get_entitlement(plan).features:
            return plan
    return Plan.QUANT


def feature_allowed(plan: Plan, feature_key: FeatureKey) -> bool:
    return feature_key in get_entitlement(plan).features


def upgrade_required_detail(
    feature_key: FeatureKey,
    current_plan: Plan,
    message: str | None = None,
    required_plan: Plan | None = None,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "error": "upgrade_required",
        "feature_key": feature_key.value,
        "current_plan": current_plan.value,
        "required_plan": (required_plan or required_plan_for(feature_key)).value,
        "message": message or "Upgrade your plan to use this feature.",
        "metadata": metadata or {},
    }


def raise_upgrade_required(
    feature_key: FeatureKey,
    current_plan: Plan,
    message: str | None = None,
    required_plan: Plan | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=upgrade_required_detail(feature_key, current_plan, message, required_plan, metadata),
    )


def enforce_feature(user: AuthenticatedUser, feature_key: FeatureKey) -> None:
    if not feature_allowed(user.plan, feature_key):
        raise_upgrade_required(feature_key, user.plan)


def require_feature(feature_key: FeatureKey):
    async def dependency(user: AuthenticatedUser = Depends(get_current_or_guest_user)) -> AuthenticatedUser:
        enforce_feature(user, feature_key)
        return user

    return dependency
