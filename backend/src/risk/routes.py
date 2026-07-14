from datetime import date, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from src.auth.supabase import get_current_or_guest_user
from src.risk.calculations import calculate_portfolio_risk
from src.risk.market_data import YFinanceRiskDataProvider
from src.saas.entitlements import FeatureKey, enforce_feature
from src.saas.models import AuthenticatedUser, PositionBook, RiskSnapshotCreate, RiskSnapshotRead
from src.saas.repository import get_store


router = APIRouter(prefix="/api/v1/risk", tags=["risk"])


class RiskSnapshotResponse(BaseModel):
    snapshot: RiskSnapshotRead
    disclaimer: str = "Risk snapshots are research tools, not financial advice. Historical risk does not guarantee future outcomes."


@router.get("/portfolios/{portfolio_id}", response_model=RiskSnapshotResponse)
async def create_portfolio_risk_snapshot(
    portfolio_id: UUID,
    lookback_days: int = 365,
    book: PositionBook | None = None,
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
) -> RiskSnapshotResponse:
    enforce_feature(user, FeatureKey.RISK_DASHBOARD)
    data_store = get_store(user)
    portfolio = data_store.get_portfolio(user.id, portfolio_id)
    if portfolio is None:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    holdings = data_store.list_holdings(user.id, portfolio_id)
    if holdings is None:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    if book is not None:
        holdings = [holding for holding in holdings if holding.book_type == book]

    end_date = date.today() + timedelta(days=1)
    start_date = end_date - timedelta(days=max(30, min(lookback_days, 1095)))
    try:
        history = YFinanceRiskDataProvider().fetch_history([holding.symbol for holding in holdings], start_date, end_date)
        snapshot_payload = calculate_portfolio_risk(portfolio, holdings, history)
        if book is not None:
            snapshot_payload["metrics"]["book_type"] = book.value
        snapshot = data_store.create_risk_snapshot(
            user.id,
            RiskSnapshotCreate(portfolio_id=portfolio_id, **snapshot_payload),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Unable to calculate portfolio risk: {exc}") from exc

    return RiskSnapshotResponse(snapshot=snapshot)


@router.get("/portfolios/{portfolio_id}/snapshots", response_model=list[RiskSnapshotRead])
async def list_portfolio_risk_snapshots(
    portfolio_id: UUID,
    limit: int = 10,
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
) -> list[RiskSnapshotRead]:
    enforce_feature(user, FeatureKey.RISK_DASHBOARD)
    return get_store(user).list_risk_snapshots(user.id, portfolio_id, limit=max(1, min(limit, 30)))
