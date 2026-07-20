from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP
from threading import RLock
from uuid import UUID, uuid4

from src.paper_trading.models import (
    PaperAccountCreate,
    PaperAccountRead,
    PaperAccountSummary,
    PaperCashLedgerRead,
    PaperFillRead,
    PaperOrderCreate,
    PaperOrderRead,
    PaperOwner,
    PaperPositionRead,
    PaperQuoteTick,
    now_utc,
)
from src.config import settings
from src.saas.models import AuthenticatedUser


class PaperTradingError(RuntimeError):
    pass


class PaperAccountNotFound(PaperTradingError):
    pass


class PaperOrderNotFound(PaperTradingError):
    pass


class PaperOrderRejected(PaperTradingError):
    pass


def _money(value: float | Decimal) -> float:
    return float(Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def _owner_matches(account: PaperAccountRead, owner: PaperOwner) -> bool:
    if owner.user_id is not None:
        return account.user_id == owner.user_id and account.guest_owner_id is None
    return account.user_id is None and account.guest_owner_id == owner.guest_owner_id


class InMemoryPaperTradingStore:
    """Deterministic store used for tests, local development, and guest sessions."""

    def __init__(self) -> None:
        self._lock = RLock()
        self._accounts: dict[UUID, PaperAccountRead] = {}
        self._orders: dict[UUID, PaperOrderRead] = {}
        self._fills: dict[UUID, PaperFillRead] = {}
        self._positions: dict[tuple[UUID, str], PaperPositionRead] = {}
        self._ledger: dict[UUID, PaperCashLedgerRead] = {}

    def reset(self) -> None:
        with self._lock:
            self._accounts.clear()
            self._orders.clear()
            self._fills.clear()
            self._positions.clear()
            self._ledger.clear()

    def list_accounts(self, owner: PaperOwner) -> list[PaperAccountRead]:
        with self._lock:
            return [account for account in self._accounts.values() if _owner_matches(account, owner)]

    def create_account(self, owner: PaperOwner, payload: PaperAccountCreate) -> PaperAccountRead:
        now = now_utc()
        account = PaperAccountRead(
            user_id=owner.user_id,
            guest_owner_id=owner.guest_owner_id,
            name=payload.name,
            base_currency=payload.base_currency,
            initial_cash=_money(payload.initial_cash),
            cash=_money(payload.initial_cash),
            created_at=now,
            updated_at=now,
        )
        deposit = PaperCashLedgerRead(
            account_id=account.id,
            entry_type="deposit",
            amount=account.initial_cash,
            balance_after=account.cash,
            description="Initial paper account deposit",
            created_at=now,
        )
        with self._lock:
            self._accounts[account.id] = account
            self._ledger[deposit.id] = deposit
        return account

    def ensure_default_account(self, owner: PaperOwner) -> PaperAccountRead:
        accounts = self.list_accounts(owner)
        return accounts[0] if accounts else self.create_account(owner, PaperAccountCreate())

    def get_account(self, owner: PaperOwner, account_id: UUID) -> PaperAccountRead:
        with self._lock:
            account = self._accounts.get(account_id)
            if account is None or not _owner_matches(account, owner):
                raise PaperAccountNotFound("Paper account not found")
            return account

    def list_orders(self, owner: PaperOwner, account_id: UUID) -> list[PaperOrderRead]:
        self.get_account(owner, account_id)
        with self._lock:
            return sorted(
                [order for order in self._orders.values() if order.account_id == account_id],
                key=lambda order: order.submitted_at,
                reverse=True,
            )

    def list_fills(self, owner: PaperOwner, account_id: UUID) -> list[PaperFillRead]:
        self.get_account(owner, account_id)
        with self._lock:
            return sorted(
                [fill for fill in self._fills.values() if fill.account_id == account_id],
                key=lambda fill: fill.executed_at,
                reverse=True,
            )

    def list_positions(self, owner: PaperOwner, account_id: UUID) -> list[PaperPositionRead]:
        self.get_account(owner, account_id)
        with self._lock:
            return sorted(
                [position for (position_account, _), position in self._positions.items() if position_account == account_id and position.quantity > 0],
                key=lambda position: position.symbol,
            )

    def list_ledger(self, owner: PaperOwner, account_id: UUID) -> list[PaperCashLedgerRead]:
        self.get_account(owner, account_id)
        with self._lock:
            return sorted(
                [entry for entry in self._ledger.values() if entry.account_id == account_id],
                key=lambda entry: entry.created_at,
                reverse=True,
            )

    def submit_order(
        self,
        owner: PaperOwner,
        account_id: UUID,
        payload: PaperOrderCreate,
        quote: PaperQuoteTick,
    ) -> PaperOrderRead:
        with self._lock:
            account = self.get_account(owner, account_id)
            if account.status != "active":
                raise PaperOrderRejected("Paper account is not active")
            if payload.side == "sell":
                position = self._positions.get((account_id, payload.symbol))
                open_sell_quantity = sum(
                    order.quantity
                    for order in self._orders.values()
                    if order.account_id == account_id
                    and order.symbol == payload.symbol
                    and order.side == "sell"
                    and order.status == "open"
                )
                if position is None or position.quantity - open_sell_quantity < payload.quantity:
                    raise PaperOrderRejected("Cash paper accounts can only sell shares already held")

            trigger_price = quote.price
            if payload.order_type == "limit":
                trigger_price = payload.limit_price or 0
            elif payload.order_type == "stop":
                trigger_price = payload.stop_price or 0
            reserved_cash = _money(trigger_price * payload.quantity) if payload.side == "buy" else 0
            available_cash = _money(account.cash - account.cash_reserved)
            if payload.side == "buy" and reserved_cash > available_cash:
                raise PaperOrderRejected("Insufficient paper cash for this order")

            order = PaperOrderRead(
                account_id=account_id,
                status="open",
                reserved_cash=0 if payload.order_type == "market" else reserved_cash,
                **payload.model_dump(),
            )
            self._orders[order.id] = order

            if payload.order_type == "market":
                return self._fill_order_locked(account, order, quote.price)

            account.cash_reserved = _money(account.cash_reserved + reserved_cash)
            account.updated_at = now_utc()
            return order

    def cancel_order(self, owner: PaperOwner, order_id: UUID) -> PaperOrderRead:
        with self._lock:
            order = self._orders.get(order_id)
            if order is None:
                raise PaperOrderNotFound("Paper order not found")
            account = self.get_account(owner, order.account_id)
            if order.status != "open":
                raise PaperOrderRejected("Only open paper orders can be canceled")
            account.cash_reserved = _money(max(0, account.cash_reserved - order.reserved_cash))
            account.updated_at = now_utc()
            order.status = "canceled"
            order.canceled_at = now_utc()
            order.reserved_cash = 0
            return order

    def refresh_orders(
        self,
        owner: PaperOwner,
        account_id: UUID,
        quotes: dict[str, PaperQuoteTick],
    ) -> list[PaperOrderRead]:
        with self._lock:
            account = self.get_account(owner, account_id)
            for position in self.list_positions(owner, account_id):
                quote = quotes.get(position.symbol)
                if quote:
                    position.last_price = quote.price
                    position.market_value = _money(position.quantity * quote.price)
                    position.unrealized_pnl = _money((quote.price - position.average_entry) * position.quantity)
                    position.updated_at = now_utc()

            open_orders = [
                order for order in self._orders.values()
                if order.account_id == account_id and order.status == "open"
            ]
            for order in open_orders:
                quote = quotes.get(order.symbol)
                if quote is None:
                    continue
                high = quote.high if quote.high is not None else quote.price
                low = quote.low if quote.low is not None else quote.price
                should_fill = False
                fill_price = quote.price
                if order.order_type == "limit" and order.limit_price is not None:
                    should_fill = low <= order.limit_price if order.side == "buy" else high >= order.limit_price
                    fill_price = min(quote.price, order.limit_price) if order.side == "buy" else max(quote.price, order.limit_price)
                elif order.order_type == "stop" and order.stop_price is not None:
                    should_fill = high >= order.stop_price if order.side == "buy" else low <= order.stop_price
                    fill_price = max(quote.price, order.stop_price) if order.side == "buy" else min(quote.price, order.stop_price)
                if should_fill:
                    self._fill_order_locked(account, order, fill_price)
            return self.list_orders(owner, account_id)

    def summary(self, owner: PaperOwner, account_id: UUID) -> PaperAccountSummary:
        with self._lock:
            account = self.get_account(owner, account_id)
            positions = self.list_positions(owner, account_id)
            market_value = _money(sum(position.market_value for position in positions))
            realized = _money(sum(position.realized_pnl for position in positions))
            unrealized = _money(sum(position.unrealized_pnl for position in positions))
            open_risk = _money(sum(self._position_risk(position) for position in positions))
            available = _money(account.cash - account.cash_reserved)
            return PaperAccountSummary(
                account=account,
                cash_available=available,
                cash_reserved=account.cash_reserved,
                buying_power=available,
                market_value=market_value,
                equity=_money(account.cash + market_value),
                realized_pnl=realized,
                unrealized_pnl=unrealized,
                open_risk=open_risk,
                open_orders=sum(1 for order in self._orders.values() if order.account_id == account_id and order.status == "open"),
                data_status="delayed",
            )

    def _position_risk(self, position: PaperPositionRead) -> float:
        matching_orders = sorted(
            (
                order for order in self._orders.values()
                if order.account_id == position.account_id
                and order.symbol == position.symbol
                and order.side == "buy"
                and order.status == "filled"
                and order.protective_stop is not None
            ),
            key=lambda order: order.filled_at or order.submitted_at,
            reverse=True,
        )
        stop = matching_orders[0].protective_stop if matching_orders else None
        return max(0, position.average_entry - (stop or position.average_entry)) * position.quantity

    def _fill_order_locked(
        self,
        account: PaperAccountRead,
        order: PaperOrderRead,
        fill_price: float,
    ) -> PaperOrderRead:
        fill_price = _money(fill_price)
        notional = _money(fill_price * order.quantity)
        account.cash_reserved = _money(max(0, account.cash_reserved - order.reserved_cash))
        if order.side == "buy":
            available_for_order = _money(account.cash - account.cash_reserved)
            if notional > available_for_order:
                order.status = "rejected"
                order.reserved_cash = 0
                return order
            account.cash = _money(account.cash - notional)
            key = (account.id, order.symbol)
            current = self._positions.get(key)
            if current:
                total_quantity = current.quantity + order.quantity
                current.average_entry = _money(
                    ((current.quantity * current.average_entry) + notional) / total_quantity
                )
                current.quantity = total_quantity
                current.last_price = fill_price
                current.market_value = _money(total_quantity * fill_price)
                current.unrealized_pnl = _money((fill_price - current.average_entry) * total_quantity)
                current.updated_at = now_utc()
            else:
                self._positions[key] = PaperPositionRead(
                    account_id=account.id,
                    symbol=order.symbol,
                    quantity=order.quantity,
                    average_entry=fill_price,
                    last_price=fill_price,
                    market_value=notional,
                )
            ledger_type = "buy"
            ledger_amount = -notional
        else:
            key = (account.id, order.symbol)
            position = self._positions.get(key)
            if position is None or position.quantity < order.quantity:
                order.status = "rejected"
                order.reserved_cash = 0
                return order
            realized = _money((fill_price - position.average_entry) * order.quantity)
            position.quantity -= order.quantity
            position.realized_pnl = _money(position.realized_pnl + realized)
            position.last_price = fill_price
            position.market_value = _money(position.quantity * fill_price)
            position.unrealized_pnl = _money((fill_price - position.average_entry) * position.quantity)
            position.updated_at = now_utc()
            account.cash = _money(account.cash + notional)
            ledger_type = "sell"
            ledger_amount = notional

        fill = PaperFillRead(
            account_id=account.id,
            order_id=order.id,
            symbol=order.symbol,
            side=order.side,
            quantity=order.quantity,
            price=fill_price,
        )
        self._fills[fill.id] = fill
        ledger = PaperCashLedgerRead(
            account_id=account.id,
            order_id=order.id,
            fill_id=fill.id,
            entry_type=ledger_type,
            amount=ledger_amount,
            balance_after=account.cash,
            description=f"Paper {order.side} fill for {order.quantity:g} {order.symbol}",
        )
        self._ledger[ledger.id] = ledger
        account.updated_at = now_utc()
        order.status = "filled"
        order.average_fill_price = fill_price
        order.filled_at = now_utc()
        order.reserved_cash = 0
        return order


paper_store = InMemoryPaperTradingStore()


class SupabasePaperTradingStore:
    """PostgREST adapter; balance-changing operations use short SQL RPC transactions."""

    def __init__(self, rest_store) -> None:
        self._rest = rest_store

    def _owner_query(self, owner: PaperOwner) -> dict[str, str]:
        if owner.user_id is not None:
            return {"user_id": f"eq.{owner.user_id}", "guest_owner_id": "is.null"}
        return {"user_id": "is.null", "guest_owner_id": f"eq.{owner.guest_owner_id}"}

    def _owner_args(self, owner: PaperOwner) -> dict[str, str | None]:
        return {
            "p_user_id": str(owner.user_id) if owner.user_id else None,
            "p_guest_owner_id": owner.guest_owner_id,
        }

    def list_accounts(self, owner: PaperOwner) -> list[PaperAccountRead]:
        rows = self._rest._request(
            "GET",
            "paper_accounts",
            {"select": "*", "order": "updated_at.desc", **self._owner_query(owner)},
        )
        return [PaperAccountRead.model_validate(row) for row in rows]

    def create_account(self, owner: PaperOwner, payload: PaperAccountCreate) -> PaperAccountRead:
        rows = self._rest._request(
            "POST",
            "paper_accounts",
            body={
                "user_id": str(owner.user_id) if owner.user_id else None,
                "guest_owner_id": owner.guest_owner_id,
                "name": payload.name,
                "base_currency": payload.base_currency,
                "initial_cash": payload.initial_cash,
                "cash": payload.initial_cash,
            },
        )
        return PaperAccountRead.model_validate(rows[0])

    def ensure_default_account(self, owner: PaperOwner) -> PaperAccountRead:
        accounts = self.list_accounts(owner)
        return accounts[0] if accounts else self.create_account(owner, PaperAccountCreate())

    def get_account(self, owner: PaperOwner, account_id: UUID) -> PaperAccountRead:
        rows = self._rest._request(
            "GET",
            "paper_accounts",
            {"select": "*", "id": f"eq.{account_id}", "limit": "1", **self._owner_query(owner)},
        )
        if not rows:
            raise PaperAccountNotFound("Paper account not found")
        return PaperAccountRead.model_validate(rows[0])

    def list_orders(self, owner: PaperOwner, account_id: UUID) -> list[PaperOrderRead]:
        self.get_account(owner, account_id)
        rows = self._rest._request(
            "GET",
            "paper_orders",
            {"select": "*", "account_id": f"eq.{account_id}", "order": "submitted_at.desc"},
        )
        return [PaperOrderRead.model_validate(row) for row in rows]

    def list_fills(self, owner: PaperOwner, account_id: UUID) -> list[PaperFillRead]:
        self.get_account(owner, account_id)
        rows = self._rest._request(
            "GET",
            "paper_fills",
            {"select": "*", "account_id": f"eq.{account_id}", "order": "executed_at.desc"},
        )
        return [PaperFillRead.model_validate(row) for row in rows]

    def list_positions(self, owner: PaperOwner, account_id: UUID) -> list[PaperPositionRead]:
        self.get_account(owner, account_id)
        rows = self._rest._request(
            "GET",
            "paper_positions",
            {"select": "*", "account_id": f"eq.{account_id}", "quantity": "gt.0", "order": "symbol.asc"},
        )
        return [
            PaperPositionRead.model_validate({
                **row,
                "market_value": _money(float(row["quantity"]) * float(row["last_price"])),
                "unrealized_pnl": _money(
                    (float(row["last_price"]) - float(row["average_entry"])) * float(row["quantity"])
                ),
            })
            for row in rows
        ]

    def list_ledger(self, owner: PaperOwner, account_id: UUID) -> list[PaperCashLedgerRead]:
        self.get_account(owner, account_id)
        rows = self._rest._request(
            "GET",
            "paper_cash_ledger",
            {"select": "*", "account_id": f"eq.{account_id}", "order": "created_at.desc"},
        )
        return [PaperCashLedgerRead.model_validate(row) for row in rows]

    def submit_order(
        self,
        owner: PaperOwner,
        account_id: UUID,
        payload: PaperOrderCreate,
        quote: PaperQuoteTick,
    ) -> PaperOrderRead:
        self.get_account(owner, account_id)
        try:
            rows = self._rest._request(
                "POST",
                "rpc/paper_submit_order",
                body={
                    "p_account_id": str(account_id),
                    **self._owner_args(owner),
                    "p_symbol": payload.symbol,
                    "p_side": payload.side,
                    "p_quantity": payload.quantity,
                    "p_order_type": payload.order_type,
                    "p_time_in_force": payload.time_in_force,
                    "p_limit_price": payload.limit_price,
                    "p_stop_price": payload.stop_price,
                    "p_protective_stop": payload.protective_stop,
                    "p_target_price": payload.target_price,
                    "p_risk_budget": payload.risk_budget,
                    "p_thesis": payload.thesis,
                    "p_quote_price": quote.price,
                },
            )
        except Exception as error:
            raise PaperOrderRejected(str(error)) from error
        return PaperOrderRead.model_validate(rows[0])

    def cancel_order(self, owner: PaperOwner, order_id: UUID) -> PaperOrderRead:
        try:
            rows = self._rest._request(
                "POST",
                "rpc/paper_cancel_order",
                body={"p_order_id": str(order_id), **self._owner_args(owner)},
            )
        except Exception as error:
            raise PaperOrderRejected(str(error)) from error
        return PaperOrderRead.model_validate(rows[0])

    def refresh_orders(
        self,
        owner: PaperOwner,
        account_id: UUID,
        quotes: dict[str, PaperQuoteTick],
    ) -> list[PaperOrderRead]:
        self.get_account(owner, account_id)
        for position in self.list_positions(owner, account_id):
            quote = quotes.get(position.symbol)
            if quote:
                self._rest._request(
                    "PATCH",
                    "paper_positions",
                    {"id": f"eq.{position.id}", "account_id": f"eq.{account_id}"},
                    body={"last_price": quote.price, "updated_at": now_utc().isoformat()},
                )
        for order in self.list_orders(owner, account_id):
            if order.status != "open":
                continue
            quote = quotes.get(order.symbol)
            if quote is None:
                continue
            high = quote.high if quote.high is not None else quote.price
            low = quote.low if quote.low is not None else quote.price
            should_fill = False
            fill_price = quote.price
            if order.order_type == "limit" and order.limit_price is not None:
                should_fill = low <= order.limit_price if order.side == "buy" else high >= order.limit_price
                fill_price = min(quote.price, order.limit_price) if order.side == "buy" else max(quote.price, order.limit_price)
            elif order.order_type == "stop" and order.stop_price is not None:
                should_fill = high >= order.stop_price if order.side == "buy" else low <= order.stop_price
                fill_price = max(quote.price, order.stop_price) if order.side == "buy" else min(quote.price, order.stop_price)
            if should_fill:
                self._rest._request(
                    "POST",
                    "rpc/paper_fill_order",
                    body={
                        "p_order_id": str(order.id),
                        **self._owner_args(owner),
                        "p_fill_price": fill_price,
                    },
                )
        return self.list_orders(owner, account_id)

    def summary(self, owner: PaperOwner, account_id: UUID) -> PaperAccountSummary:
        account = self.get_account(owner, account_id)
        positions = self.list_positions(owner, account_id)
        orders = self.list_orders(owner, account_id)
        market_value = _money(sum(position.market_value for position in positions))
        realized = _money(sum(position.realized_pnl for position in positions))
        unrealized = _money(sum(position.unrealized_pnl for position in positions))
        available = _money(account.cash - account.cash_reserved)
        open_risk = _money(sum(
            max(0, position.average_entry - (next(
                (
                    order.protective_stop for order in orders
                    if order.symbol == position.symbol
                    and order.side == "buy"
                    and order.status == "filled"
                    and order.protective_stop is not None
                ),
                position.average_entry,
            ) or position.average_entry)) * position.quantity
            for position in positions
        ))
        return PaperAccountSummary(
            account=account,
            cash_available=available,
            cash_reserved=account.cash_reserved,
            buying_power=available,
            market_value=market_value,
            equity=_money(account.cash + market_value),
            realized_pnl=realized,
            unrealized_pnl=unrealized,
            open_risk=open_risk,
            open_orders=sum(1 for order in orders if order.status == "open"),
            data_status="delayed",
        )


def get_paper_store(user: AuthenticatedUser):
    if user.is_guest:
        return paper_store
    service_role_key = settings.secret_value("supabase_service_role_key")
    if settings.supabase_url and service_role_key:
        from src.saas.repository import SupabaseRestStore

        return SupabasePaperTradingStore(SupabaseRestStore(settings.supabase_url, service_role_key))
    return paper_store
