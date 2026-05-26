from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from src.auth.supabase import get_current_or_guest_user
from src.saas.entitlements import FeatureKey, enforce_feature, get_entitlement, raise_upgrade_required
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
async def read_current_user(user: AuthenticatedUser = Depends(get_current_or_guest_user)) -> AuthenticatedUser:
    return user


@router.get("/portfolios", response_model=list[PortfolioRead])
async def list_portfolios(user: AuthenticatedUser = Depends(get_current_or_guest_user)) -> list[PortfolioRead]:
    return get_store(user).list_portfolios(user.id)


@router.post("/portfolios", response_model=PortfolioRead, status_code=status.HTTP_201_CREATED)
async def create_portfolio(
    payload: PortfolioCreate,
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
) -> PortfolioRead:
    enforce_feature(user, FeatureKey.PORTFOLIO)
    current_count = len(get_store(user).list_portfolios(user.id))
    limit = get_entitlement(user.plan).limits.get("portfolios")
    if limit is not None and current_count >= limit:
        raise_upgrade_required(
            FeatureKey.PORTFOLIO,
            user.plan,
            message="You have reached the portfolio limit for your current plan.",
            metadata={"limit": limit, "used": current_count},
        )
    return get_store(user).create_portfolio(user.id, payload)


@router.get("/portfolios/{portfolio_id}/holdings", response_model=list[HoldingRead])
async def list_holdings(
    portfolio_id: UUID,
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
) -> list[HoldingRead]:
    holdings = get_store(user).list_holdings(user.id, portfolio_id)
    if holdings is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Portfolio not found")
    return holdings


@router.post("/portfolios/{portfolio_id}/holdings", response_model=HoldingRead, status_code=status.HTTP_201_CREATED)
async def create_holding(
    portfolio_id: UUID,
    payload: HoldingCreate,
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
) -> HoldingRead:
    holding = get_store(user).add_holding(user.id, portfolio_id, payload)
    if holding is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Portfolio not found")
    return holding


@router.get("/watchlists", response_model=list[WatchlistRead])
async def list_watchlists(user: AuthenticatedUser = Depends(get_current_or_guest_user)) -> list[WatchlistRead]:
    return get_store(user).list_watchlists(user.id)


@router.post("/watchlists", response_model=WatchlistRead, status_code=status.HTTP_201_CREATED)
async def create_watchlist(
    payload: WatchlistCreate,
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
) -> WatchlistRead:
    enforce_feature(user, FeatureKey.WATCHLIST)
    current_count = len(get_store(user).list_watchlists(user.id))
    limit = get_entitlement(user.plan).limits.get("watchlists")
    if limit is not None and current_count >= limit:
        raise_upgrade_required(
            FeatureKey.WATCHLIST,
            user.plan,
            message="You have reached the watchlist limit for your current plan.",
            metadata={"limit": limit, "used": current_count},
        )
    return get_store(user).create_watchlist(user.id, payload)


@router.get("/watchlists/{watchlist_id}/assets", response_model=list[WatchlistAssetRead])
async def list_watchlist_assets(
    watchlist_id: UUID,
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
) -> list[WatchlistAssetRead]:
    assets = get_store(user).list_watchlist_assets(user.id, watchlist_id)
    if assets is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Watchlist not found")
    return assets


@router.post("/watchlists/{watchlist_id}/assets", response_model=WatchlistAssetRead, status_code=status.HTTP_201_CREATED)
async def create_watchlist_asset(
    watchlist_id: UUID,
    payload: WatchlistAssetCreate,
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
) -> WatchlistAssetRead:
    enforce_feature(user, FeatureKey.WATCHLIST_ASSET)
    current_assets = get_store(user).list_watchlist_assets(user.id, watchlist_id)
    if current_assets is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Watchlist not found")

    limit = get_entitlement(user.plan).limits.get("watchlist_assets")
    if limit is not None and len(current_assets) >= limit:
        raise_upgrade_required(
            FeatureKey.WATCHLIST_ASSET,
            user.plan,
            message="You have reached the watchlist asset limit for your current plan.",
            metadata={"limit": limit, "used": len(current_assets)},
        )

    asset = get_store(user).add_watchlist_asset(user.id, watchlist_id, payload)
    if asset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Watchlist not found")
    return asset
