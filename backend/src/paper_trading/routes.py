import asyncio
import re
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, status

from src.auth.supabase import get_current_or_guest_user
from src.data.market_data_service import market_data_service
from src.paper_trading.models import (
    PaperAccountCreate,
    PaperAccountRead,
    PaperAccountSnapshot,
    PaperAccountSummary,
    PaperCashLedgerRead,
    PaperFillRead,
    PaperOrderCreate,
    PaperOrderRead,
    PaperOwner,
    PaperPositionRead,
    PaperQuoteTick,
)
from src.paper_trading.repository import (
    get_paper_store,
    PaperAccountNotFound,
    PaperOrderNotFound,
    PaperOrderRejected,
)
from src.saas.models import AuthenticatedUser


router = APIRouter(prefix="/api/v1/paper", tags=["paper-trading"])
GUEST_SESSION_HEADER = "X-Guest-Session-Id"


def _owner(
    user: AuthenticatedUser,
    guest_session_id: str | None,
) -> PaperOwner:
    if not user.is_guest:
        return PaperOwner(user_id=user.id)
    normalized = re.sub(r"[^A-Za-z0-9._:-]", "", guest_session_id or "")[:128]
    if len(normalized) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A valid guest session is required for paper trading.",
        )
    return PaperOwner(guest_owner_id=normalized)


def fetch_quote(symbol: str) -> PaperQuoteTick:
    snapshot = market_data_service.fetch_snapshot(
        symbol,
        period="1d",
        interval="5m",
        include_news=False,
        include_sec=False,
        include_fundamentals=False,
    )
    price = snapshot.latest_price or (snapshot.history[-1].price if snapshot.history else None)
    if price is None or price <= 0:
        raise ValueError(f"No market quote is available for {symbol}")
    latest = snapshot.history[-1] if snapshot.history else None
    return PaperQuoteTick(
        price=float(price),
        high=float(latest.high) if latest and latest.high else snapshot.day_high,
        low=float(latest.low) if latest and latest.low else snapshot.day_low,
    )


def _not_found(error: Exception) -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error))


def _rejected(error: Exception) -> HTTPException:
    return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error))


@router.get("/accounts", response_model=list[PaperAccountRead])
async def list_accounts(
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
    x_guest_session_id: str | None = Header(default=None, alias=GUEST_SESSION_HEADER),
) -> list[PaperAccountRead]:
    owner = _owner(user, x_guest_session_id)
    store = get_paper_store(user)
    store.ensure_default_account(owner)
    return store.list_accounts(owner)


@router.post("/accounts", response_model=PaperAccountRead, status_code=status.HTTP_201_CREATED)
async def create_account(
    payload: PaperAccountCreate,
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
    x_guest_session_id: str | None = Header(default=None, alias=GUEST_SESSION_HEADER),
) -> PaperAccountRead:
    return get_paper_store(user).create_account(_owner(user, x_guest_session_id), payload)


@router.get("/accounts/{account_id}/summary", response_model=PaperAccountSummary)
async def account_summary(
    account_id: UUID,
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
    x_guest_session_id: str | None = Header(default=None, alias=GUEST_SESSION_HEADER),
) -> PaperAccountSummary:
    try:
        return get_paper_store(user).summary(_owner(user, x_guest_session_id), account_id)
    except PaperAccountNotFound as error:
        raise _not_found(error) from error


@router.get("/accounts/{account_id}/snapshot", response_model=PaperAccountSnapshot)
async def account_snapshot(
    account_id: UUID,
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
    x_guest_session_id: str | None = Header(default=None, alias=GUEST_SESSION_HEADER),
) -> PaperAccountSnapshot:
    owner = _owner(user, x_guest_session_id)
    store = get_paper_store(user)
    try:
        return PaperAccountSnapshot(
            summary=store.summary(owner, account_id),
            orders=store.list_orders(owner, account_id),
            fills=store.list_fills(owner, account_id),
            positions=store.list_positions(owner, account_id),
            ledger=store.list_ledger(owner, account_id),
        )
    except PaperAccountNotFound as error:
        raise _not_found(error) from error


