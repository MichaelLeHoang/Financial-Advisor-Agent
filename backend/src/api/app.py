import asyncio
from typing import Literal

from fastapi import Depends, FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials
import inngest.fast_api

from src.jobs.inngest_client import inngest_client
from src.jobs.functions import (
    scheduled_new_ingestion,   
    on_demand_news_ingestion,
    scheduled_alert_evaluation,
)
from src.rag.pipeline import ask as rag_ask
from src.services.ingestion import ingest_news

from src.ml.preprocessing import prepare_training_data
from src.ml.models import RandomForestPredictor, LSTMPredictor, evaluate_model
from src.ml.ensemble import EnsemblePredictionService, PredictionDataError
from src.ml.valuation import build_valuation_payload, combine_ml_and_valuation_signal
from src.ml.sentiment import SentimentAnalyzer

from src.quantum.portfolio import optimize_portfolio, quantum_optimize_portfolio
from src.agent.agent import FinancialAdvisorAgent
from src.config import settings
from src.data.market_data_service import market_data_service
from src.data.vector_db import get_qdrant_client
from src.auth.supabase import get_current_or_guest_user, get_current_user
from src.saas.entitlements import FeatureKey, enforce_feature
from src.saas.models import AuthenticatedUser
from src.saas.routes import router as saas_router
from src.saas.usage import usage_tracker
from src.billing.routes import router as billing_router
from src.backtesting.routes import router as backtesting_router
from src.notifications.routes import router as notifications_router
from src.risk.routes import router as risk_router
from src.journal.routes import router as journal_router
from src.quant.routes import router as quant_router
from src.api.news_routes import router as news_router
from src.api.routes.intelligence import router as intelligence_router
from src.api.equity_research import router as equity_research_router
from src.investment_policy.routes import router as investment_policy_router
from src.investment_workspace.routes import router as investment_workspace_router
from src.llm.routing_policy import LLMMode
from src.core.redis_client import RedisUnavailable

from pydantic import BaseModel, Field
import math

MARKET_QUOTE_TIMEOUT_SECONDS = 12
MARKET_SEARCH_TIMEOUT_SECONDS = 6

app = FastAPI(
    title=settings.app_name,
    description="AI-powered financial advisor with RAG, ML prediction, and Quantum optimization",
    version=settings.app_version,
)

# CORS — allow the Next.js frontend to call the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?" if settings.app_env == "development" else None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(saas_router)
app.include_router(billing_router)
app.include_router(backtesting_router)
app.include_router(notifications_router)
app.include_router(risk_router)
app.include_router(journal_router)
app.include_router(quant_router)
app.include_router(news_router)
app.include_router(intelligence_router)
app.include_router(equity_research_router)
app.include_router(investment_policy_router)
app.include_router(investment_workspace_router)

# Register Inngest with FastAPI
inngest.fast_api.serve(
    app,
    inngest_client,
    [scheduled_new_ingestion, on_demand_news_ingestion, scheduled_alert_evaluation],
)

# Lazy cache: agent setup is expensive, but model routing can vary by user plan/mode.
_agents: dict[tuple[str, str, str, str], FinancialAdvisorAgent] = {}

def get_agent(
    *,
    user: AuthenticatedUser | None = None,
    task_type: str = "chat",
    preferred_mode: LLMMode | None = None,
) -> FinancialAdvisorAgent:
    user_id = str(user.id) if user else "guest"
    plan = user.plan if user else "free"
    mode = preferred_mode or settings.default_llm_mode
    key = (user_id, str(plan), task_type, mode)
    if key not in _agents:
        _agents[key] = FinancialAdvisorAgent(
            user_id=user_id,
            plan=plan,
            task_type=task_type,
            preferred_mode=preferred_mode,
        )
    return _agents[key]

# Request/Response Models
class PredictRequest(BaseModel):
    ticker: str = "AAPL"
    model_type: str = "ensemble"  # "random_forest", "lstm", or "ensemble"
    model: str | None = None
    sequence_length: int = 5
    horizon_days: int = Field(default=1, ge=1)
    lookback_period: str = "2y"
    target: str = "return"
    include_validation: bool = True
    include_backtest: bool = True

class SentimentRequest(BaseModel):
    texts: list[str]

class OptimizeRequest(BaseModel):
    tickers: list[str] = ["AAPL", "NVDA", "GOOGL", "TSLA", "AMZN"]
    method: str = "classical"  # "classical" or "quantum"
    risk_tolerance: float = 1.0
    target_assets: int = 3

class AgentChatRequest(BaseModel):
    message: str
    remember: bool = True  # maintain multi-turn conversation history
    session_id: str = "default"
    preferred_mode: LLMMode | None = None
    mode: Literal["sabi", "single", "consensus", "research", "auto"] = "sabi"

class AgentSessionRenameRequest(BaseModel):
    title: str

