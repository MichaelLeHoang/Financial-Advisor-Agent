"""Typed contracts for user-controlled conversational memory."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator


class MemoryCategory(str, Enum):
    INVESTMENT_HORIZON = "investment_horizon"
    RISK_PREFERENCE = "risk_preference"
    ASSET_RESTRICTION = "asset_restriction"
    SECTOR_PREFERENCE = "sector_preference"
    RESEARCH_PREFERENCE = "research_preference"
    COMMUNICATION_PREFERENCE = "communication_preference"
    TRADING_RULE = "trading_rule"


class MemoryStatus(str, Enum):
    CANDIDATE = "candidate"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"
    SUPERSEDED = "superseded"


class UserMemory(BaseModel):
    id: str
    category: MemoryCategory
    label: str
    value_json: dict[str, Any]
    status: MemoryStatus
    source_session_id: str | None = None
    source_message_id: str | None = None
    confidence: float = Field(default=1.0, ge=0, le=1)
    expires_at: datetime | None = None
    supersedes_memory_id: str | None = None
    created_at: datetime
    updated_at: datetime


class MemoryCreateRequest(BaseModel):
    category: MemoryCategory
    label: str = Field(min_length=1, max_length=160)
    value_json: dict[str, Any]

    @field_validator("value_json")
    @classmethod
    def limit_value_size(cls, value: dict[str, Any]) -> dict[str, Any]:
        import json

        if len(json.dumps(value, separators=(",", ":"), default=str).encode()) > 2048:
            raise ValueError("Memory value must be 2 KB or smaller.")
        return value


class MemoryUpdateRequest(BaseModel):
    label: str | None = Field(default=None, min_length=1, max_length=160)
    value_json: dict[str, Any] | None = None

    @field_validator("value_json")
    @classmethod
    def limit_optional_value_size(
        cls, value: dict[str, Any] | None
    ) -> dict[str, Any] | None:
        if value is None:
            return value
        return MemoryCreateRequest.limit_value_size(value)


class MemorySettings(BaseModel):
    enabled: bool = True
    updated_at: datetime | None = None


class MemorySettingsUpdate(BaseModel):
    enabled: bool


class MemoryContextUsage(BaseModel):
    id: str
    category: MemoryCategory
    label: str


class MemoryListResponse(BaseModel):
    memories: list[UserMemory]
    settings: MemorySettings


MemoryStatusFilter = Literal["candidate", "confirmed", "rejected", "all"]
