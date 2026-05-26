# QuanAd — Quantum-Inspired Financial Advisor AI Agent

An intelligent, end-to-end AI-powered financial advisor that combines **Machine Learning**, **Quantum-inspired optimization**, **Retrieval-Augmented Generation (RAG)**, **multi-agent consensus architecture**, and modern software engineering practices — all wrapped in a trader-grade Next.js dashboard.

> **Disclaimer**: This project is for educational and demonstration purposes only. It is **not** real financial advice. Always consult a licensed financial advisor before making investment decisions.

---

## Two Modes — Toggle in the UI

| Version | Architecture | Best For |
|---------|-------------|----------|
| **QuanAd 1.0** | Single LangGraph ReAct agent with 4 tools | Fast lookups: price checks, quick sentiment, single predictions |
| **QuanAd 2.0** | 5 specialist agents → weighted consensus engine | Deep investment analysis: "Should I invest in NVDA?" |

Switch between versions using the **model selector** in the AI advisor page header.

---

## Architecture

### QuanAd 1.0 — Single Agent

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

### QuanAd 2.0 — Multi-Agent Consensus

```
┌──────────────────────────────────────────────────────────────────┐
│                    QuanAd 2.0 Orchestrator                       │
│             (Dispatches query → Collects opinions)               │
└──────┬──────────┬──────────┬──────────┬──────────┬───────────────┘
       │          │          │          │          │
 ┌─────▼───┐ ┌───▼─────┐ ┌─▼────────┐ ┌▼────────┐ ┌▼─────────────┐
 │  Quant  │ │  Quant  │ │Financial │ │  Risk   │ │  Portfolio   │
 │Researcher│ │ Analyst │ │Data Sci  │ │ Analyst │ │  Analytics   │
 │         │ │         │ │          │ │         │ │              │
 │yfinance │ │Signals  │ │RF / LSTM │ │VaR, CVaR│ │Markowitz     │
 │FinBERT  │ │Backtest │ │Stats     │ │Drawdown │ │Quantum QAOA  │
 │Sentiment│ │Momentum │ │Profiling │ │Concentr.│ │Sharpe Ratio  │
 └────┬────┘ └────┬────┘ └────┬─────┘ └────┬────┘ └──────┬───────┘
      │           │           │            │             │
      └───────────┴───────────┴────────────┴─────────────┘
                              │
                    ┌─────────▼──────────┐
                    │  Consensus Engine  │
                    │  Weighted Voting   │
                    │  Risk Veto Logic   │
                    │  Disagreement Det. │
                    └─────────┬──────────┘
                              │
                    ┌─────────▼──────────┐
                    │  LLM Synthesis     │
                    │  Final Response    │
                    └────────────────────┘
```

### QuanAd 2.0 Specialist Agents

| Agent | Domain | Tools | Output |
|-------|--------|-------|--------|
| **Quant Researcher** | Market data, fundamentals, sentiment | `get_stock_info`, `analyze_sentiment` | Market context report |
| **Quant Analyst** | Technical signals, strategy backtesting | `rank_signals`, `run_strategy_backtest` | Technical signals + confidence |
| **Financial Data Scientist** | ML predictions, statistical modeling | `predict_stock_price`, `compute_statistical_profile` | Predictive analysis + model metrics |
| **Risk Analyst** | VaR, drawdown, concentration risk | `assess_stock_risk`, `evaluate_portfolio_concentration` | Risk report + risk-veto power |
| **Portfolio Analytics** | Allocation, optimization | `optimize_portfolio_tool` (Classical + Quantum) | Optimal weights + Sharpe ratios |

### Consensus Mechanism

Each specialist returns a structured `AgentOpinion` with verdict, confidence, reasoning, data points, and risk flags. The **Consensus Engine** aggregates via:
- **Confidence-weighted voting** across all specialists
- **Disagreement detection** when agents split significantly
- **Risk veto** — Risk Analyst can override bullish consensus with ≥ 3 critical risk flags

---

## Features

