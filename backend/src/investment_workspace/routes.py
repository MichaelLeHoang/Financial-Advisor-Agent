from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from src.auth.supabase import get_current_or_guest_user
from src.investment_workspace.models import (
    InvestmentDecisionCreate,
    InvestmentDecisionRead,
    InvestmentThesisRead,
    InvestmentThesisUpsert,
)
from src.saas.models import AuthenticatedUser, HoldingRead, PositionBook
from src.saas.repository import get_store


router = APIRouter(prefix="/api/v1", tags=["investment-workspace"])


def require_signed_in(user: AuthenticatedUser) -> None:
    if user.is_guest:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sign in to save investment records.")


def require_investment_holding(user: AuthenticatedUser, holding_id: UUID) -> HoldingRead:
    store = get_store(user)
    holding = store.get_holding_by_id(user.id, holding_id)
    if holding is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Holding not found")
    if holding.book_type != PositionBook.INVESTMENT:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only Investment holdings can have investment theses or decisions.",
        )
    return holding


@router.get("/investment-theses", response_model=list[InvestmentThesisRead])
async def list_investment_theses(
    portfolio_id: UUID | None = Query(default=None),
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
) -> list[InvestmentThesisRead]:
    require_signed_in(user)
    if portfolio_id is not None and get_store(user).get_portfolio(user.id, portfolio_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Portfolio not found")
    return get_store(user).list_investment_theses(user.id, portfolio_id)


@router.put("/investment-theses/{holding_id}", response_model=InvestmentThesisRead)
async def upsert_investment_thesis(
    holding_id: UUID,
    payload: InvestmentThesisUpsert,
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
) -> InvestmentThesisRead:
    require_signed_in(user)
    holding = require_investment_holding(user, holding_id)
    return get_store(user).upsert_investment_thesis(user.id, holding, payload)


@router.get("/investment-decisions", response_model=list[InvestmentDecisionRead])
async def list_investment_decisions(
    portfolio_id: UUID | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
) -> list[InvestmentDecisionRead]:
    require_signed_in(user)
    if portfolio_id is not None and get_store(user).get_portfolio(user.id, portfolio_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Portfolio not found")
    return get_store(user).list_investment_decisions(user.id, portfolio_id, limit)


@router.post("/investment-decisions", response_model=InvestmentDecisionRead, status_code=status.HTTP_201_CREATED)
async def create_investment_decision(
    payload: InvestmentDecisionCreate,
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
) -> InvestmentDecisionRead:
    require_signed_in(user)
    holding = require_investment_holding(user, payload.holding_id)
    return get_store(user).create_investment_decision(user.id, holding, payload)
