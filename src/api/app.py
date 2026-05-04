from fastapi import Depends, FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import inngest.fast_api

from src.jobs.inngest_client import inngest_client
from src.jobs.functions import (
    scheduled_new_ingestion,   
    on_demand_news_ingestion,
)
from src.rag.pipeline import ask as rag_ask
from src.services.ingestion import ingest_news

from src.ml.preprocessing import prepare_training_data
from src.ml.models import RandomForestPredictor, LSTMPredictor, evaluate_model
from src.ml.sentiment import SentimentAnalyzer

from src.quantum.portfolio import optimize_portfolio, quantum_optimize_portfolio
from src.agent.agent import FinancialAdvisorAgent
from src.config import settings
from src.data.vector_db import get_qdrant_client
from src.auth.supabase import get_current_or_guest_user
from src.saas.entitlements import FeatureKey, enforce_feature
from src.saas.models import AuthenticatedUser
from src.saas.routes import router as saas_router
from src.saas.usage import usage_tracker
from src.billing.routes import router as billing_router

from pydantic import BaseModel
import yfinance as yf

app = FastAPI(
    title=settings.app_name,
    description="AI-powered financial advisor with RAG, ML prediction, and Quantum optimization",
    version=settings.app_version,
)

# CORS — allow the Next.js frontend to call the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(saas_router)
app.include_router(billing_router)

# Register Inngest with FastAPI
inngest.fast_api.serve(
    app,
    inngest_client,
    [scheduled_new_ingestion, on_demand_news_ingestion],
)

# Lazy singleton: agent is expensive to initialize (downloads models)
_agent: FinancialAdvisorAgent | None = None

def get_agent() -> FinancialAdvisorAgent:
    global _agent
    if _agent is None:
        _agent = FinancialAdvisorAgent()
    return _agent

# Request/Response Models
class PredictRequest(BaseModel):
    ticker: str = "AAPL"
    model_type: str = "random_forest"  # "random_forest" or "lstm"
    sequence_length: int = 5

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

class MarketQuotePoint(BaseModel):
    label: str
    price: float
    volume: int

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
    }
    degraded = any(service["status"] == "error" for service in services.values())

    return {
        "status": "degraded" if degraded else "ok",
        "environment": settings.app_env,
        "version": settings.app_version,
        "services": services,
    }

