from fastapi import APIRouter, Depends, HTTPException

from src.auth.supabase import get_current_or_guest_user
from src.backtesting.engine import run_backtest
from src.backtesting.market_data import YFinanceMarketDataAdapter
from src.backtesting.models import BacktestRequest, BacktestResult, StrategyOption
from src.saas.entitlements import FeatureKey, enforce_feature
from src.saas.models import AuthenticatedUser, BacktestRunCreate, StrategyCreate, StrategyRead
from src.saas.repository import get_store


router = APIRouter(prefix="/api/v1/backtests", tags=["backtesting"])


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
        metrics, equity_curve, trades = run_backtest(req, YFinanceMarketDataAdapter())
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

    return BacktestResult(run=run, metrics=metrics, equity_curve=equity_curve, trades=trades)


@router.get("/runs")
async def list_backtest_runs(
    limit: int = 20,
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
):
    enforce_feature(user, FeatureKey.BACKTESTING)
    return get_store(user).list_backtest_runs(user.id, limit=max(1, min(limit, 50)))
