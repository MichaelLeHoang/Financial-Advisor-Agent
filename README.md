# Financial Advisor Agent

An AI-powered financial advisor that combines **real-time market data**, **sentiment analysis**, **ML price prediction**, and **quantum-inspired portfolio optimization** — all orchestrated by a LangGraph ReAct agent powered by Gemini.

![Uploading FinancialAdvisorWebsite.png…]()


---

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│                    LangGraph ReAct Agent                   │
│                  (Gemini 2.0 Flash LLM)                    │
└───────────┬───────────┬───────────┬───────────┬────────────┘
            │           │           │           │
    ┌───────▼──┐ ┌──────▼──┐ ┌─────▼──┐ ┌──────▼───────────┐
    │  Stock   │ │Sentiment│ │  ML    │ │Portfolio Optimize│
    │   Info   │ │ FinBERT │ │Predict │ │Classical/Quantum │
    │(yfinance)│ │HuggingF │ │ RF/LSTM│ │ (Markowitz/QAOA) │
    └──────────┘ └─────────┘ └────────┘ └──────────────────┘
                      ▲
              ┌───────┴────────┐
              │  RAG Pipeline  │
              │  Qdrant + LLM  │
              └───────┬────────┘
                      │
            ┌─────────▼─────────┐
            │  News Ingestion   │
            │(yfinance + Inngest│
            │ scheduled jobs)   │
            └───────────────────┘
```

---

## Features

| Feature | Description |
|---------|-------------|
| **AI Agent** | LangGraph ReAct agent with tool-use; multi-turn conversation memory |
| **RAG Pipeline** | Index financial news → Qdrant → retrieve context → Gemini generates answer |
| **Sentiment Analysis** | FinBERT (ProsusAI) fine-tuned on financial text |
| **ML Prediction** | Random Forest + LSTM trained on 2 years of OHLCV + technical indicators |
| **Classical Optimization** | Markowitz Mean-Variance (scipy SLSQP) |
| **Quantum Optimization** | QAOA via PennyLane — selects optimal stock subset |
| **REST API** | FastAPI with interactive Swagger docs at `/docs` |
| **Scheduled Jobs** | Inngest cron job ingests news every hour |

---

## Quick Start

### 1. Prerequisites

- Python 3.13+
- [uv](https://docs.astral.sh/uv/) package manager
- Qdrant running locally (or cloud URL)
- Google Gemini API key

### 2. Set up environment

```bash
# Clone the repo
git clone <repo-url>
cd Financial-Advisor-Agent

# Install dependencies
uv sync

# Copy and edit environment variables
cp .env.example .env
```

### 3. Configure `.env`

```dotenv
GEMINI_API_KEY=your_key_here

# Optional: Qdrant (defaults to local)
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=

# Optional: embedding provider (local is free, gemini requires API)
EMBEDDING_PROVIDER=local
```

### 4. Start Qdrant (Docker)

```bash
docker run -p 6333:6333 qdrant/qdrant
```

### 5. Run the interactive CLI agent

```bash
uv run python main.py

# Or with a different LLM provider:
uv run python main.py --provider openai
```

### 6. Start the REST API

```bash
uv run uvicorn src.api.app:app --reload --port 8000
# → Swagger UI: http://localhost:8000/docs
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/api/v1/agent/chat` | Chat with the full AI agent |
| `POST` | `/api/v1/agent/reset` | Clear conversation history |
| `POST` | `/api/v1/query` | RAG-only Q&A |
| `POST` | `/api/v1/ingest` | Manually trigger news ingestion |
| `POST` | `/api/v1/predict` | ML price prediction (RF or LSTM) |
| `POST` | `/api/v1/sentiment` | FinBERT sentiment analysis |
| `POST` | `/api/v1/optimize` | Portfolio optimization (classical or quantum) |

### Example: Chat with the agent

```bash
curl -X POST http://localhost:8000/api/v1/agent/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Should I invest in NVDA right now?"}'
```

### Example: Portfolio optimization

```bash
curl -X POST http://localhost:8000/api/v1/optimize \
  -H "Content-Type: application/json" \
  -d '{"tickers": ["AAPL","NVDA","GOOGL","TSLA"], "method": "classical"}'
```

---

## Running Tests

```bash
# Unit tests (fast, no network, no GPU)
uv run pytest tests/unit/ -v

# Integration tests (requires embedding model download)
uv run pytest tests/integration/ -v

# All tests
uv run pytest -v
```

---

## Project Structure

```
src/
├── agent/          # LangGraph ReAct agent + tool definitions
├── api/            # FastAPI app with all endpoints
├── data/           # yfinance fetchers + Qdrant vector DB helpers
├── jobs/           # Inngest scheduled/event-driven jobs
├── ml/             # FinBERT sentiment, RF + LSTM predictors, preprocessing
├── models/         # Pydantic schemas (RAGResponse, ChunkMetadata, etc.)
├── quantum/        # QAOA circuit (PennyLane) + Markowitz optimizer
├── rag/            # Retriever → context_builder → generator pipeline
└── services/       # Chunker, embedding providers, news ingestion
tests/
├── unit/           # Fast mocked tests (no network)
└── integration/    # Real embedding model tests
```

---

## Agent Tools

The LangGraph agent has access to four tools:

1. **`get_stock_info`** — Current price, daily change, volume (yfinance)
2. **`analyze_sentiment`** — FinBERT sentiment for any list of headlines
3. **`predict_stock_price`** — Random Forest trained on 2y of data
4. **`optimize_portfolio_tool`** — Classical Markowitz or Quantum QAOA

---

## Disclaimer

This is an AI-powered tool for educational and research purposes only. **It is not professional financial advice.** Always consult a licensed financial advisor before making investment decisions.