@app.get("/api/v1/market/quote/{ticker}", response_model=MarketQuoteResponse)
async def market_quote(ticker: str, period: str = "1mo", interval: str = "1d"):
    """
    Fetch current quote and recent chart data for a market symbol.
    """
    normalized = ticker.strip().upper()
    if not normalized:
        raise HTTPException(status_code=400, detail="Ticker is required")

    try:
        stock = yf.Ticker(normalized)
        info = stock.info or {}
        history = stock.history(period=period, interval=interval, auto_adjust=True)
        if history.empty:
            raise HTTPException(status_code=404, detail=f"No market data found for {normalized}")

        closes = history["Close"].dropna()
        if closes.empty:
            raise HTTPException(status_code=404, detail=f"No price data found for {normalized}")

        latest_price = float(info.get("regularMarketPrice") or closes.iloc[-1])
        previous_close = float(info.get("regularMarketPreviousClose") or (closes.iloc[-2] if len(closes) > 1 else closes.iloc[0]))
        change = ((latest_price - previous_close) / previous_close * 100) if previous_close else 0.0
        volume_series = history["Volume"] if "Volume" in history else None

        points = [
            MarketQuotePoint(
                label=index.strftime("%b %d") if hasattr(index, "strftime") else str(index),
                price=round(float(row["Close"]), 2),
                volume=int(row.get("Volume", 0) or 0),
            )
            for index, row in history.tail(90).iterrows()
            if row.get("Close") is not None
        ]

        return MarketQuoteResponse(
            ticker=normalized,
            name=info.get("longName") or info.get("shortName") or normalized,
            exchange=info.get("exchange") or info.get("fullExchangeName"),
            sector=info.get("sector") or info.get("quoteType"),
            price=round(latest_price, 2),
            change=round(change, 2),
            currency=info.get("currency"),
            open_price=_round_optional(info.get("regularMarketOpen") or (float(history["Open"].dropna().iloc[-1]) if "Open" in history and not history["Open"].dropna().empty else None)),
            day_high=_round_optional(info.get("dayHigh") or (float(history["High"].dropna().iloc[-1]) if "High" in history and not history["High"].dropna().empty else None)),
            day_low=_round_optional(info.get("dayLow") or (float(history["Low"].dropna().iloc[-1]) if "Low" in history and not history["Low"].dropna().empty else None)),
            market_cap=info.get("marketCap"),
            volume=int(info.get("regularMarketVolume") or (volume_series.iloc[-1] if volume_series is not None and not volume_series.empty else 0) or 0),
            pe_ratio=_round_optional(info.get("trailingPE") or info.get("forwardPE")),
            fifty_two_week_high=_round_optional(info.get("fiftyTwoWeekHigh")),
            fifty_two_week_low=_round_optional(info.get("fiftyTwoWeekLow")),
            dividend_yield=_round_optional(info.get("dividendYield")),
            dividend_rate=_round_optional(info.get("dividendRate")),
            quarterly_dividend_amount=_round_optional((info.get("dividendRate") / 4) if info.get("dividendRate") else None),
            history=points,
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Unable to fetch market data for {normalized}: {exc}")

def _round_optional(value: float | int | None, digits: int = 4) -> float | None:
    if value is None:
        return None
    return round(float(value), digits)

# Rag Endpoints

@app.post("/api/v1/query")
async def query(question: str, ticker: str | None = None):
    """
    Ask the financial advisor a question. 

    Example: POST /api/v1/query?question=How is Apple doing?&ticker=AAPL
    """
    response = rag_ask(question, ticker_filter=ticker)
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
async def trigger_ingestion(tickers: list[str] = ["AAPL", "NVDA"]):
    """
    Manually trigger news ingestion for specific tickers. 
    """

    stats = ingest_news(tickers)
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
    """
    enforce_feature(user, FeatureKey.ML_PREDICTION)
    try: 
        data = prepare_training_data(
            req.ticker, 
            sequence_length=req.sequence_length,
            model_type=req.model_type,
        )
        if req.model_type == "random_forest":
            model = RandomForestPredictor(n_estimators=200)
        elif req.model_type == "lstm":
            model = LSTMPredictor(epochs=20)
        
        train_metrics = model.train(data["X_train"], data["y_train"])
        test_metrics = evaluate_model(model, data["X_test"], data["y_test"], data["scaler"])
        
        return {
            "ticker": req.ticker,
            "model_type": req.model_type,
            "train_metrics": train_metrics,
            "test_metrics": test_metrics,
        }
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
    Chat with the full Financial Advisor AI Agent.
    The agent has access to all tools: stock data, sentiment analysis,
    ML prediction, and portfolio optimization.

    POST /api/v1/agent/chat
    {"message": "Should I invest in NVDA?", "remember": true}
    """
    from src.agent.history import load_history, append_message
    enforce_feature(user, FeatureKey.AI_RESEARCH)
    usage_tracker.increment(user, FeatureKey.AI_RESEARCH, "ai_messages_per_day")
    try:
        agent = get_agent()

        # Load persistent history for this session
        history = load_history(req.session_id)
        agent._history = history
        response = agent.chat(req.message, remember=False)  # we handle persistence

        # Persist both turns
        if req.remember:
            append_message(req.session_id, "user", req.message)
            append_message(req.session_id, "assistant", response)
        return {"response": response, "session_id": req.session_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@app.post("/api/v1/agent/reset")
async def agent_reset(session_id: str = "default"):
    """
    Clear the agent's conversation history to start a fresh session.
    """
    from src.agent.history import clear_history

    clear_history(session_id)
    get_agent().reset_history()

    return {"status": "ok", "session_id": session_id}

@app.get("/api/v1/agent/sessions")
async def list_sessions():
    """List all conversation sessions."""
    from src.agent.history import list_sessions

    return list_sessions()


@app.websocket("/ws/agent/chat")
async def agent_ws(websocket: WebSocket):
    """
    WebSocket endpoint for streaming agent responses token by token.
    
    Client sends:  {"message": "Should I buy NVDA?", "remember": true}
    Server pushes: {"type": "token", "content": "Based on..."} (repeated)
                   {"type": "tool_start", "tool": "get_stock_info"}
                   {"type": "tool_end", "tool": "get_stock_info", "result": "..."}
                   {"type": "done"}
    """
    await websocket.accept()
    try: 
        while True: 
            data = await websocket.receive_json()
            message = data.get("message", "")
            remember = data.get("remember", True)

            agent = get_agent()
            messages = agent._history + [{"role": "user", "content": message}]

            # Stream events from LangGraph
            async for event in agent._agent.astream_events(
                {"messages": messages}, version="v2"):
                    kind = event["event"]

                    # LLM token streaming
                    if kind == "on_chat_model_stream": 
                        chunk = event["data"]["chunk"]

                        if chunk.content:
                            await websocket.send_json({
                                "type": "token",
                                "content": chunk.content,
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
                    
                    # Signal end of stream
                    await websocket.send_json({"type": "done"})

                    # Persist to history if requested
                    if remember:
                        # We'll capture the final response via a non-streaming call
                        # (history is already maintained inside the agent)
                        pass

    except WebSocketDisconnect:
        pass
    except Exception as e:
        await websocket.send_json({"type": "error", "message": str(e)})
