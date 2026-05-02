from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from src.auth.supabase import get_current_user
from src.saas.models import (
    AuthenticatedUser,
    HoldingCreate,
    HoldingRead,
    PortfolioCreate,
    PortfolioRead,
    WatchlistAssetCreate,
    WatchlistAssetRead,
    WatchlistCreate,
    WatchlistRead,
)
from src.saas.repository import get_store


router = APIRouter(prefix="/api/v1", tags=["saas"])


@router.get("/me", response_model=AuthenticatedUser)
async def read_current_user(user: AuthenticatedUser = Depends(get_current_user)) -> AuthenticatedUser:
    return user


@router.get("/portfolios", response_model=list[PortfolioRead])
async def list_portfolios(user: AuthenticatedUser = Depends(get_current_user)) -> list[PortfolioRead]:
    return get_store().list_portfolios(user.id)


@router.post("/portfolios", response_model=PortfolioRead, status_code=status.HTTP_201_CREATED)
async def create_portfolio(
    payload: PortfolioCreate,
    user: AuthenticatedUser = Depends(get_current_user),
) -> PortfolioRead:
    return get_store().create_portfolio(user.id, payload)


@router.get("/portfolios/{portfolio_id}/holdings", response_model=list[HoldingRead])
async def list_holdings(
    portfolio_id: UUID,
    user: AuthenticatedUser = Depends(get_current_user),
) -> list[HoldingRead]:
    holdings = get_store().list_holdings(user.id, portfolio_id)
    if holdings is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Portfolio not found")
    return holdings


@router.post("/portfolios/{portfolio_id}/holdings", response_model=HoldingRead, status_code=status.HTTP_201_CREATED)
async def create_holding(
    portfolio_id: UUID,
    payload: HoldingCreate,
    user: AuthenticatedUser = Depends(get_current_user),
) -> HoldingRead:
    holding = get_store().add_holding(user.id, portfolio_id, payload)
    if holding is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Portfolio not found")
    return holding


@router.get("/watchlists", response_model=list[WatchlistRead])
async def list_watchlists(user: AuthenticatedUser = Depends(get_current_user)) -> list[WatchlistRead]:
    return get_store().list_watchlists(user.id)


@router.post("/watchlists", response_model=WatchlistRead, status_code=status.HTTP_201_CREATED)
async def create_watchlist(
    payload: WatchlistCreate,
    user: AuthenticatedUser = Depends(get_current_user),
) -> WatchlistRead:
    return get_store().create_watchlist(user.id, payload)


@router.get("/watchlists/{watchlist_id}/assets", response_model=list[WatchlistAssetRead])
async def list_watchlist_assets(
    watchlist_id: UUID,
    user: AuthenticatedUser = Depends(get_current_user),
) -> list[WatchlistAssetRead]:
    assets = get_store().list_watchlist_assets(user.id, watchlist_id)
    if assets is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Watchlist not found")
    return assets


@router.post("/watchlists/{watchlist_id}/assets", response_model=WatchlistAssetRead, status_code=status.HTTP_201_CREATED)
async def create_watchlist_asset(
    watchlist_id: UUID,
    payload: WatchlistAssetCreate,
    user: AuthenticatedUser = Depends(get_current_user),
) -> WatchlistAssetRead:
    asset = get_store().add_watchlist_asset(user.id, watchlist_id, payload)
    if asset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Watchlist not found")
    return asset
