from datetime import date
from uuid import UUID

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, status

from src.auth.supabase import get_current_or_guest_user
from src.backtesting.engine import run_backtest
from src.backtesting.market_data import YFinanceMarketDataAdapter
from src.backtesting.models import (
    BacktestRequest,
    BacktestResult,
    Candle,
    CandleResponse,
    StrategyOption,
)
from src.saas.entitlements import FeatureKey, enforce_feature
from src.saas.models import (
    AuthenticatedUser,
    BacktestRunCreate,
    BacktestRunRead,
    ReplaySessionCreate,
    ReplaySessionRead,
    ReplaySessionUpdate,
    StrategyCreate,
    StrategyRead,
)
from src.saas.repository import get_store


router = APIRouter(prefix="/api/v1/backtests", tags=["backtesting"])

MAX_CANDLE_SYMBOLS = 10
MAX_CANDLE_RANGE_DAYS = 4017  # ~11 years of daily bars


STRATEGY_OPTIONS = [
    StrategyOption(
        type="buy_and_hold",
        name="Buy and hold benchmark",
        description="Buys each selected asset and holds through the full period.",
        default_parameters={},
    ),
    StrategyOption(
        type="moving_average_crossover",
        name="Moving average crossover",
        description="Long-only crossover using short and long simple moving averages.",
        default_parameters={"short_window": 20, "long_window": 50},
    ),
    StrategyOption(
        type="rsi_mean_reversion",
        name="RSI mean reversion",
        description="Long-only entries when RSI is oversold and exits on recovery.",
        default_parameters={"rsi_window": 14, "buy_threshold": 30, "sell_threshold": 55},
    ),
]


def _frame_to_candles(frame: pd.DataFrame) -> list[Candle]:
    candles = []
    for timestamp, row in frame.iterrows():
        volume = row.get("Volume")
        candles.append(
            Candle(
                date=timestamp.date() if hasattr(timestamp, "date") else timestamp,
                open=round(float(row["Open"]), 4),
                high=round(float(row["High"]), 4),
                low=round(float(row["Low"]), 4),
                close=round(float(row["Close"]), 4),
                volume=float(volume) if volume is not None and pd.notna(volume) else None,
            )
        )
    return candles


def _fetch_candles(symbols: list[str], start: date, end: date) -> dict[str, list[Candle]]:
    if end <= start:
        raise HTTPException(status_code=400, detail="end must be after start")
    if (end - start).days > MAX_CANDLE_RANGE_DAYS:
        raise HTTPException(status_code=400, detail="Date range is too large for daily candles")

    try:
        frames = YFinanceMarketDataAdapter().fetch_ohlc(symbols, start, end)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Unable to fetch market data: {exc}") from exc

    missing = sorted(set(symbols) - set(frames))
    if missing:
        raise HTTPException(status_code=400, detail=f"No daily price data returned for: {', '.join(missing)}")
    return {symbol: _frame_to_candles(frame) for symbol, frame in frames.items()}


@router.get("/strategies/options", response_model=list[StrategyOption])
async def strategy_options() -> list[StrategyOption]:
    return STRATEGY_OPTIONS


@router.get("/strategies", response_model=list[StrategyRead])
async def list_strategies(user: AuthenticatedUser = Depends(get_current_or_guest_user)) -> list[StrategyRead]:
    enforce_feature(user, FeatureKey.BACKTESTING)
    return get_store(user).list_strategies(user.id)


@router.post("/run", response_model=BacktestResult)
async def create_backtest(
    req: BacktestRequest,
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
) -> BacktestResult:
    enforce_feature(user, FeatureKey.BACKTESTING)

    try:
        metrics, equity_curve, trades, price_series = run_backtest(req, YFinanceMarketDataAdapter())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Unable to run backtest: {exc}") from exc

    strategy_id = req.strategy_id
    if req.save_strategy and strategy_id is None:
        strategy = get_store(user).create_strategy(
            user.id,
            StrategyCreate(name=req.strategy_name, strategy_type=req.strategy_type, parameters=req.parameters),
        )
        strategy_id = strategy.id

    assumptions = {
        "initial_capital": req.initial_capital,
        "fees_bps": req.fees_bps,
        "slippage_bps": req.slippage_bps,
        "position_size": req.position_size,
        "start_date": req.start_date.isoformat(),
        "end_date": req.end_date.isoformat(),
        "data_source": "yfinance_development",
    }
    run = get_store(user).create_backtest_run(
        user.id,
        BacktestRunCreate(
            strategy_id=strategy_id,
            strategy_name=req.strategy_name,
            strategy_type=req.strategy_type,
            symbols=req.symbols,
            parameters=req.parameters,
            assumptions=assumptions,
            metrics=metrics.model_dump(),
            equity_curve=[point.model_dump(mode="json") for point in equity_curve],
        ),
        trades,
    )

    return BacktestResult(run=run, metrics=metrics, equity_curve=equity_curve, trades=trades, price_series=price_series)


