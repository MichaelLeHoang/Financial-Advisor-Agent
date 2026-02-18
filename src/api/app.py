from fastapi import FastAPI
import inngest.fast_api

from src.jobs.inngest_client import inngest_client
from src.jobs.functions import (
    scheduled_new_ingestion as scheduled_news_ingestion,
    on_demand_news_ingestion,
)
from src.rag.pipeline import ask as rag_ask
from src.services.ingestion import ingest_news

app = FastAPI(
    title = "Financial Advisor API",
    description = "AI-powered financial advisor with RAG",
    version = "0.1.0",
)

# Resgister Inngest with FastAPI
inngest.fast_api.serve(
    app, 
    inngest_client, 
    [scheduled_news_ingestion, on_demand_news_ingestion],
)

# basic api endpoints 

@app.get("/health")

async def health_check():
    """Simple health check endpoint"""
    return {"status": "ok", "service": "Financial Advisor API"}

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