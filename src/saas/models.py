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