class AgentSessionCreateRequest(BaseModel):
    session_id: str
    title: str = "New chat"

class AgentSessionMessageAppendRequest(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str = Field(min_length=1)
    metadata: dict | None = None

class AgentJobCreateResponse(BaseModel):
    job_id: str
    status: str
    queue_position: int | None = None


class AgentJobProgress(BaseModel):
    mode: str
    active_tool: str | None = None
    completed_tools: list[str] = Field(default_factory=list)
    active_label: str | None = None
    message: str | None = None
    sequence: int = 0
    updated_at: float | None = None


class AgentJobStatusResponse(BaseModel):
    job_id: str
    status: str
    queue_position: int | None = None
    progress: AgentJobProgress | None = None
    progress_events: list[AgentJobProgress] = Field(default_factory=list)
    result: dict | None = None
    error: dict | None = None
    created_at: float | None = None
    started_at: float | None = None
    finished_at: float | None = None


def _chat_session_conflict_message() -> str:
    return "Chat session not found"


def _ensure_chat_session_available(session_id: str, user: AuthenticatedUser) -> None:
    """Reject client-supplied session ids that already belong to another user."""
    if user.is_guest:
        return
    from src.agent.history import session_claimed_by_another_user

    if session_claimed_by_another_user(session_id, str(user.id)):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_chat_session_conflict_message())


def _ensure_chat_session_owned(session_id: str, user: AuthenticatedUser) -> None:
    """Require an existing saved session owned by the current authenticated user."""
    if user.is_guest:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sign in to use saved chat sessions.")
    from src.agent.history import session_belongs_to_user

    if not session_belongs_to_user(session_id, str(user.id)):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_chat_session_conflict_message())

class EarningsPoint(BaseModel):
    date: str
    eps_actual: float | None = None
    eps_estimate: float | None = None
    beat_pct: float | None = None
    revenue_actual: float | None = None
    revenue_estimate: float | None = None
    revenue_beat_pct: float | None = None

class QuarterlyFinancial(BaseModel):
    period: str
    revenue: float | None = None
    net_income: float | None = None
    diluted_eps: float | None = None
    net_profit_margin: float | None = None
    revenue_yoy: float | None = None
    net_income_yoy: float | None = None
    eps_yoy: float | None = None
    margin_yoy: float | None = None

class MarketQuotePoint(BaseModel):
    label: str
    price: float
    volume: int
    open: float | None = None
    high: float | None = None
    low: float | None = None

class MarketSymbolSearchResult(BaseModel):
    ticker: str
    name: str
    exchange: str | None = None
    sector: str | None = None
    quote_type: str | None = None

class MarketQuoteResponse(BaseModel):
    ticker: str
    name: str
    exchange: str | None = None
    sector: str | None = None
    price: float
    change: float
    currency: str | None = None
    open_price: float | None = None
    day_high: float | None = None
    day_low: float | None = None
    market_cap: float | None = None
    volume: int | None = None
    pe_ratio: float | None = None
    fifty_two_week_high: float | None = None
    fifty_two_week_low: float | None = None
    dividend_yield: float | None = None
    dividend_rate: float | None = None
    quarterly_dividend_amount: float | None = None
    history: list[MarketQuotePoint]
    earnings: list[EarningsPoint] = []
    quarterly_financials: list[QuarterlyFinancial] = []
    data_sources: list[str] = []
    source_quality: dict | None = None
    provider_status: list[dict] = []


def _service_state(configured: bool, ok: bool | None = None, detail: str | None = None) -> dict:
    if ok is True:
        status = "ok"
    elif ok is False:
        status = "error"
    else:
        status = "configured" if configured else "missing_config"

    payload = {"status": status, "configured": configured}
    if detail:
        payload["detail"] = detail
    return payload


def _check_qdrant() -> dict:
    configured = bool(settings.qdrant_url)
    if not configured:
        return _service_state(False, detail="QDRANT_URL is not set")

    try:
        collections = get_qdrant_client().get_collections()
        return {
            **_service_state(True, ok=True),
            "url": settings.qdrant_url,
            "collections": len(collections.collections),
        }
    except Exception as exc:
        return {
            **_service_state(True, ok=False, detail=str(exc)),
            "url": settings.qdrant_url,
        }


def _check_redis() -> dict:
    try:
        from src.core.redis_client import get_redis_client

        client = get_redis_client()
        client.ping()
        return _service_state(True, ok=True)
    except RedisUnavailable as exc:
        return _service_state(False, detail=str(exc))
    except Exception as exc:
        return _service_state(True, ok=False, detail=str(exc))


