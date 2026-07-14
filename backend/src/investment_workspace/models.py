from datetime import datetime, timezone
from enum import Enum
from typing import Any
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field, field_validator


class InvestmentThesisStatus(str, Enum):
    ACTIVE = "active"
    NEEDS_REVIEW = "needs_review"
    INVALIDATED = "invalidated"


class InvestmentThesisUpsert(BaseModel):
    model_config = ConfigDict(extra="forbid")

    statement: str = Field(min_length=1, max_length=5000)
    supporting_evidence: list[str] = Field(default_factory=list, max_length=30)
    risk_evidence: list[str] = Field(default_factory=list, max_length=30)
    invalidation_conditions: list[str] = Field(default_factory=list, max_length=30)
    status: InvestmentThesisStatus = InvestmentThesisStatus.ACTIVE
    next_review_at: datetime | None = None

    @field_validator("statement")
    @classmethod
    def clean_statement(cls, value: str) -> str:
        return value.strip()

    @field_validator("supporting_evidence", "risk_evidence", "invalidation_conditions", mode="before")
    @classmethod
    def clean_items(cls, value: Any) -> list[str]:
        items = value or []
        return [str(item).strip() for item in items if str(item).strip()]


class InvestmentThesisRead(InvestmentThesisUpsert):
    id: UUID = Field(default_factory=uuid4)
    user_id: UUID
    portfolio_id: UUID
    holding_id: UUID
    symbol: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class InvestmentDecisionAction(str, Enum):
    HOLD = "hold"
    TRIM = "trim"


class InvestmentDecisionCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    holding_id: UUID
    action: InvestmentDecisionAction
    rationale: str = Field(min_length=1, max_length=5000)
    policy_exception: str | None = Field(default=None, max_length=2000)

    @field_validator("rationale")
    @classmethod
    def clean_rationale(cls, value: str) -> str:
        return value.strip()

    @field_validator("policy_exception")
    @classmethod
    def clean_exception(cls, value: str | None) -> str | None:
        cleaned = value.strip() if value else None
        return cleaned or None


class InvestmentDecisionRead(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    user_id: UUID
    portfolio_id: UUID
    holding_id: UUID
    symbol: str
    action: InvestmentDecisionAction
    rationale: str
    policy_exception: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