@router.get("/accounts/{account_id}/orders", response_model=list[PaperOrderRead])
async def list_orders(
    account_id: UUID,
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
    x_guest_session_id: str | None = Header(default=None, alias=GUEST_SESSION_HEADER),
) -> list[PaperOrderRead]:
    try:
        return get_paper_store(user).list_orders(_owner(user, x_guest_session_id), account_id)
    except PaperAccountNotFound as error:
        raise _not_found(error) from error


@router.post("/accounts/{account_id}/orders", response_model=PaperOrderRead, status_code=status.HTTP_201_CREATED)
async def submit_order(
    account_id: UUID,
    payload: PaperOrderCreate,
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
    x_guest_session_id: str | None = Header(default=None, alias=GUEST_SESSION_HEADER),
) -> PaperOrderRead:
    try:
        quote = await asyncio.to_thread(fetch_quote, payload.symbol)
        return get_paper_store(user).submit_order(_owner(user, x_guest_session_id), account_id, payload, quote)
    except PaperAccountNotFound as error:
        raise _not_found(error) from error
    except (PaperOrderRejected, ValueError) as error:
        raise _rejected(error) from error


@router.post("/orders/{order_id}/cancel", response_model=PaperOrderRead)
async def cancel_order(
    order_id: UUID,
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
    x_guest_session_id: str | None = Header(default=None, alias=GUEST_SESSION_HEADER),
) -> PaperOrderRead:
    try:
        return get_paper_store(user).cancel_order(_owner(user, x_guest_session_id), order_id)
    except (PaperOrderNotFound, PaperAccountNotFound) as error:
        raise _not_found(error) from error
    except PaperOrderRejected as error:
        raise _rejected(error) from error


@router.get("/accounts/{account_id}/fills", response_model=list[PaperFillRead])
async def list_fills(
    account_id: UUID,
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
    x_guest_session_id: str | None = Header(default=None, alias=GUEST_SESSION_HEADER),
) -> list[PaperFillRead]:
    try:
        return get_paper_store(user).list_fills(_owner(user, x_guest_session_id), account_id)
    except PaperAccountNotFound as error:
        raise _not_found(error) from error


@router.get("/accounts/{account_id}/positions", response_model=list[PaperPositionRead])
async def list_positions(
    account_id: UUID,
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
    x_guest_session_id: str | None = Header(default=None, alias=GUEST_SESSION_HEADER),
) -> list[PaperPositionRead]:
    try:
        return get_paper_store(user).list_positions(_owner(user, x_guest_session_id), account_id)
    except PaperAccountNotFound as error:
        raise _not_found(error) from error


@router.get("/accounts/{account_id}/ledger", response_model=list[PaperCashLedgerRead])
async def list_ledger(
    account_id: UUID,
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
    x_guest_session_id: str | None = Header(default=None, alias=GUEST_SESSION_HEADER),
) -> list[PaperCashLedgerRead]:
    try:
        return get_paper_store(user).list_ledger(_owner(user, x_guest_session_id), account_id)
    except PaperAccountNotFound as error:
        raise _not_found(error) from error


@router.post("/accounts/{account_id}/refresh", response_model=PaperAccountSnapshot)
async def refresh_account(
    account_id: UUID,
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
    x_guest_session_id: str | None = Header(default=None, alias=GUEST_SESSION_HEADER),
) -> PaperAccountSnapshot:
    owner = _owner(user, x_guest_session_id)
    store = get_paper_store(user)
    try:
        symbols = {
            *(order.symbol for order in store.list_orders(owner, account_id) if order.status == "open"),
            *(position.symbol for position in store.list_positions(owner, account_id)),
        }
        quote_rows = await asyncio.gather(
            *(asyncio.to_thread(fetch_quote, symbol) for symbol in symbols),
            return_exceptions=True,
        )
        quotes = {
            symbol: quote
            for symbol, quote in zip(symbols, quote_rows)
            if isinstance(quote, PaperQuoteTick)
        }
        store.refresh_orders(owner, account_id, quotes)
        return PaperAccountSnapshot(
            summary=store.summary(owner, account_id),
            orders=store.list_orders(owner, account_id),
            fills=store.list_fills(owner, account_id),
            positions=store.list_positions(owner, account_id),
            ledger=store.list_ledger(owner, account_id),
        )
    except PaperAccountNotFound as error:
        raise _not_found(error) from error