def _llm_key_status() -> dict:
    providers = {
        "google": settings.is_configured("gemini_api_key"),
        "openai": settings.is_configured("openai_api_key"),
        "anthropic": settings.is_configured("anthropic_api_key"),
        "openrouter": settings.is_configured("openrouter_api_key"),
    }
    default_provider_ready = providers.get(settings.default_llm_provider, False)

    return {
        "status": "configured" if default_provider_ready else "missing_config",
        "default_provider": settings.default_llm_provider,
        "default_mode": settings.default_llm_mode,
        "providers": providers,
    }


CORE_STATUS_SERVICES = {"database", "supabase", "llm"}
OPTIONAL_STATUS_SERVICES = {"qdrant", "redis", "jobs", "billing", "notifications"}


def _status_rollup(services: dict[str, dict]) -> dict:
    core_errors = [
        name
        for name, service in services.items()
        if name in CORE_STATUS_SERVICES and service["status"] == "error"
    ]
    optional_errors = [
        name
        for name, service in services.items()
        if name in OPTIONAL_STATUS_SERVICES and service["status"] == "error"
    ]
    status = "error" if core_errors else "degraded" if optional_errors else "ok"

    return {
        "status": status,
        "core_status": "error" if core_errors else "ok",
        "optional_status": "degraded" if optional_errors else "ok",
        "core_error_services": core_errors,
        "degraded_optional_services": optional_errors,
    }


def _market_data_status() -> dict:
    providers = {
        "finnhub": settings.is_configured("finnhub_api_key"),
        "alpha_vantage": settings.is_configured("alpha_vantage_api_key"),
        "sec_edgar": bool(settings.sec_user_agent),
        "yfinance_fallback": True,
    }
    return {
        "status": "configured" if providers["finnhub"] or providers["alpha_vantage"] else "fallback_only",
        "providers": providers,
        "primary_order": ["finnhub", "alpha_vantage", "sec_edgar", "yfinance_fallback"],
    }

# basic api endpoints 

@app.get("/health")

async def health_check():
    """Simple health check endpoint"""
    return {"status": "ok", "service": "Financial Advisor API"}


@app.get("/api/v1/status")
async def service_status():
    """
    Report SaaS foundation service readiness.

    This endpoint is safe for deployment health dashboards: it reports whether
    required service configuration is present and checks Qdrant reachability.
    It never returns secret values.
    """
    services = {
        "database": _service_state(settings.is_configured("database_url")),
        "supabase": _service_state(
            bool(settings.supabase_url and settings.is_configured("supabase_service_role_key"))
        ),
        "qdrant": _check_qdrant(),
        "redis": _check_redis(),
        "llm": _llm_key_status(),
        "jobs": _service_state(
            bool(settings.inngest_app_id and settings.news_ingestion_cron),
            detail=f"cron={settings.news_ingestion_cron}",
        ),
        "billing": _service_state(
            settings.is_configured("stripe_secret_key") and settings.is_configured("stripe_webhook_secret")
        ),
        "notifications": _service_state(
            settings.is_configured("resend_api_key")
            or settings.is_configured("telegram_bot_token")
            or settings.is_configured("notification_secret_key")
        ),
        "market_data": _market_data_status(),
    }
    rollup = _status_rollup(services)

    return {
        **rollup,
        "environment": settings.app_env,
        "version": settings.app_version,
        "services": services,
    }

def _fetch_market_quote_response(normalized: str, period: str, interval: str) -> MarketQuoteResponse:
    snapshot = market_data_service.fetch_snapshot(
        normalized,
        period=period,
        interval=interval,
        include_news=False,
        include_sec=False,
        include_fundamentals=False,
    )
    if snapshot.latest_price is None and not snapshot.history:
        raise HTTPException(status_code=404, detail=f"No market data found for {normalized}")

    history_points = [
        MarketQuotePoint(
            label=point.label,
            price=point.price,
            volume=point.volume,
            open=_round_optional(point.open),
            high=_round_optional(point.high),
            low=_round_optional(point.low),
        )
        for point in snapshot.history
    ]
    if not history_points:
        history_points = _fallback_quote_history(snapshot, period)

    return MarketQuoteResponse(
        ticker=normalized,
        name=snapshot.company_name or normalized,
        exchange=snapshot.exchange,
        sector=snapshot.sector,
        price=round(float(snapshot.latest_price or (snapshot.history[-1].price if snapshot.history else 0)), 2),
        change=round(float(snapshot.daily_change or 0), 2),
        currency=snapshot.currency,
        open_price=_round_optional(snapshot.open_price),
        day_high=_round_optional(snapshot.day_high),
        day_low=_round_optional(snapshot.day_low),
        market_cap=snapshot.market_cap,
        volume=snapshot.volume,
        pe_ratio=_round_optional(snapshot.pe_ratio),
        fifty_two_week_high=_round_optional(snapshot.fifty_two_week_high),
        fifty_two_week_low=_round_optional(snapshot.fifty_two_week_low),
        dividend_yield=_round_optional(snapshot.dividend_yield),
        dividend_rate=_round_optional(snapshot.dividend_rate),
        quarterly_dividend_amount=_round_optional((snapshot.dividend_rate / 4) if snapshot.dividend_rate else None),
        history=history_points,
        data_sources=snapshot.data_sources,
        source_quality=snapshot.source_quality,
        provider_status=[status.__dict__ for status in snapshot.provider_status],
    )

