from datetime import date, datetime, timezone
from enum import Enum
from typing import Any, Literal
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field, field_validator


class Plan(str, Enum):
    FREE = "free"
    PRO = "pro"
    TRADER = "trader"
    QUANT = "quant"
    EXECUTION_ADDON = "execution_addon"


class AuthenticatedUser(BaseModel):
    id: UUID
    email: str | None = None
    display_name: str | None = None
    username: str | None = None
    avatar_url: str | None = None
    plan: Plan = Plan.FREE
    is_guest: bool = False


class Profile(BaseModel):
    id: UUID
    email: str
    display_name: str | None = None
    plan: Plan = Plan.FREE
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class PortfolioCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    base_currency: str = Field(default="USD", min_length=3, max_length=3)


class PortfolioRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(default_factory=uuid4)
    user_id: UUID
    name: str
    base_currency: str = "USD"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class PositionBook(str, Enum):
    INVESTMENT = "investment"
    TRADING = "trading"
    UNCLASSIFIED = "unclassified"


class ClassificationSource(str, Enum):
    USER = "user"
    IMPORT = "import"
    AGENT_SUGGESTION = "agent_suggestion"
    STRATEGY = "strategy"


class HoldingCreate(BaseModel):
    symbol: str = Field(min_length=1, max_length=20)
    asset_type: str = Field(default="equity", min_length=1, max_length=40)
    quantity: float = Field(ge=0)
    average_cost: float = Field(ge=0)
    cost_currency: str | None = Field(default=None, min_length=3, max_length=3)

    @field_validator("cost_currency", mode="before")
    @classmethod
    def normalize_cost_currency(cls, value: Any) -> str | None:
        return str(value).strip().upper() if value else value


class HoldingUpdate(BaseModel):
    quantity: float | None = Field(default=None, ge=0)
    average_cost: float | None = Field(default=None, ge=0)
    cost_currency: str | None = Field(default=None, min_length=3, max_length=3)

    @field_validator("cost_currency", mode="before")
    @classmethod
    def normalize_cost_currency(cls, value: Any) -> str | None:
        return str(value).strip().upper() if value else value