| Feature | Description |
|---------|-------------|
| **AI Agent (v1.0)** | LangGraph ReAct agent with tool-use; multi-turn conversation memory |
| **Multi-Agent Consensus (v2.0)** | 5 specialist agents analyze independently → consensus engine aggregates |
| **RAG Pipeline** | Index financial news → Qdrant → retrieve context → Gemini generates answer |
| **Sentiment Analysis** | FinBERT (ProsusAI) fine-tuned on financial text |
| **ML Prediction** | Random Forest + LSTM trained on 2 years of OHLCV + technical indicators |
| **Statistical Profiling** | Returns distribution, skewness, kurtosis, autocorrelation |
| **Risk Assessment** | VaR, CVaR, max drawdown, downside deviation, concentration analysis |
| **Classical Optimization** | Markowitz Mean-Variance (scipy SLSQP) |
| **Quantum Optimization** | QAOA via PennyLane — selects optimal stock subset |
| **Strategy Backtesting** | Walk-forward, Monte Carlo, bootstrap confidence intervals |
| **Signal Ranking** | Momentum + volatility composite scoring across tickers |
| **Next.js Dashboard** | Full-featured trading workspace with Supabase auth |
| **REST API** | FastAPI with interactive Swagger docs at `/docs` |
| **SaaS Platform** | Supabase auth, Stripe billing, tiered plans (Free/Pro/Quant) |
| **Scheduled Jobs** | Inngest cron job for news ingestion and alert evaluation |

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| **Language** | Python 3.13+ |
| **Package Manager** | uv (Python) + npm (Node.js) |
| **LLM Orchestration** | LangGraph + LangChain |
| **LLM Providers** | Gemini 2.0, OpenAI, Anthropic, OpenRouter |
| **ML Models** | Random Forest, LSTM (PyTorch), FinBERT (HuggingFace) |
| **Quantum Computing** | PennyLane (QAOA for portfolio optimization) |
| **Vector Database** | Qdrant (news RAG pipeline) |
| **Embeddings** | sentence-transformers / Gemini embeddings |
| **Backend API** | FastAPI + Pydantic + Uvicorn |
| **Frontend** | Next.js 15 + Tailwind CSS + shadcn/ui |
| **Database** | Supabase (PostgreSQL + Auth + RLS) |
| **Billing** | Stripe (subscriptions + checkout) |
| **Data** | yfinance (market data), pandas, NumPy |
| **Job Scheduler** | Inngest |
| **Dev Tools** | Ruff, Black, pytest, Jupyter |

---

## Quick Start

### 1. Prerequisites