def _fallback_quote_history(snapshot, period: str) -> list[MarketQuotePoint]:
    latest = _round_optional(snapshot.latest_price)
    if latest is None:
        return []
    baseline = _round_optional(snapshot.open_price if period == "1d" else snapshot.previous_close)
    if baseline is None:
        baseline = _round_optional(snapshot.previous_close) or latest
    volume = int(snapshot.volume or 0)
    high = _round_optional(snapshot.day_high)
    low = _round_optional(snapshot.day_low)
    return [
        MarketQuotePoint(
            label="Open" if period == "1d" else "Previous",
            price=baseline,
            volume=volume,
            open=baseline,
            high=high,
            low=low,
        ),
        MarketQuotePoint(
            label="Now",
            price=latest,
            volume=volume,
            open=baseline,
            high=high,
            low=low,
        ),
    ]


@app.get("/api/v1/market/quote/{ticker}", response_model=MarketQuoteResponse)
async def market_quote(ticker: str, period: str = "1mo", interval: str = "1d"):
    """
    Fetch current quote and recent chart data for a market symbol.
    """
    normalized = ticker.strip().upper()
    if not normalized:
        raise HTTPException(status_code=400, detail="Ticker is required")

    try:
        return await asyncio.wait_for(
            asyncio.to_thread(_fetch_market_quote_response, normalized, period, interval),
            timeout=MARKET_QUOTE_TIMEOUT_SECONDS,
        )
    except asyncio.TimeoutError as exc:
        raise HTTPException(
            status_code=504,
            detail=f"Market data provider timed out for {normalized}. Try again shortly.",
        ) from exc


def _search_market_symbols(query: str, safe_limit: int) -> list[MarketSymbolSearchResult]:
    try:
        return [
            MarketSymbolSearchResult(
                ticker=row["ticker"],
                name=row["name"],
                exchange=row.get("exchange"),
                sector=row.get("sector"),
                quote_type=row.get("quote_type"),
            )
            for row in market_data_service.search_symbols(query, safe_limit)
        ]
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Unable to search market symbols: {exc}")


@app.get("/api/v1/market/search", response_model=list[MarketSymbolSearchResult])
async def market_search(q: str, limit: int = 12):
    """
    Search market symbols using Yahoo Finance search via yfinance.
    """
    query = q.strip()
    if len(query) < 1:
        return []

    safe_limit = max(1, min(limit, 25))

    try:
        return await asyncio.wait_for(
            asyncio.to_thread(_search_market_symbols, query, safe_limit),
            timeout=MARKET_SEARCH_TIMEOUT_SECONDS,
        )
    except asyncio.TimeoutError as exc:
        raise HTTPException(
            status_code=504,
            detail=f"Market search provider timed out for {query}. Try again shortly.",
        ) from exc

def _round_optional(value: float | int | None, digits: int = 4) -> float | None:
    if value is None:
        return None
    return round(float(value), digits)

def _safe_float(val) -> float | None:
    try:
        f = float(val)
        return None if math.isnan(f) or math.isinf(f) else f
    except (TypeError, ValueError):
        return None

def _scaled_close_to_price(scaler, close_value: float) -> float:
    n_features = int(getattr(scaler, "n_features_in_", 1) or 1)
    row = [[0.0 for _ in range(n_features)]]
    row[0][0] = float(close_value)
    return float(scaler.inverse_transform(row)[0][0])

def _yoy_pct(current: float | None, previous: float | None) -> float | None:
    if current is None or previous is None or previous == 0:
        return None
    return round((current - previous) / abs(previous) * 100, 2)

def _get_fin_metric(df, row_key: str, col) -> float | None:
    if row_key in df.index and col in df.columns:
        return _safe_float(df.loc[row_key, col])
    return None

# Rag Endpoints

@app.post("/api/v1/query")
async def query(
    question: str = Query(min_length=1, max_length=4_000),
    ticker: str | None = Query(default=None, min_length=1, max_length=20, pattern=r"^[A-Za-z0-9.^=-]+$"),
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
):
    """
    Ask the financial advisor a question. 

    Example: POST /api/v1/query?question=How is Apple doing?&ticker=AAPL
    """
    enforce_feature(user, FeatureKey.AI_RESEARCH)
    usage_tracker.increment(user, FeatureKey.AI_RESEARCH, "ai_messages_per_day")
    response = await asyncio.to_thread(rag_ask, question, ticker_filter=ticker.upper() if ticker else None)
    return {
        "answer": response.answer, 
        "confidence": response.confidence,
        "sources": [
            {
                "title": s.metadata.title, 
                "source": s.metadata.source, 
                "score": s.score,
            }
            for s in response.sources
        ],
    }

