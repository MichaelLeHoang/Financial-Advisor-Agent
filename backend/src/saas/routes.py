from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from src.auth.supabase import get_current_or_guest_user
from src.saas.entitlements import FeatureKey, enforce_feature, get_entitlement, raise_upgrade_required
from src.saas.models import (
    AuthenticatedUser,
    HoldingCreate,
    HoldingRead,
    HoldingUpdate,
    PortfolioCreate,
    PortfolioRead,
    RecurringBuyCreate,
    RecurringBuyRead,
    RecurringBuyUpdate,
    WatchlistAssetCreate,
    WatchlistAssetRead,
    WatchlistCreate,
    WatchlistRead,
)
from src.saas.repository import get_store


router = APIRouter(prefix="/api/v1", tags=["saas"])


def require_signed_in(user: AuthenticatedUser) -> None:
    if user.is_guest:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sign in to save workspace data.")


@router.get("/me", response_model=AuthenticatedUser)
async def read_current_user(user: AuthenticatedUser = Depends(get_current_or_guest_user)) -> AuthenticatedUser:
    return user


@router.get("/portfolios", response_model=list[PortfolioRead])
async def list_portfolios(user: AuthenticatedUser = Depends(get_current_or_guest_user)) -> list[PortfolioRead]:
    if user.is_guest:
        return []
    return get_store(user).list_portfolios(user.id)


@router.post("/portfolios", response_model=PortfolioRead, status_code=status.HTTP_201_CREATED)
async def create_portfolio(
    payload: PortfolioCreate,
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
) -> PortfolioRead:
    require_signed_in(user)
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


@router.delete("/portfolios/{portfolio_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_portfolio(
    portfolio_id: UUID,
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
) -> None:
    require_signed_in(user)
    removed = get_store(user).delete_portfolio(user.id, portfolio_id)
    if not removed:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Portfolio not found")


@router.get("/portfolios/{portfolio_id}/holdings", response_model=list[HoldingRead])
async def list_holdings(
    portfolio_id: UUID,
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
) -> list[HoldingRead]:
    if user.is_guest:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sign in to view saved portfolio holdings.")
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
    require_signed_in(user)
    holding = get_store(user).add_holding(user.id, portfolio_id, payload)
    if holding is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Portfolio not found")
    return holding


@router.patch("/portfolios/{portfolio_id}/holdings/{holding_id}", response_model=HoldingRead)
async def update_holding(
    portfolio_id: UUID,
    holding_id: UUID,
    payload: HoldingUpdate,
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
) -> HoldingRead:
    require_signed_in(user)
    holding = get_store(user).update_holding(user.id, portfolio_id, holding_id, payload)
    if holding is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Holding not found")
    return holding


@router.delete("/portfolios/{portfolio_id}/holdings/{holding_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_holding(
    portfolio_id: UUID,
    holding_id: UUID,
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
) -> None:
    require_signed_in(user)
    removed = get_store(user).delete_holding(user.id, portfolio_id, holding_id)
    if not removed:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Holding not found")


@router.get("/portfolios/{portfolio_id}/recurring-buys", response_model=list[RecurringBuyRead])
async def list_recurring_buys(
    portfolio_id: UUID,
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
) -> list[RecurringBuyRead]:
    if user.is_guest:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sign in to view saved recurring buys.")
    recurring_buys = get_store(user).list_recurring_buys(user.id, portfolio_id)
    if recurring_buys is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Portfolio not found")
    return recurring_buys


@router.post("/portfolios/{portfolio_id}/recurring-buys", response_model=RecurringBuyRead, status_code=status.HTTP_201_CREATED)
async def create_recurring_buy(
    portfolio_id: UUID,
    payload: RecurringBuyCreate,
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
) -> RecurringBuyRead:
    require_signed_in(user)
    recurring_buy = get_store(user).add_recurring_buy(user.id, portfolio_id, payload)
    if recurring_buy is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Portfolio not found")
    return recurring_buy


@router.patch("/portfolios/{portfolio_id}/recurring-buys/{recurring_buy_id}", response_model=RecurringBuyRead)
async def update_recurring_buy(
    portfolio_id: UUID,
    recurring_buy_id: UUID,
    payload: RecurringBuyUpdate,
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
) -> RecurringBuyRead:
    require_signed_in(user)
    recurring_buy = get_store(user).update_recurring_buy(user.id, portfolio_id, recurring_buy_id, payload)
    if recurring_buy is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recurring buy not found")
    return recurring_buy


@router.delete("/portfolios/{portfolio_id}/recurring-buys/{recurring_buy_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_recurring_buy(
    portfolio_id: UUID,
    recurring_buy_id: UUID,
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
) -> None:
    require_signed_in(user)
    removed = get_store(user).delete_recurring_buy(user.id, portfolio_id, recurring_buy_id)
    if not removed:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recurring buy not found")


@router.get("/watchlists", response_model=list[WatchlistRead])
async def list_watchlists(user: AuthenticatedUser = Depends(get_current_or_guest_user)) -> list[WatchlistRead]:
    if user.is_guest:
        return []
    return get_store(user).list_watchlists(user.id)


@router.post("/watchlists", response_model=WatchlistRead, status_code=status.HTTP_201_CREATED)
async def create_watchlist(
    payload: WatchlistCreate,
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
) -> WatchlistRead:
    require_signed_in(user)
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


@router.delete("/watchlists/{watchlist_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_watchlist(
    watchlist_id: UUID,
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
) -> None:
    require_signed_in(user)
    removed = get_store(user).delete_watchlist(user.id, watchlist_id)
    if not removed:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Watchlist not found")


@router.get("/watchlists/{watchlist_id}/assets", response_model=list[WatchlistAssetRead])
async def list_watchlist_assets(
    watchlist_id: UUID,
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
) -> list[WatchlistAssetRead]:
    if user.is_guest:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sign in to view saved watchlist assets.")
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
    require_signed_in(user)
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


@router.delete("/watchlists/{watchlist_id}/assets/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_watchlist_asset(
    watchlist_id: UUID,
    asset_id: UUID,
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
) -> None:
    require_signed_in(user)
    removed = get_store(user).remove_watchlist_asset(user.id, watchlist_id, asset_id)
    if not removed:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")