- Python 3.13+
- [uv](https://docs.astral.sh/uv/) package manager
- Node.js 18+ (for Next.js frontend)
- Qdrant running locally (or cloud URL)
- Google Gemini API key
- Supabase project (for auth + data persistence)

### 2. Set up environment

```bash
# Clone the repo
git clone <repo-url>
cd Financial-Advisor-Agent

# Install Python dependencies
uv sync

# Install frontend dependencies
cd frontend && npm install && cd ..

# Copy and edit environment variables
cp .env.example .env
```

### 3. Configure `.env`

```dotenv
# App
APP_ENV=development
FRONTEND_URL=http://localhost:3000
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

# LLM provider used by the current agent/RAG flow
GEMINI_API_KEY=your_key_here
DEFAULT_LLM_PROVIDER=google
DEFAULT_LLM_MODE=fast

# Optional: Qdrant (defaults to local)
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=
QDRANT_COLLECTION_NEWS=financial_news

# Optional: embedding provider (local is free, gemini requires API)
EMBEDDING_PROVIDER=local

# Supabase
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=
SUPABASE_ANON_KEY=
DATABASE_URL=

# Billing
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

The app loads configuration through `src/core/config.py`. `src/config.py` is kept as a compatibility import path for existing modules.

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

### 7. Start the frontend

```bash
cd frontend
npm run dev
# → http://localhost:3000
```

### 8. Check service readiness

```bash
curl http://localhost:8000/api/v1/status
```

The status endpoint reports whether database, Supabase, Qdrant, LLM provider keys, Inngest jobs, billing, and notification services are configured. It checks Qdrant reachability and never returns secret values.

### 9. SaaS implementation instructions

The SaaS implementation plan, sprint checklists, service setup notes, and security audit prompt live outside this project README in [`doc/README.md`](doc/README.md).

---

## API Endpoints

### Core

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/api/v1/status` | SaaS service readiness status |
| `GET` | `/api/v1/me` | Current user context |

### Agent (QuanAd 1.0 + 2.0)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/agent/chat` | Chat — `mode: "single"` (v1.0) or `"consensus"` (v2.0) |
| `POST` | `/api/v1/agent/consensus` | Full multi-agent consensus with metadata |
| `POST` | `/api/v1/agent/reset` | Clear conversation history |
| `GET` | `/api/v1/agent/sessions` | List all conversation sessions |
| `GET` | `/api/v1/agent/sessions/{id}/messages` | Load session messages |
| `PATCH` | `/api/v1/agent/sessions/{id}` | Rename session |
| `DELETE` | `/api/v1/agent/sessions/{id}` | Delete session |

### Analysis & ML

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/query` | RAG-only Q&A |
| `POST` | `/api/v1/predict` | ML price prediction (RF or LSTM) |
| `POST` | `/api/v1/sentiment` | FinBERT sentiment analysis |
| `POST` | `/api/v1/optimize` | Portfolio optimization (classical or quantum) |
| `POST` | `/api/v1/ingest` | Manually trigger news ingestion |

### Market Data

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/market/quote/{ticker}` | Real-time quote + chart data |
| `GET` | `/api/v1/market/search` | Symbol search |

### Quant Toolkit

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/quant/compare` | Strategy comparison |
| `POST` | `/api/v1/quant/validate` | Advanced validation (walk-forward, Monte Carlo, bootstrap) |
| `POST` | `/api/v1/quant/signals` | Signal ranking |
| `POST` | `/api/v1/quant/export` | Strategy export (JSON/Python/Pine) |

### Risk & Portfolio

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/portfolios` | List portfolios |
| `POST` | `/api/v1/portfolios` | Create portfolio |
| `GET` | `/api/v1/risk/{portfolio_id}` | Portfolio risk snapshot |
| `GET` | `/api/v1/watchlists` | List watchlists |
| `POST` | `/api/v1/watchlists` | Create watchlist |

### Platform

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/billing/subscription` | Current subscription |
| `POST` | `/api/v1/billing/create-checkout-session` | Stripe Checkout session |
| `POST` | `/api/v1/billing/webhook` | Stripe webhook receiver |

### Example: QuanAd 2.0 consensus analysis

```bash
curl -X POST http://localhost:8000/api/v1/agent/consensus \
  -H "Content-Type: application/json" \
  -d '{"message": "Should I invest in NVDA right now?"}'
```

### Example: QuanAd 1.0 single-agent chat

```bash
curl -X POST http://localhost:8000/api/v1/agent/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What is the current price of AAPL?", "mode": "single"}'
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

## 📁 Project Structure

```
src/
├── agent/
│   ├── agent.py            # Main agent — QuanAd 1.0 (single) + 2.0 (consensus) selector
│   ├── orchestrator.py     # QuanAd 2.0 orchestrator — dispatches to 5 specialists
│   ├── consensus.py        # Consensus engine — weighted voting + risk veto
│   ├── specialists/
│   │   ├── base.py              # BaseSpecialist abstract class
│   │   ├── quant_researcher.py  # Market data + sentiment
│   │   ├── quant_analyst.py     # Technical signals + backtesting
│   │   ├── data_scientist.py    # ML predictions + statistics
│   │   ├── risk_analyst.py      # VaR, drawdown, concentration
│   │   └── portfolio_analytics.py # Markowitz + QAOA optimization
│   ├── tools.py            # Tool definitions for LangGraph agents
│   └── history.py          # SQLite-backed conversation persistence
├── api/                    # FastAPI app with all endpoints
├── auth/                   # Supabase JWT authentication
├── backtesting/            # Strategy backtesting engine
├── billing/                # Stripe subscription management
├── core/                   # App configuration
├── data/                   # yfinance fetchers + Qdrant vector DB helpers
├── jobs/                   # Inngest scheduled/event-driven jobs
├── journal/                # Trade journal
├── llm/                    # Multi-provider LLM gateway (Google, OpenAI, Anthropic, OpenRouter)
├── ml/                     # FinBERT sentiment, RF + LSTM predictors
├── models/                 # Pydantic schemas
├── notifications/          # Alerts evaluation + delivery
├── quant/                  # Strategy comparison, validation, signal ranking, export
├── quantum/                # QAOA circuit (PennyLane) + Markowitz optimizer
├── rag/                    # Retriever → context_builder → generator pipeline
├── risk/                   # Portfolio risk calculations
├── saas/                   # Entitlements, plans, usage tracking
└── services/               # Chunker, embedding providers, news ingestion
frontend/                   # Next.js dashboard with Tailwind CSS + shadcn/ui
├── src/app/                # App routes (dashboard, market, portfolio, etc.)
├── src/components/         # UI components (Sidebar, Header, Chat, ModelSelector, etc.)
└── src/lib/                # API client, Supabase client
supabase/
└── migrations/             # 8 migration files (profiles, billing, backtesting, etc.)
tests/
├── unit/                   # Fast mocked tests (no network)
└── integration/            # Real embedding model tests
```

---

## Agent Tools (QuanAd 1.0)

The LangGraph agent has access to four tools:

1. **`get_stock_info`** — Current price, daily change, volume (yfinance)
2. **`analyze_sentiment`** — FinBERT sentiment for any list of headlines
3. **`predict_stock_price`** — Random Forest trained on 2y of data
4. **`optimize_portfolio_tool`** — Classical Markowitz or Quantum QAOA

---

## Disclaimer

This is an AI-powered tool for educational and research purposes only. **It is not professional financial advice.** The multi-agent consensus system is designed for research exploration — historical analysis and model predictions do not guarantee future results. Always consult a licensed financial advisor before making investment decisions.
