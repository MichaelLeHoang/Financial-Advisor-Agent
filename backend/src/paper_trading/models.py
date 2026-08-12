from datetime import datetime, timezone
from typing import Literal
from uuid import UUID, uuid4

from pydantic import BaseModel, Field, field_validator, model_validator


PaperOrderSide = Literal["buy", "sell"]
PaperOrderType = Literal["market", "limit", "stop"]
PaperTimeInForce = Literal["day", "gtc"]
PaperOrderStatus = Literal["open", "filled", "canceled", "rejected"]


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


class PaperOwner(BaseModel):
    user_id: UUID | None = None
    guest_owner_id: str | None = Field(default=None, min_length=8, max_length=128)

    @model_validator(mode="after")
    def require_one_owner(self):
        if (self.user_id is None) == (self.guest_owner_id is None):
            raise ValueError("Exactly one paper account owner is required")
        return self


class PaperAccountCreate(BaseModel):
    name: str = Field(default="Main Paper Account", min_length=1, max_length=80)
    base_currency: str = Field(default="USD", min_length=3, max_length=3)
    initial_cash: float = Field(default=100_000, gt=0, le=10_000_000)

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        return value.strip()

    @field_validator("base_currency")
    @classmethod
    def normalize_currency(cls, value: str) -> str:
        return value.strip().upper()


class PaperAccountRead(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    user_id: UUID | None = None
    guest_owner_id: str | None = None
    name: str
    base_currency: str = "USD"
    initial_cash: float
    cash: float
    cash_reserved: float = 0
    status: Literal["active", "archived"] = "active"
    created_at: datetime = Field(default_factory=now_utc)
    updated_at: datetime = Field(default_factory=now_utc)


class PaperOrderCreate(BaseModel):
    symbol: str = Field(min_length=1, max_length=20)
    side: PaperOrderSide
    quantity: float = Field(gt=0, le=1_000_000)
    order_type: PaperOrderType = "market"
    time_in_force: PaperTimeInForce = "day"
    limit_price: float | None = Field(default=None, gt=0)
    stop_price: float | None = Field(default=None, gt=0)
    protective_stop: float | None = Field(default=None, gt=0)
    target_price: float | None = Field(default=None, gt=0)
    risk_budget: float | None = Field(default=None, gt=0)
    thesis: str | None = Field(default=None, max_length=2_000)

    @field_validator("symbol")
    @classmethod
    def normalize_symbol(cls, value: str) -> str:
        normalized = value.strip().upper()
        if not normalized:
            raise ValueError("symbol is required")
        return normalized

    @model_validator(mode="after")
    def validate_order_price(self):
        if self.order_type == "limit" and self.limit_price is None:
            raise ValueError("limit_price is required for limit orders")
        if self.order_type == "stop" and self.stop_price is None:
            raise ValueError("stop_price is required for stop orders")
        return self


class PaperOrderRead(PaperOrderCreate):
    id: UUID = Field(default_factory=uuid4)
    account_id: UUID
    status: PaperOrderStatus = "open"
    reserved_cash: float = 0
    average_fill_price: float | None = None
    fees: float = 0
    submitted_at: datetime = Field(default_factory=now_utc)
    filled_at: datetime | None = None
    canceled_at: datetime | None = None


class PaperFillRead(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    account_id: UUID
    order_id: UUID
    symbol: str
    side: PaperOrderSide
    quantity: float
    price: float
    fees: float = 0
    executed_at: datetime = Field(default_factory=now_utc)


class PaperPositionRead(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    account_id: UUID
    symbol: str
    quantity: float
    average_entry: float
    last_price: float
    realized_pnl: float = 0
    market_value: float = 0
    unrealized_pnl: float = 0
    updated_at: datetime = Field(default_factory=now_utc)


class PaperCashLedgerRead(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    account_id: UUID
    order_id: UUID | None = None
    fill_id: UUID | None = None
    entry_type: Literal["deposit", "buy", "sell"]
    amount: float
    balance_after: float
    description: str
    created_at: datetime = Field(default_factory=now_utc)


class PaperQuoteTick(BaseModel):
    price: float = Field(gt=0)
    high: float | None = Field(default=None, gt=0)
    low: float | None = Field(default=None, gt=0)


class PaperAccountSummary(BaseModel):
    account: PaperAccountRead
    cash_available: float
    cash_reserved: float
    buying_power: float
    market_value: float
    equity: float
    realized_pnl: float
    unrealized_pnl: float
    day_pnl: float = 0
    open_risk: float
    open_orders: int
    data_status: Literal["fresh", "delayed", "illustrative", "unavailable"] = "delayed"
    as_of: datetime = Field(default_factory=now_utc)


class PaperAccountSnapshot(BaseModel):
    summary: PaperAccountSummary
    orders: list[PaperOrderRead]
    fills: list[PaperFillRead]
    positions: list[PaperPositionRead]
    ledger: list[PaperCashLedgerRead]
