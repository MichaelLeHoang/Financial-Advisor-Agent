from fastapi import APIRouter, Depends, HTTPException

from src.auth.supabase import get_current_or_guest_user
from src.backtesting.market_data import YFinanceMarketDataAdapter
from src.llm.routing_policy import RoutingPolicy
from src.quant.calculations import compare_strategies, export_strategy, rank_signals, validate_strategy
from src.quant.models import (
    AdvancedValidationRequest,
    AdvancedValidationResponse,
    SignalRankingRequest,
    SignalRankingResponse,
    StrategyComparisonRequest,
    StrategyComparisonResponse,
    StrategyExportRequest,
    StrategyExportResponse,
)
from src.saas.entitlements import FeatureKey, enforce_feature
from src.saas.models import AuthenticatedUser, QuantValidationRunCreate, StrategyExportCreate
from src.saas.repository import get_store


router = APIRouter(prefix="/api/v1/quant", tags=["quant"])


@router.post("/strategy-compare", response_model=StrategyComparisonResponse)
async def strategy_compare(
    req: StrategyComparisonRequest,
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
) -> StrategyComparisonResponse:
    enforce_feature(user, FeatureKey.STRATEGY_COMPARE)
    try:
        return compare_strategies(req, YFinanceMarketDataAdapter())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Unable to compare strategies: {exc}") from exc


@router.post("/validation", response_model=AdvancedValidationResponse)
async def advanced_validation(
    req: AdvancedValidationRequest,
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
) -> AdvancedValidationResponse:
    enforce_feature(user, FeatureKey.ADVANCED_VALIDATION)
    try:
        results, equity_curve = validate_strategy(req, YFinanceMarketDataAdapter())
        saved = get_store(user).create_quant_validation_run(
            user.id,
            QuantValidationRunCreate(
                strategy_name=req.strategy_name,
                strategy_type=req.strategy_type,
                symbols=req.symbols,
                method="walk_forward_monte_carlo_bootstrap",
                parameters=req.parameters,
                assumptions={
                    "start_date": req.start_date.isoformat(),
                    "end_date": req.end_date.isoformat(),
                    "initial_capital": req.initial_capital,
                    "fees_bps": req.fees_bps,
                    "slippage_bps": req.slippage_bps,
                    "position_size": req.position_size,
                    "equity_curve": equity_curve,
                },
                results={
                    "walk_forward": results["walk_forward"],
                    "monte_carlo": results["monte_carlo"],
                    "bootstrap": results["bootstrap"],
                },
            ),
        )
        return AdvancedValidationResponse(
            base_metrics=results["base_metrics"],
            walk_forward=results["walk_forward"],
            monte_carlo=results["monte_carlo"],
            bootstrap=results["bootstrap"],
            saved_run_id=str(saved.id),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Unable to validate strategy: {exc}") from exc


@router.post("/signals/rank", response_model=SignalRankingResponse)
async def signal_ranking(
    req: SignalRankingRequest,
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
) -> SignalRankingResponse:
    enforce_feature(user, FeatureKey.SIGNAL_RANKING)
    try:
        return SignalRankingResponse(rankings=rank_signals(req, YFinanceMarketDataAdapter()))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Unable to rank signals: {exc}") from exc


@router.post("/export", response_model=StrategyExportResponse)
async def strategy_export(
    req: StrategyExportRequest,
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
) -> StrategyExportResponse:
    enforce_feature(user, FeatureKey.EXPORT_CENTER)
    decision = RoutingPolicy().choose(plan=user.plan, task_type="coding_export", preferred_mode="coding_export")
    try:
        response = export_strategy(req)
        saved = get_store(user).create_strategy_export(
            user.id,
            StrategyExportCreate(
                strategy_name=req.strategy_name,
                strategy_type=req.strategy_type,
                language=req.language,
                parameters=req.parameters,
                content=response.content,
            ),
        )
        return response.model_copy(update={"saved_export_id": str(saved.id), "routed_mode": decision.resolved_mode})
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to export strategy: {exc}") from exc