class HoldingRead(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    portfolio_id: UUID
    symbol: str
    asset_type: str = "equity"
    quantity: float
    average_cost: float
    cost_currency: str = "USD"
    book_type: PositionBook = PositionBook.UNCLASSIFIED
    classification_source: ClassificationSource = ClassificationSource.IMPORT
    classified_at: datetime | None = None
    classified_by: UUID | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @field_validator("cost_currency", mode="before")
    @classmethod
    def normalize_cost_currency(cls, value: Any) -> str:
        return str(value or "USD").strip().upper()


class HoldingClassificationUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    book_type: PositionBook


class PortfolioBookTotal(BaseModel):
    book_type: PositionBook
    holding_count: int = Field(ge=0)
    cost_basis: float = Field(ge=0)
    portfolio_weight: float = Field(ge=0, le=100)


class PortfolioRiskContext(BaseModel):
    gross_exposure: float = Field(ge=0)
    largest_position_weight: float = Field(ge=0, le=100)
    investment_weight: float = Field(ge=0, le=100)
    trading_weight: float = Field(ge=0, le=100)
    unclassified_weight: float = Field(ge=0, le=100)
    unclassified_count: int = Field(ge=0)


class PortfolioBooksRead(BaseModel):
    portfolio_id: UUID
    base_currency: str
    as_of: datetime
    total_cost_basis: float = Field(ge=0)
    books: list[PortfolioBookTotal]
    risk: PortfolioRiskContext


class PortfolioBookEventRead(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    user_id: UUID
    portfolio_id: UUID
    holding_id: UUID | None = None
    symbol: str
    previous_book_type: PositionBook
    new_book_type: PositionBook
    classification_source: ClassificationSource
    actor_id: UUID
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class RecurringBuyCreate(BaseModel):
    symbol: str = Field(min_length=1, max_length=20)
    account: str | None = Field(default=None, max_length=80)
    status: str = Field(default="completed", min_length=1, max_length=40)
    purchase_mode: Literal["amount", "shares"] = "amount"
    entered_amount: float = Field(gt=0)
    entered_currency: str = Field(default="USD", min_length=3, max_length=3)
    filled_quantity: float = Field(gt=0)
    fill_price: float = Field(gt=0)
    fill_currency: str = Field(default="USD", min_length=3, max_length=3)
    exchange_rate: float | None = Field(default=None, gt=0)
    recurrence_frequency: Literal["daily", "weekly", "monthly", "yearly"] = "monthly"
    schedule_time: str = Field(default="09:30", pattern=r"^\d{2}:\d{2}$")
    schedule_day_of_week: int | None = Field(default=None, ge=0, le=6)
    schedule_day_of_month: int | None = Field(default=None, ge=1, le=31)
    schedule_month: int | None = Field(default=None, ge=1, le=12)
    executed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @field_validator("symbol", mode="before")
    @classmethod
    def normalize_symbol(cls, value: Any) -> str:
        return str(value).strip().upper()

    @field_validator("entered_currency", "fill_currency", mode="before")
    @classmethod
    def normalize_currency(cls, value: Any) -> str:
        return str(value or "USD").strip().upper()

    @field_validator("status", mode="before")
    @classmethod
    def normalize_status(cls, value: Any) -> str:
        return str(value or "completed").strip().lower()


class RecurringBuyUpdate(BaseModel):
    symbol: str | None = Field(default=None, min_length=1, max_length=20)
    account: str | None = Field(default=None, max_length=80)
    status: str | None = Field(default=None, min_length=1, max_length=40)
    purchase_mode: Literal["amount", "shares"] | None = None
    entered_amount: float | None = Field(default=None, gt=0)
    entered_currency: str | None = Field(default=None, min_length=3, max_length=3)
    filled_quantity: float | None = Field(default=None, gt=0)
    fill_price: float | None = Field(default=None, gt=0)
    fill_currency: str | None = Field(default=None, min_length=3, max_length=3)
    exchange_rate: float | None = Field(default=None, gt=0)
    recurrence_frequency: Literal["daily", "weekly", "monthly", "yearly"] | None = None
    schedule_time: str | None = Field(default=None, pattern=r"^\d{2}:\d{2}$")
    schedule_day_of_week: int | None = Field(default=None, ge=0, le=6)
    schedule_day_of_month: int | None = Field(default=None, ge=1, le=31)
    schedule_month: int | None = Field(default=None, ge=1, le=12)
    executed_at: datetime | None = None

    @field_validator("symbol", mode="before")
    @classmethod
    def normalize_symbol(cls, value: Any) -> str | None:
        return str(value).strip().upper() if value else value

    @field_validator("entered_currency", "fill_currency", mode="before")
    @classmethod
    def normalize_currency(cls, value: Any) -> str | None:
        return str(value).strip().upper() if value else value

    @field_validator("status", mode="before")
    @classmethod
    def normalize_status(cls, value: Any) -> str | None:
        return str(value).strip().lower() if value else value


class RecurringBuyRead(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    portfolio_id: UUID
    linked_holding_id: UUID | None = None
    symbol: str
    account: str | None = None
    status: str = "completed"
    purchase_mode: Literal["amount", "shares"] = "amount"
    entered_amount: float
    entered_currency: str = "USD"
    filled_quantity: float
    fill_price: float
    fill_currency: str = "USD"
    exchange_rate: float | None = None
    recurrence_frequency: Literal["daily", "weekly", "monthly", "yearly"] = "monthly"
    schedule_time: str = "09:30"
    schedule_day_of_week: int | None = None
    schedule_day_of_month: int | None = None
    schedule_month: int | None = None
    executed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @field_validator("symbol", mode="before")
    @classmethod
    def normalize_symbol(cls, value: Any) -> str:
        return str(value).strip().upper()

    @field_validator("entered_currency", "fill_currency", mode="before")
    @classmethod
    def normalize_currency(cls, value: Any) -> str:
        return str(value or "USD").strip().upper()


class WatchlistCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class WatchlistRead(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    user_id: UUID
    name: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class WatchlistAssetCreate(BaseModel):
    symbol: str = Field(min_length=1, max_length=20)
    asset_type: str = Field(default="equity", min_length=1, max_length=40)


class WatchlistAssetRead(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    watchlist_id: UUID
    symbol: str
    asset_type: str = "equity"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SubscriptionRead(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    user_id: UUID
    stripe_customer_id: str | None = None
    stripe_subscription_id: str | None = None
    plan: Plan = Plan.FREE
    status: str = "inactive"
    current_period_end: datetime | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class AssetRead(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    symbol: str
    name: str | None = None
    asset_type: str = "equity"
    exchange: str | None = None
    currency: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class StrategyCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    strategy_type: str = Field(min_length=1, max_length=80)
    parameters: dict = Field(default_factory=dict)


class StrategyRead(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    user_id: UUID
    name: str
    strategy_type: str
    parameters: dict = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class BacktestRunCreate(BaseModel):
    strategy_id: UUID | None = None
    strategy_name: str
    strategy_type: str
    symbols: list[str]
    parameters: dict = Field(default_factory=dict)
    assumptions: dict = Field(default_factory=dict)
    metrics: dict = Field(default_factory=dict)
    equity_curve: list[dict] = Field(default_factory=list)


class BacktestTradeCreate(BaseModel):
    symbol: str
    side: str
    quantity: float
    price: float
    fees: float = 0
    pnl: float | None = None
    reason: str | None = None
    executed_at: datetime


class BacktestTradeRead(BacktestTradeCreate):
    id: UUID = Field(default_factory=uuid4)
    backtest_run_id: UUID
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class BacktestRunRead(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    user_id: UUID
    strategy_id: UUID | None = None
    strategy_name: str
    strategy_type: str
    symbols: list[str]
    parameters: dict = Field(default_factory=dict)
    assumptions: dict = Field(default_factory=dict)
    metrics: dict = Field(default_factory=dict)
    equity_curve: list[dict] = Field(default_factory=list)
    trades: list[BacktestTradeRead] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ReplaySessionCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    symbol: str = Field(min_length=1, max_length=12)
    start_date: date
    end_date: date
    initial_balance: float = Field(default=10_000, gt=0, le=10_000_000)

    @field_validator("symbol")
    @classmethod
    def normalize_symbol(cls, value: str) -> str:
        normalized = value.strip().upper()
        if not normalized:
            raise ValueError("symbol is required")
        return normalized

    @field_validator("end_date")
    @classmethod
    def validate_range(cls, value: date, info):
        start_date = info.data.get("start_date")
        if start_date and value <= start_date:
            raise ValueError("end_date must be after start_date")
        return value


class ReplaySessionUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    status: Literal["active", "completed"] | None = None
    current_index: int | None = Field(default=None, ge=0)
    cash: float | None = None
    position_qty: float | None = Field(default=None, ge=0)
    position_avg_price: float | None = Field(default=None, ge=0)
    trades: list[dict] | None = None
    equity_curve: list[dict] | None = None
    metrics: dict | None = None


class ReplaySessionRead(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    user_id: UUID
    name: str
    symbol: str
    start_date: date
    end_date: date
    initial_balance: float
    status: str = "active"
    current_index: int = 0
    total_bars: int = 0
    cash: float = 0
    position_qty: float = 0
    position_avg_price: float = 0
    trades: list[dict] = Field(default_factory=list)
    equity_curve: list[dict] = Field(default_factory=list)
    metrics: dict = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class NotificationChannelCreate(BaseModel):
    channel_type: str = Field(min_length=1, max_length=40)
    name: str = Field(min_length=1, max_length=120)
    destination: str | None = None
    config: dict = Field(default_factory=dict)
    is_active: bool = True


class NotificationChannelRead(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    user_id: UUID
    channel_type: str
    name: str
    destination_label: str | None = None
    config: dict = Field(default_factory=dict)
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class AlertCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    alert_type: str = Field(min_length=1, max_length=60)
    symbol: str | None = Field(default=None, max_length=20)
    condition: dict = Field(default_factory=dict)
    channels: list[UUID] = Field(default_factory=list)
    is_active: bool = True


class AlertRead(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    user_id: UUID
    name: str
    alert_type: str
    symbol: str | None = None
    condition: dict = Field(default_factory=dict)
    channels: list[UUID] = Field(default_factory=list)
    is_active: bool = True
    last_triggered_at: datetime | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class AlertEventCreate(BaseModel):
    alert_id: UUID
    user_id: UUID
    alert_type: str
    symbol: str | None = None
    message: str
    value: float | None = None
    metadata: dict = Field(default_factory=dict)


class AlertEventRead(AlertEventCreate):
    id: UUID = Field(default_factory=uuid4)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class RiskSnapshotCreate(BaseModel):
    portfolio_id: UUID
    metrics: dict = Field(default_factory=dict)
    allocations: dict = Field(default_factory=dict)
    correlation_matrix: dict = Field(default_factory=dict)
    ai_explanation: str | None = None


class RiskSnapshotRead(RiskSnapshotCreate):
    id: UUID = Field(default_factory=uuid4)
    user_id: UUID
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class JournalEntryCreate(BaseModel):
    symbol: str = Field(min_length=1, max_length=20)
    direction: str = Field(default="long", pattern="^(long|short)$")
    entry_price: float = Field(gt=0)
    exit_price: float | None = Field(default=None, gt=0)
    quantity: float = Field(gt=0)
    fees: float = Field(default=0, ge=0)
    strategy_id: UUID | None = None
    reason_entry: str | None = None
    reason_exit: str | None = None
    emotion_tag: str | None = None
    mistake_tag: str | None = None
    notes: str | None = None
    tags: list[str] = Field(default_factory=list)
    opened_at: datetime | None = None
    closed_at: datetime | None = None


class JournalEntryRead(JournalEntryCreate):
    id: UUID = Field(default_factory=uuid4)
    user_id: UUID
    pnl: float | None = None
    return_pct: float | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class QuantValidationRunCreate(BaseModel):
    strategy_name: str
    strategy_type: str
    symbols: list[str]
    method: str
    parameters: dict = Field(default_factory=dict)
    assumptions: dict = Field(default_factory=dict)
    results: dict = Field(default_factory=dict)


class QuantValidationRunRead(QuantValidationRunCreate):
    id: UUID = Field(default_factory=uuid4)
    user_id: UUID
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class StrategyExportCreate(BaseModel):
    strategy_name: str
    strategy_type: str
    language: str
    parameters: dict = Field(default_factory=dict)
    content: str


class StrategyExportRead(StrategyExportCreate):
    id: UUID = Field(default_factory=uuid4)
    user_id: UUID
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