@router.get("/runs")
async def list_backtest_runs(
    limit: int = 20,
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
):
    enforce_feature(user, FeatureKey.BACKTESTING)
    return get_store(user).list_backtest_runs(user.id, limit=max(1, min(limit, 50)))


@router.get("/runs/{run_id}", response_model=BacktestRunRead)
async def get_backtest_run(
    run_id: UUID,
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
) -> BacktestRunRead:
    enforce_feature(user, FeatureKey.BACKTESTING)
    run = get_store(user).get_backtest_run(user.id, run_id)
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Backtest run not found")
    return run


@router.delete("/runs/{run_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_backtest_run(
    run_id: UUID,
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
) -> None:
    enforce_feature(user, FeatureKey.BACKTESTING)
    removed = get_store(user).delete_backtest_run(user.id, run_id)
    if not removed:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Backtest run not found")


@router.get("/market-data/candles", response_model=CandleResponse)
async def market_data_candles(
    symbols: str,
    start: date,
    end: date,
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
) -> CandleResponse:
    enforce_feature(user, FeatureKey.BACKTESTING)

    parsed: list[str] = []
    for symbol in symbols.split(","):
        normalized = symbol.strip().upper()
        if normalized and normalized not in parsed:
            parsed.append(normalized)
    if not parsed:
        raise HTTPException(status_code=400, detail="At least one symbol is required")
    if len(parsed) > MAX_CANDLE_SYMBOLS:
        raise HTTPException(status_code=400, detail=f"At most {MAX_CANDLE_SYMBOLS} symbols are allowed")

    return CandleResponse(candles=_fetch_candles(parsed, start, end))


@router.post("/replay-sessions", response_model=ReplaySessionRead)
async def create_replay_session(
    req: ReplaySessionCreate,
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
) -> ReplaySessionRead:
    enforce_feature(user, FeatureKey.BACKTESTING)

    candles = _fetch_candles([req.symbol], req.start_date, req.end_date)[req.symbol]
    if len(candles) < 2:
        raise HTTPException(status_code=400, detail=f"Not enough daily price data for {req.symbol} in that range")

    return get_store(user).create_replay_session(user.id, req, total_bars=len(candles))


@router.get("/replay-sessions", response_model=list[ReplaySessionRead])
async def list_replay_sessions(
    limit: int = 50,
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
) -> list[ReplaySessionRead]:
    enforce_feature(user, FeatureKey.BACKTESTING)
    return get_store(user).list_replay_sessions(user.id, limit=max(1, min(limit, 100)))


@router.get("/replay-sessions/{session_id}", response_model=ReplaySessionRead)
async def get_replay_session(
    session_id: UUID,
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
) -> ReplaySessionRead:
    enforce_feature(user, FeatureKey.BACKTESTING)
    session = get_store(user).get_replay_session(user.id, session_id)
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Replay session not found")
    return session


@router.patch("/replay-sessions/{session_id}", response_model=ReplaySessionRead)
async def update_replay_session(
    session_id: UUID,
    req: ReplaySessionUpdate,
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
) -> ReplaySessionRead:
    enforce_feature(user, FeatureKey.BACKTESTING)
    session = get_store(user).update_replay_session(user.id, session_id, req)
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Replay session not found")
    return session


@router.delete("/replay-sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_replay_session(
    session_id: UUID,
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
) -> None:
    enforce_feature(user, FeatureKey.BACKTESTING)
    removed = get_store(user).delete_replay_session(user.id, session_id)
    if not removed:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Replay session not found")
