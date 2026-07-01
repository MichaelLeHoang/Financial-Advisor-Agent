from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from src.api.news_routes import CATEGORY_MAP
from src.market_intelligence.models import MarketIntelligenceResponse
from src.market_intelligence.service import build_market_intelligence


router = APIRouter(prefix="/api/v1", tags=["market-intelligence"])


@router.get("/market-intelligence", response_model=MarketIntelligenceResponse)
async def get_market_intelligence(
    categories: str = Query(
        default="market",
        description="Comma-separated category keys. Max 3.",
    ),
    limit: int = Query(default=30, ge=1, le=50),
) -> MarketIntelligenceResponse:
    requested = [category.strip().lower() for category in categories.split(",") if category.strip()][:3]
    valid = [category for category in requested if category in CATEGORY_MAP]
    if not valid:
        raise HTTPException(status_code=400, detail=f"No valid categories. Choose from: {list(CATEGORY_MAP.keys())}")
    return await build_market_intelligence(valid, limit=limit)