@app.post("/api/v1/ingest")
async def trigger_ingestion(
    tickers: list[str] = Query(default=["AAPL", "NVDA"], min_length=1, max_length=20),
    _user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Manually trigger news ingestion for specific tickers. 
    """

    if settings.app_env != "development":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    normalized = []
    for ticker in tickers:
        symbol = ticker.strip().upper()
        if not symbol or len(symbol) > 20 or not all(char.isalnum() or char in ".^=-" for char in symbol):
            raise HTTPException(status_code=422, detail="Invalid ticker")
        normalized.append(symbol)

    stats = await asyncio.to_thread(ingest_news, normalized)
    return {
        "status": "completed",
        "stats": stats,
    }

# ML endpoints 
@app.post("/api/v1/predict")
async def predict_stock(req: PredictRequest, user: AuthenticatedUser = Depends(get_current_or_guest_user)):
    """
    Train a model on historical data and predict direction.
    POST /api/v1/predict
    {"ticker": "AAPL", "model_type": "random_forest", "sequence_length": 5}
    {"ticker": "AAPL", "model": "ensemble", "include_validation": true}
    """
    enforce_feature(user, FeatureKey.ML_PREDICTION)
    selected_model = (req.model or req.model_type or "ensemble").strip().lower()
    ticker = req.ticker.strip().upper()
    if not ticker:
        raise HTTPException(status_code=400, detail="Ticker is required")
    if selected_model == "ensemble":
        if req.target != "return":
            raise HTTPException(status_code=400, detail="Only target='return' is supported for ensemble predictions")
        try:
            service = EnsemblePredictionService()
            return await asyncio.to_thread(
                service.predict_with_models,
                ticker,
                horizon_days=req.horizon_days,
                lookback_period=req.lookback_period,
                target=req.target,
                include_validation=req.include_validation,
                include_backtest=req.include_backtest,
                sequence_length=max(req.sequence_length, 2),
            )
        except PredictionDataError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Unable to run ensemble prediction for {ticker}: {exc}") from exc

    try:
        data = prepare_training_data(
            ticker,
            sequence_length=req.sequence_length,
            model_type=selected_model,
        )
        if selected_model == "random_forest":
            model = RandomForestPredictor(n_estimators=200)
        elif selected_model == "lstm":
            model = LSTMPredictor(epochs=20)
        else:
            raise HTTPException(status_code=400, detail="Invalid model. Must be 'random_forest', 'lstm', or 'ensemble'")
        
        train_metrics = model.train(data["X_train"], data["y_train"])
        test_metrics = evaluate_model(model, data["X_test"], data["y_test"], data["scaler"])
        last_pred = float(model.predict(data["X_test"][-1:])[0])
        last_actual = float(data["y_test"][-1])
        current_price = _scaled_close_to_price(data["scaler"], last_actual)
        predicted_price = _scaled_close_to_price(data["scaler"], last_pred)
        predicted_return = ((predicted_price - current_price) / current_price) if current_price else 0.0
        ml_prediction = "UP" if predicted_return > 0.0005 else "DOWN" if predicted_return < -0.0005 else "NEUTRAL"
        valuation_payload = build_valuation_payload(current_price=current_price, fundamentals={})
        
        return {
            "ticker": ticker,
            "model_type": selected_model,
            "train_metrics": train_metrics,
            "test_metrics": test_metrics,
            "current_price": round(current_price, 4),
            "currentPrice": round(current_price, 4),
            "ml_prediction": ml_prediction,
            "valuation_status": valuation_payload["valuation_status"],
            "valuation_target": valuation_payload["valuation_target"],
            "target_price": valuation_payload["target_price"],
            "implied_upside": valuation_payload["implied_upside"],
            "valuation_signal": valuation_payload["valuation_signal"],
            "final_signal": combine_ml_and_valuation_signal(ml_prediction, valuation_payload.get("valuation_signal")),
            "confidence": "low",
            "mae": test_metrics.get("test_mae"),
            "rmse": test_metrics.get("test_rmse"),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/sentiment")
async def analyze_sentiment(req: SentimentRequest, user: AuthenticatedUser = Depends(get_current_or_guest_user)):
    """
    Analyze sentiment of financial texts.
    POST /api/v1/sentiment
    {"texts": ["Apple beat earnings", "Tesla recalls vehicles"]}
    """
    enforce_feature(user, FeatureKey.SENTIMENT)
    usage_tracker.increment(user, FeatureKey.SENTIMENT, "sentiment_requests_per_day")
    analyzer = SentimentAnalyzer()
    results = analyzer.analyze_batch(req.texts)
    mood = analyzer.get_market_mood(req.texts)
    return {
        "individual": results,
        "market_mood": mood,
    }

# Quantum Portfolio Optimization Endpoints
@app.post("/api/v1/optimize")
async def optimize(req: OptimizeRequest, user: AuthenticatedUser = Depends(get_current_or_guest_user)):
    """
    Portfolio optimization (classical Markowitz or Quantum QAOA).
    """
    if req.method == "quantum":
        enforce_feature(user, FeatureKey.QUANTUM_OPTIMIZATION)
        result = quantum_optimize_portfolio(
            req.tickers,
            risk_penalty=1.0 - req.risk_tolerance,
            target_assets=req.target_assets,
        )
    else:
        enforce_feature(user, FeatureKey.CLASSICAL_OPTIMIZATION)
        result = optimize_portfolio(req.tickers, risk_tolerance=req.risk_tolerance)
    return result


# Agent Endpoint
@app.post("/api/v1/agent/chat")
async def agent_chat(req: AgentChatRequest, user: AuthenticatedUser = Depends(get_current_or_guest_user)):
    """
    Chat with the Financial Advisor AI Agent.

    Supports four user-facing modes plus the legacy auto mode:
    - "sabi": Select an existing capability from the request (default)
    - "single": Fast single-agent ReAct
    - "consensus": Quanfora 2.0 multi-agent consensus analysis
    - "research": Request the existing Equity Research Desk workflow
    - "auto": Auto-detect based on query complexity

    POST /api/v1/agent/chat
    {"message": "Should I invest in NVDA?", "mode": "consensus"}
    """
    from src.agent.history import load_history, append_message
    from src.agent.response_cache import cached_chat_response
    enforce_feature(user, FeatureKey.AI_RESEARCH)
    usage_tracker.increment(user, FeatureKey.AI_RESEARCH, "ai_messages_per_day")
    _ensure_chat_session_available(req.session_id, user)
    try:
        agent = get_agent(user=user, task_type="chat", preferred_mode=req.preferred_mode)

        # Guests can chat, but their conversation state must stay client-local.
        history = [] if user.is_guest else load_history(req.session_id, str(user.id))
        agent._history = [{"role": item["role"], "content": item["content"]} for item in history]

        def compute_result() -> dict:
            response = agent.chat(req.message, remember=False, mode=req.mode)
            metadata = getattr(agent, "last_response_metadata", None)
            result = {"response": response, "session_id": req.session_id, "mode": req.mode}
            if metadata:
                result.update(metadata)
            return result

        result = cached_chat_response(
            user_id=str(user.id),
            plan=user.plan,
            mode=req.mode,
            preferred_mode=req.preferred_mode,
            message=req.message,
            history=history,
            is_guest=user.is_guest,
            compute=compute_result,
        )

        # Persist both turns
        metadata = {
            key: value
            for key, value in result.items()
            if key not in {"response", "session_id", "mode"}
        } or None
        if req.remember and not user.is_guest:
            append_message(req.session_id, "user", req.message, str(user.id))
            append_message(
                req.session_id,
                "assistant",
                str(result.get("response", "")),
                str(user.id),
                metadata=metadata,
            )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _public_agent_job(record: dict, queue_position: int | None = None) -> dict:
    return {
        "job_id": record["job_id"],
        "status": record["status"],
        "queue_position": queue_position,
        "progress": record.get("progress"),
        "progress_events": record.get("progress_events") or [],
        "result": record.get("result"),
        "error": record.get("error"),
        "created_at": record.get("created_at"),
        "started_at": record.get("started_at"),
        "finished_at": record.get("finished_at"),
    }


@app.post("/api/v1/agent/chat/jobs", response_model=AgentJobCreateResponse)
async def create_agent_chat_job(req: AgentChatRequest, user: AuthenticatedUser = Depends(get_current_or_guest_user)):
    """
    Enqueue an AI chat job and return immediately with a job id.
    Use GET /api/v1/agent/chat/jobs/{job_id} to poll status/result.
    """
    from src.agent.agent import _is_consensus_query
    from src.agent.sabi import build_sabi_plan
    from src.agent.llm_queue import get_llm_job_queue

    enforce_feature(user, FeatureKey.AI_RESEARCH)
    usage_tracker.increment(user, FeatureKey.AI_RESEARCH, "ai_messages_per_day")
    _ensure_chat_session_available(req.session_id, user)

    sabi_plan = build_sabi_plan(req.message) if req.mode == "sabi" else None
    kind = (
        "consensus"
        if req.mode == "consensus"
        or (req.mode == "auto" and _is_consensus_query(req.message))
        or (sabi_plan is not None and sabi_plan.queue_kind == "consensus")
        else "single"
    )
    payload = {
        "user_id": str(user.id),
        "plan": user.plan.value if hasattr(user.plan, "value") else str(user.plan),
        "session_id": req.session_id,
        "message": req.message,
        "remember": req.remember and not user.is_guest,
        "is_guest": user.is_guest,
        "mode": req.mode,
        "preferred_mode": req.preferred_mode,
    }

    try:
        queue = get_llm_job_queue()
        record = queue.enqueue(payload, kind)
        position = queue.queue_position(record["job_id"], kind)
        return {"job_id": record["job_id"], "status": record["status"], "queue_position": position}
    except RedisUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.get("/api/v1/agent/chat/jobs/{job_id}", response_model=AgentJobStatusResponse)
async def get_agent_chat_job(job_id: str, user: AuthenticatedUser = Depends(get_current_or_guest_user)):
    """Return queued AI chat job status and result when complete."""
    from src.agent.llm_queue import get_llm_job_queue

    try:
        queue = get_llm_job_queue()
        record = queue.get(job_id)
        if record is None:
            raise HTTPException(status_code=404, detail="Chat job not found")
        payload = record.get("payload", {})
        if str(payload.get("user_id")) != str(user.id):
            raise HTTPException(status_code=404, detail="Chat job not found")
        position = queue.queue_position(job_id, record["kind"]) if record.get("status") == "queued" else None
        return _public_agent_job(record, position)
    except RedisUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.post("/api/v1/agent/consensus")
async def agent_consensus(req: AgentChatRequest, user: AuthenticatedUser = Depends(get_current_or_guest_user)):
    """
    Quanfora 2.0 — Multi-agent consensus analysis.

    Dispatches the query to 5 specialist agents (Quant Researcher, Quant Analyst,
    Financial Data Scientist, Risk Analyst, Portfolio Analytics), collects their
    structured opinions, and returns the consensus result with full metadata.

    POST /api/v1/agent/consensus
    {"message": "Should I invest in NVDA right now?"}
    """
    from src.agent.orchestrator import QuanforaOrchestrator
    from src.agent.history import append_message

    enforce_feature(user, FeatureKey.AI_RESEARCH)
    usage_tracker.increment(user, FeatureKey.AI_RESEARCH, "ai_messages_per_day")
    _ensure_chat_session_available(req.session_id, user)
    try:
        orchestrator = QuanforaOrchestrator(
            user_id=str(user.id),
            plan=user.plan,
            preferred_mode=req.preferred_mode,
            gateway=get_agent(user=user).gateway,
        )
        result = orchestrator.analyze(req.message)
        synthesis = orchestrator._synthesize_response(req.message, result)

        # Persist
        if req.remember and not user.is_guest:
            append_message(req.session_id, "user", req.message, str(user.id))
            append_message(req.session_id, "assistant", synthesis, str(user.id))

        return {
            "response": synthesis,
            "session_id": req.session_id,
            "mode": "consensus",
            "consensus": {
                "verdict": result.verdict.value,
                "confidence": result.confidence,
                "consensus_score": result.consensus_score,
                "agreement_ratio": result.agreement_ratio,
                "risk_vetoed": result.risk_vetoed,
                "risk_flags": result.risk_flags,
                "dissenting_agents": result.dissenting_agents,
                "opinions": [
                    {
                        "agent": o.agent_name,
                        "verdict": o.verdict.value,
                        "confidence": o.confidence,
                        "reasoning": o.reasoning,
                        "data_points": o.data_points,
                        "risk_flags": o.risk_flags,
                    }
                    for o in result.opinions
                ],
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@app.post("/api/v1/agent/reset")
async def agent_reset(
    session_id: str = "default",
    user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Clear the agent's conversation history to start a fresh session.
    """
    from src.agent.history import clear_history

    if not clear_history(session_id, str(user.id)):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_chat_session_conflict_message())
    get_agent().reset_history()

    return {"status": "ok", "session_id": session_id}

