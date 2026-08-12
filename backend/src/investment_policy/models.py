from datetime import datetime, timezone
from enum import Enum
from typing import Any
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field, field_validator


class InvestmentPolicyStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    ARCHIVED = "archived"


class InvestmentPolicyUpsert(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)

    name: str = Field(default="Core investment policy", min_length=1, max_length=120)
    status: InvestmentPolicyStatus = InvestmentPolicyStatus.ACTIVE
    goals: dict[str, Any] = Field(default_factory=dict)
    time_horizon: str = Field(default="long_term", min_length=1, max_length=40)
    target_allocation: dict[str, float] = Field(default_factory=dict)
    max_position_weight: float = Field(default=10, gt=0, le=100)
    max_sector_weight: float = Field(default=35, gt=0, le=100)
    max_drawdown: float = Field(default=18, gt=0, le=100)
    minimum_cash_weight: float = Field(default=8, ge=0, le=100)
    permitted_assets: list[str] = Field(default_factory=lambda: ["equity", "etf", "cash"])
    rebalancing_policy: dict[str, Any] = Field(default_factory=lambda: {"cadence": "quarterly"})
    tax_preferences: dict[str, Any] = Field(default_factory=dict)

    @field_validator("target_allocation")
    @classmethod
    def validate_target_values(cls, value: dict[str, float]) -> dict[str, float]:
        if any(weight < 0 or weight > 100 for weight in value.values()):
            raise ValueError("Target allocation weights must be between 0 and 100")
        return value

    @field_validator("permitted_assets", mode="before")
    @classmethod
    def normalize_assets(cls, value: Any) -> list[str]:
        assets = value or []
        return sorted({str(asset).strip().lower() for asset in assets if str(asset).strip()})


class InvestmentPolicyRead(InvestmentPolicyUpsert):
    id: UUID = Field(default_factory=uuid4)
    user_id: UUID
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class InvestmentPolicyValidationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    portfolio_id: UUID


class InvestmentPolicyScopeValidationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    portfolio_ids: list[UUID] = Field(min_length=1, max_length=100)


class InvestmentPolicyAlert(BaseModel):
    code: str
    severity: str
    message: str
    symbol: str | None = None
    observed: float | None = None
    limit: float | None = None
    portfolio_ids: list[UUID] = Field(default_factory=list)
    holding_ids: list[UUID] = Field(default_factory=list)


class InvestmentPolicyValidationRead(BaseModel):
    policy_id: UUID
    portfolio_id: UUID
    compliant: bool
    alerts: list[InvestmentPolicyAlert]
    validated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class InvestmentPolicyScopeValidationRead(BaseModel):
    policy_id: UUID
    portfolio_ids: list[UUID]
    compliant: bool
    alerts: list[InvestmentPolicyAlert]
    validated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
