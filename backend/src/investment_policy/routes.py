from fastapi import APIRouter, Depends, HTTPException, status

from src.auth.supabase import get_current_or_guest_user
from src.investment_policy.models import (
    InvestmentPolicyRead,
    InvestmentPolicyScopeValidationRead,
    InvestmentPolicyScopeValidationRequest,
    InvestmentPolicyUpsert,
    InvestmentPolicyValidationRead,
    InvestmentPolicyValidationRequest,
)
from src.investment_policy.validator import validate_investment_policy, validate_investment_policy_scope
from src.saas.models import AuthenticatedUser
from src.saas.repository import get_store


router = APIRouter(prefix="/api/v1/investment-policy", tags=["investment-policy"])


def require_signed_in(user: AuthenticatedUser) -> None:
    if user.is_guest:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sign in to save an investment policy.")


@router.get("", response_model=InvestmentPolicyRead | None)
async def read_investment_policy(
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
) -> InvestmentPolicyRead | None:
    require_signed_in(user)
    return get_store(user).get_investment_policy(user.id)


@router.put("", response_model=InvestmentPolicyRead)
async def upsert_investment_policy(
    payload: InvestmentPolicyUpsert,
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
) -> InvestmentPolicyRead:
    require_signed_in(user)
    return get_store(user).upsert_investment_policy(user.id, payload)


@router.post("/validate", response_model=InvestmentPolicyValidationRead)
async def validate_saved_investment_policy(
    payload: InvestmentPolicyValidationRequest,
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
) -> InvestmentPolicyValidationRead:
    require_signed_in(user)
    store = get_store(user)
    policy = store.get_investment_policy(user.id)
    if policy is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Investment policy not found")
    holdings = store.list_holdings(user.id, payload.portfolio_id)
    if holdings is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Portfolio not found")
    return validate_investment_policy(policy, payload.portfolio_id, holdings)


@router.post("/validate-scope", response_model=InvestmentPolicyScopeValidationRead)
async def validate_saved_investment_policy_scope(
    payload: InvestmentPolicyScopeValidationRequest,
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
) -> InvestmentPolicyScopeValidationRead:
    require_signed_in(user)
    store = get_store(user)
    policy = store.get_investment_policy(user.id)
    if policy is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Investment policy not found")
    holdings_by_portfolio = []
    for portfolio_id in list(dict.fromkeys(payload.portfolio_ids)):
        holdings = store.list_holdings(user.id, portfolio_id)
        if holdings is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Portfolio not found")
        holdings_by_portfolio.append((portfolio_id, holdings))
    return validate_investment_policy_scope(policy, holdings_by_portfolio)