@app.get("/api/v1/agent/sessions")
async def list_agent_sessions(user: AuthenticatedUser = Depends(get_current_user)):
    """List all conversation sessions."""
    from src.agent.history import list_sessions

    return list_sessions(str(user.id))


@app.post("/api/v1/agent/sessions")
async def create_agent_session(
    req: AgentSessionCreateRequest,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Create an empty saved conversation session for the current user."""
    from src.agent.history import create_session

    _ensure_chat_session_available(req.session_id, user)
    return create_session(req.session_id, str(user.id), req.title)


@app.get("/api/v1/agent/sessions/{session_id}/messages")
async def get_agent_session_messages(
    session_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Load all messages for a conversation session."""
    from src.agent.history import load_history

    _ensure_chat_session_available(session_id, user)
    return {"session_id": session_id, "messages": load_history(session_id, str(user.id))}


@app.post("/api/v1/agent/sessions/{session_id}/messages")
async def append_agent_session_message(
    session_id: str,
    req: AgentSessionMessageAppendRequest,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Append a generated message to a saved conversation session owned by the current user."""
    from src.agent.history import append_message

    _ensure_chat_session_available(session_id, user)
    append_message(session_id, req.role, req.content, str(user.id), metadata=req.metadata)
    return {"status": "ok", "session_id": session_id}


@app.patch("/api/v1/agent/sessions/{session_id}")
async def rename_agent_session(
    session_id: str,
    req: AgentSessionRenameRequest,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Rename a conversation session."""
    from src.agent.history import rename_session

    _ensure_chat_session_owned(session_id, user)
    try:
        return rename_session(session_id, req.title, str(user.id))
    except KeyError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_chat_session_conflict_message()) from exc


@app.delete("/api/v1/agent/sessions/{session_id}")
async def delete_agent_session(
    session_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Delete a conversation session."""
    from src.agent.history import clear_history

    if not clear_history(session_id, str(user.id)):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_chat_session_conflict_message())
    return {"status": "ok", "session_id": session_id}


@app.websocket("/ws/agent/chat/{session_id}")
async def agent_ws(websocket: WebSocket, session_id: str, token: str | None = Query(default=None)):
    """
    WebSocket endpoint for streaming agent responses token by token.
    
    Client sends:  {"message": "Should I buy NVDA?", "remember": true}
    Server pushes: {"type": "token", "content": "Based on..."} (repeated)
                   {"type": "tool_start", "tool": "get_stock_info"}
                   {"type": "tool_end", "tool": "get_stock_info", "result": "..."}
                   {"type": "done"}
    """
    from src.auth.supabase import get_guest_user
    from src.agent.history import load_history, append_message, rename_session
    
    await websocket.accept()
    
    # Resolve user
    user = get_guest_user()
    if token:
        try:
            user = await get_current_or_guest_user(HTTPAuthorizationCredentials(scheme="Bearer", credentials=token))
        except Exception:
            pass
    _ensure_chat_session_available(session_id, user)
            
    try: 
        while True: 
            data = await websocket.receive_json()
            message = data.get("message", "")

            agent = get_agent(user=user)
            
            # Load DB history and prepare for LangGraph
            db_history = [] if user.is_guest else load_history(session_id, str(user.id))
            is_new_session = len(db_history) == 0
            
            # Format history for LangChain
            messages = [{"role": m["role"], "content": m["content"]} for m in db_history]
            messages.append({"role": "user", "content": message})
            
            # Save user message
            if not user.is_guest:
                append_message(session_id, "user", message, str(user.id))

            assistant_full_content = ""

            # Stream events from LangGraph
            async for event in agent._agent.astream_events(
                {"messages": messages}, version="v2"):
                    kind = event["event"]

                    # LLM token streaming
                    if kind == "on_chat_model_stream": 
                        chunk = event["data"]["chunk"]

                        if chunk.content:
                            if isinstance(chunk.content, str):
                                assistant_full_content += chunk.content
                                await websocket.send_json({
                                    "type": "token",
                                    "content": chunk.content,
                                })
                            elif isinstance(chunk.content, list):
                                for block in chunk.content:
                                    if isinstance(block, dict) and block.get("type") == "text":
                                        assistant_full_content += block.get("text", "")
                                        await websocket.send_json({
                                            "type": "token",
                                            "content": block.get("text", ""),
                                        })
                                    elif isinstance(block, str):
                                        assistant_full_content += block
                                        await websocket.send_json({
                                            "type": "token",
                                            "content": block,
                                        })

                    # Tool call started
                    elif kind == "on_tool_start":
                        await websocket.send_json({
                            "type": "tool_start",
                            "tool": event["name"],
                            "input": str(event["data"].get("input", "")),
                        })
                    
                    # Tool call finished
                    elif kind == "on_tool_end":
                        await websocket.send_json({
                            "type": "tool_end",
                            "tool": event["name"],
                            "result": str(event["data"].get("output", "")),
                        })

            # Save the final assistant response to DB
            if not user.is_guest:
                append_message(session_id, "assistant", assistant_full_content, str(user.id))

            # Generate smart AI title if it's the very first message
            if is_new_session and not user.is_guest:
                try:
                    title_prompt = (
                        "Summarize the following user prompt in 3 to 5 words for a chat session title. "
                        "Do not include quotes, periods, or punctuation. Make it concise and descriptive.\n\n"
                        f"User Prompt: {message}"
                    )
                    ai_response = agent._llm.invoke(title_prompt)
                    new_title = str(ai_response.content).strip(' ".\'')
                    if len(new_title) > 0 and len(new_title) < 60:
                        rename_session(session_id, new_title, str(user.id))
                except Exception as e:
                    print(f"Failed to generate title: {e}")

            # Signal end of stream
            await websocket.send_json({"type": "done"})

    except WebSocketDisconnect:
        pass
    except Exception as e:
        await websocket.send_json({"type": "error", "message": str(e)})
