from fastapi import FastAPI, HTTPException
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

from pydantic import BaseModel

app = FastAPI(
    title="Financial Advisor API",
    description="AI-powered financial advisor with RAG, ML prediction, and Quantum optimization",
    version="0.1.0",
)

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

# basic api endpoints 

@app.get("/health")

async def health_check():
    """Simple health check endpoint"""
    return {"status": "ok", "service": "Financial Advisor API"}

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
async def predict_stock(req: PredictRequest):
    """
    Train a model on historical data and predict direction.
    POST /api/v1/predict
    {"ticker": "AAPL", "model_type": "random_forest", "sequence_length": 5}
    """
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
async def analyze_sentiment(req: SentimentRequest):
    """
    Analyze sentiment of financial texts.
    POST /api/v1/sentiment
    {"texts": ["Apple beat earnings", "Tesla recalls vehicles"]}
    """
    analyzer = SentimentAnalyzer()
    results = analyzer.analyze_batch(req.texts)
    mood = analyzer.get_market_mood(req.texts)
    return {
        "individual": results,
        "market_mood": mood,
    }

# Quantum Portfolio Optimization Endpoints
@app.post("/api/v1/optimize")
async def optimize(req: OptimizeRequest):
    """
    Portfolio optimization (classical Markowitz or Quantum QAOA).
    """
    if req.method == "quantum":
        result = quantum_optimize_portfolio(
            req.tickers,
            risk_penalty=1.0 - req.risk_tolerance,
            target_assets=req.target_assets,
        )
    else:
        result = optimize_portfolio(req.tickers, risk_tolerance=req.risk_tolerance)
    return result


# Agent Endpoint
@app.post("/api/v1/agent/chat")
async def agent_chat(req: AgentChatRequest):
    """
    Chat with the full Financial Advisor AI Agent.
    The agent has access to all tools: stock data, sentiment analysis,
    ML prediction, and portfolio optimization.

    POST /api/v1/agent/chat
    {"message": "Should I invest in NVDA?", "remember": true}
    """
    try:
        response = get_agent().chat(req.message, remember=req.remember)
        return {"response": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/agent/reset")
async def agent_reset():
    """
    Clear the agent's conversation history to start a fresh session.
    """
    get_agent().reset_history()
    return {"status": "ok", "message": "Conversation history cleared"}
