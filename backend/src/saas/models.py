from datetime import datetime, timezone
from enum import Enum
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field


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


class HoldingCreate(BaseModel):
    symbol: str = Field(min_length=1, max_length=20)
    asset_type: str = Field(default="equity", min_length=1, max_length=40)
    quantity: float = Field(ge=0)
    average_cost: float = Field(ge=0)


class HoldingUpdate(BaseModel):
    quantity: float | None = Field(default=None, ge=0)
    average_cost: float | None = Field(default=None, ge=0)


class HoldingRead(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    portfolio_id: UUID
    symbol: str
    asset_type: str = "equity"
    quantity: float
    average_cost: float
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


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
