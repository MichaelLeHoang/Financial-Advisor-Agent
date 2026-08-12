from __future__ import annotations

import asyncio

from fastapi import APIRouter, HTTPException, Query

from src.data.crypto_market_service import crypto_market_service
from src.models.crypto_market import (
    CryptoContextResponse,
    CryptoOverviewResponse,
    CryptoSeriesResponse,
    FearGreedResponse,
    HalvingCycleResponse,
)


router = APIRouter(prefix="/api/v1/crypto", tags=["crypto-market"])
CRYPTO_TIMEOUT_SECONDS = 12


async def _run_provider(callable_, *args):
    try:
        return await asyncio.wait_for(
            asyncio.to_thread(callable_, *args), timeout=CRYPTO_TIMEOUT_SECONDS
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except asyncio.TimeoutError as exc:
        raise HTTPException(
            status_code=504, detail="The crypto data provider timed out. Try again shortly."
        ) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.get("/assets/{base}/overview", response_model=CryptoOverviewResponse)
async def crypto_overview(base: str, quote: str = Query("CAD")):
    return await _run_provider(crypto_market_service.overview, base, quote)


@router.get("/assets/{base}/series", response_model=CryptoSeriesResponse)
async def crypto_series(
    base: str,
    quote: str = Query("CAD"),
    range: str = Query("1Y"),
):
    return await _run_provider(crypto_market_service.series, base, quote, range)


@router.get("/assets/{base}/context", response_model=CryptoContextResponse)
async def crypto_context(
    base: str,
    quote: str = Query("CAD"),
    sentiment_range: str = Query("30D"),
):
    return await _run_provider(
        crypto_market_service.context, base, quote, sentiment_range
    )


@router.get("/assets/BTC/cycle", response_model=HalvingCycleResponse)
async def bitcoin_halving_cycle():
    return await _run_provider(crypto_market_service.halving)


@router.get("/sentiment/fear-greed", response_model=FearGreedResponse)
async def fear_greed(range: str = Query("30D")):
    return await _run_provider(crypto_market_service.fear_greed, range)
