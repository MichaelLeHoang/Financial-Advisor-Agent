# QuanAd — AI Financial Research Workspace

QuanAd is an end-to-end financial research platform that combines **live market data**, **AI advisor workflows**, **FinBERT sentiment**, **portfolio and risk analytics**, **backtesting**, **RAG over financial news**, **multi-agent consensus**, and **quantitative tooling** in a Next.js 16 workspace backed by FastAPI.

> **Disclaimer**: This project is for educational and demonstration purposes only. It is **not** real financial advice. Always consult a licensed financial advisor before making investment decisions.

---

## Current App Surface

The implemented frontend includes:

- **Dashboard** — account and workflow overview.
- **AI Advisor** — chat-based research with session history, single-agent mode, consensus mode, and queued Redis-backed jobs.
- **Market** — ticker search, quote cards, chart detail, and market data inspection.
- **Watchlist** — saved lists, market sections, earnings, comparison charts, and right-panel quote detail.
- **Portfolio** — holdings, base currency handling, converted values, P&L, weights, and optimization entry points.
- **Sentiment** — FinBERT-based headline analysis with batch input, upload workflow, source context, and result dashboards.
- **News** — authenticated market/news reading surface.
- **Risk** — portfolio risk snapshot, allocation, concentration, drawdown, and correlation views.
- **Backtest Lab** — strategy runs, saved runs, market-data candles, and replay sessions.
- **Journal** — trade thesis, review, and analytics.
- **Quant tools** — quantum optimization, strategy comparison, validation, signal ranking, and export center.
- **Research reports** — equity research runs, streaming events, analyst reports, and shareable public reports.
- **Billing and access** — Supabase auth, Stripe billing, and Free/Pro/Trader/Quant/Execution feature gates.

---

## Advisor Modes

| Mode | Architecture | Best For |
|---------|-------------|----------|
| **Single Agent** | LangGraph ReAct agent with market, sentiment, prediction, and optimization tools | Fast lookups, focused explanations, simple research questions |
| **Consensus** | 5 specialist agents → weighted consensus engine | Deeper investment reviews, risk-heavy questions, and disagreement detection |
| **QuanAd 2.1 Equity Research Desk** | Ticker-triggered research run → shared snapshot → analyst sequence → final PM verdict | Durable ticker reports, evidence trails, and shareable research output |
| **Queued Chat Jobs** | Redis queue + LLM worker | Long-running advisor work without blocking the UI |

Switch between modes using the **model selector** in the AI advisor page header.

---

## Architecture

### Single-Agent Path

```
┌────────────────────────────────────────────────────────────┐
│                    LangGraph ReAct Agent                   │
│               (configured LLM provider)                    │
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
            │(yfinance + jobs)  │
            └───────────────────┘
```

### Consensus Path

```
┌──────────────────────────────────────────────────────────────────┐
│                    Consensus Orchestrator                         │
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

### QuanAd 2.1 — Equity Research Desk

QuanAd 2.1 is a ticker-based research workflow rather than a normal chat reply. It can be started from the AI Advisor model selector, `/research`, or market surfaces that pass a ticker into the research desk.

```
┌─────────────────────────────────────────────────────────────────┐
│                    QuanAd 2.1 Research Request                  │
│      ticker + source surface + depth + selected analysts         │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │ Entitlement Shaping │
                    │ depth, analysts,    │
                    │ guest limitations   │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │ Shared Data Snapshot│
                    │ quote, fundamentals,│
                    │ technicals, news,   │
                    │ sentiment, risk     │
                    └──────────┬──────────┘
                               │
     ┌─────────────────────────▼─────────────────────────┐
     │ Ordered Research Desk Agents                       │
     │ Market → Social → News → Fundamentals → Bull/Bear  │
     │ → Evaluator → Trader → Risk views → Portfolio Mgr  │
     └─────────────────────────┬─────────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │ Reports + Events    │
                    │ markdown sections,  │
                    │ confidence, risks,  │
                    │ streaming timeline  │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │ Final Verdict       │
                    │ buy/hold/sell/      │
                    │ insufficient data   │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │ Shareable Report    │
                    │ /r/{shareSlug}      │
                    └─────────────────────┘
```

The current backend stores runs, snapshots, reports, events, and share slugs in the in-process `EquityResearchStore`. It is suitable for the current development workflow; production persistence should move this store to Supabase/Postgres before relying on reports across process restarts.

### Specialist Agents

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
| **AI Advisor** | LangGraph ReAct chat, consensus mode, session history, WebSocket streaming, and Redis-backed queued jobs |
| **Multi-Agent Consensus** | 5 specialist agents analyze independently → consensus engine aggregates |
| **Equity Research Reports** | Start research runs, stream progress events, persist analyst reports, and share public report links |
| **RAG Pipeline** | Index financial news → Qdrant → retrieve context → LLM generates answer |
| **Market and Watchlist** | Live quote lookup, symbol search, chart detail, comparison charts, market sections, and earnings context |
| **Portfolio Workspace** | Supabase-backed portfolios and holdings with base currency, converted values, P&L, weights, and optimization |
| **Sentiment Analysis** | FinBERT (ProsusAI) fine-tuned on financial text |
| **ML Prediction** | Random Forest + LSTM trained on 2 years of OHLCV + technical indicators |
| **Statistical Profiling** | Returns distribution, skewness, kurtosis, autocorrelation |
| **Risk Assessment** | VaR, CVaR, max drawdown, downside deviation, concentration analysis |
| **Classical Optimization** | Markowitz Mean-Variance (scipy SLSQP) |
| **Quantum Optimization** | QAOA via PennyLane — selects optimal stock subset |
| **Backtesting and Replay** | Strategy runs, saved results, candle data, replay sessions, walk-forward, Monte Carlo, and bootstrap validation |
| **Signal Ranking and Export** | Momentum/volatility scoring, strategy export, and quant validation workflows |
| **Alerts and Notifications** | Alert CRUD, notification channels, event history, and evaluation endpoints |
| **Next.js Workspace** | Full-featured dashboard with Supabase auth, plan gates, docs, pricing, billing, blog, and help pages |
| **REST API** | FastAPI with interactive Swagger docs at `/docs` |
| **SaaS Platform** | Supabase auth, Stripe billing, tiered plans (Free/Pro/Trader/Quant/Execution) |
| **Local Dev Orchestration** | `make dev` starts Redis, Qdrant, backend, LLM worker, frontend, and ngrok |

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
| **Queue / Cache** | Redis for queued LLM jobs and optional platform cache paths |
| **Embeddings** | sentence-transformers / Gemini embeddings |
| **Backend API** | FastAPI + Pydantic + Uvicorn |
| **Frontend** | Next.js 16 + React 19 + Tailwind CSS 4 + Base UI / shadcn-style components |
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
- Node.js 20+ recommended for Next.js 16
- Docker Desktop for local Redis and Qdrant
- Google Gemini API key, or another configured LLM provider
- Supabase project (for auth + data persistence)
- ngrok if you want `make dev` to expose the backend tunnel

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

# Optional: Redis queue/cache
REDIS_URL=redis://localhost:6379/0

# Market data providers
FINNHUB_API_KEY=
ALPHA_VANTAGE_API_KEY=
SEC_USER_AGENT=QuanAd research contact@example.com

# Optional: embedding provider (local is free, gemini requires API)
EMBEDDING_PROVIDER=local

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8000

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

### 4. Run the full local platform

```bash
make dev
```

`make dev` starts Docker-backed Redis and Qdrant, waits for both dependencies, then runs the FastAPI backend, Redis-backed LLM worker, Next.js frontend, and an ngrok tunnel for the backend.

### 5. Run services individually

```bash
# Dependencies only
make deps

# Backend only
make backend

# Worker only
make worker

# Frontend only
make frontend
```

### 6. Run the interactive CLI agent

```bash
cd backend
uv run python main.py

# Or with a different LLM provider:
uv run python main.py --provider openai
```

### 7. Check service readiness

```bash
curl http://localhost:8000/api/v1/status
```

The status endpoint reports core and optional service health. Backend reachability is separate from optional degradation: Qdrant and Redis can report degraded when unavailable, while core API health can still be reachable. Secret values are never returned.

### 8. SaaS implementation instructions

The SaaS implementation plan, sprint checklists, service setup notes, and security audit prompt live outside this project README in [`doc/README.md`](doc/README.md).

---

## API Endpoints

### Core

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/api/v1/status` | SaaS service readiness status |
| `GET` | `/api/v1/me` | Current user context |

### Agent

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/agent/chat` | Chat with `mode: "single"`, `"consensus"`, or `"auto"` |
| `POST` | `/api/v1/agent/chat/jobs` | Enqueue a Redis-backed chat job |
| `GET` | `/api/v1/agent/chat/jobs/{job_id}` | Poll queued chat job status/result |
| `POST` | `/api/v1/agent/consensus` | Full multi-agent consensus with metadata |
| `POST` | `/api/v1/agent/reset` | Clear conversation history |
| `GET` | `/api/v1/agent/sessions` | List all conversation sessions |
| `GET` | `/api/v1/agent/sessions/{id}/messages` | Load session messages |
| `PATCH` | `/api/v1/agent/sessions/{id}` | Rename session |
| `DELETE` | `/api/v1/agent/sessions/{id}` | Delete session |
| `WS` | `/ws/agent/chat/{session_id}` | WebSocket chat stream |

### Equity Research

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/equity-research/runs` | Start an equity research run |
| `GET` | `/api/v1/equity-research/runs/{run_id}` | Load run detail, snapshot, reports, and latest events |
| `GET` | `/api/v1/equity-research/runs/{run_id}/reports` | Load analyst reports |
| `GET` | `/api/v1/equity-research/runs/{run_id}/events/list` | Load event list with cursor support |
| `GET` | `/api/v1/equity-research/runs/{run_id}/events` | Stream research events |
| `PATCH` | `/api/v1/equity-research/runs/{run_id}/share` | Enable or update public sharing |
| `DELETE` | `/api/v1/equity-research/runs/{run_id}` | Delete a research run |
| `GET` | `/api/v1/equity-research/shared/{share_slug}` | Public shared report |

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
| `GET` | `/api/v1/news/categories` | News category metadata |
| `GET` | `/api/v1/news` | News feed with category/ticker filtering |

### Quant Toolkit

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/quant/strategy-compare` | Strategy comparison |
| `POST` | `/api/v1/quant/validation` | Advanced validation (walk-forward, Monte Carlo, bootstrap) |
| `POST` | `/api/v1/quant/signals/rank` | Signal ranking |
| `POST` | `/api/v1/quant/export` | Strategy export (JSON/Python/Pine) |

### Portfolio, Watchlist, Risk, and Journal

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/portfolios` | List portfolios |
| `POST` | `/api/v1/portfolios` | Create portfolio |
| `DELETE` | `/api/v1/portfolios/{portfolio_id}` | Delete portfolio |
| `GET` | `/api/v1/portfolios/{portfolio_id}/holdings` | List holdings |
| `POST` | `/api/v1/portfolios/{portfolio_id}/holdings` | Add holding |
| `PATCH` | `/api/v1/portfolios/{portfolio_id}/holdings/{holding_id}` | Update holding |
| `DELETE` | `/api/v1/portfolios/{portfolio_id}/holdings/{holding_id}` | Delete holding |
| `GET` | `/api/v1/watchlists` | List watchlists |
| `POST` | `/api/v1/watchlists` | Create watchlist |
| `DELETE` | `/api/v1/watchlists/{watchlist_id}` | Delete watchlist |
| `GET` | `/api/v1/watchlists/{watchlist_id}/assets` | List watchlist assets |
| `POST` | `/api/v1/watchlists/{watchlist_id}/assets` | Add watchlist asset |
| `DELETE` | `/api/v1/watchlists/{watchlist_id}/assets/{asset_id}` | Delete watchlist asset |
| `GET` | `/api/v1/risk/portfolios/{portfolio_id}` | Portfolio risk snapshot |
| `GET` | `/api/v1/risk/portfolios/{portfolio_id}/snapshots` | Saved risk snapshots |
| `GET` | `/api/v1/journal/entries` | List journal entries |
| `POST` | `/api/v1/journal/entries` | Create journal entry |
| `GET` | `/api/v1/journal/analytics` | Journal analytics |

### Backtesting

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/backtests/strategies/options` | Available strategy options |
| `GET` | `/api/v1/backtests/strategies` | Saved strategies |
| `POST` | `/api/v1/backtests/run` | Run a backtest |
| `GET` | `/api/v1/backtests/runs` | List saved runs |
| `GET` | `/api/v1/backtests/runs/{run_id}` | Load a saved run |
| `DELETE` | `/api/v1/backtests/runs/{run_id}` | Delete a run |
| `GET` | `/api/v1/backtests/market-data/candles` | Candle data for replay/charting |
| `POST` | `/api/v1/backtests/replay-sessions` | Create replay session |
| `GET` | `/api/v1/backtests/replay-sessions` | List replay sessions |
| `GET` | `/api/v1/backtests/replay-sessions/{session_id}` | Load replay session |
| `PATCH` | `/api/v1/backtests/replay-sessions/{session_id}` | Update replay session |
| `DELETE` | `/api/v1/backtests/replay-sessions/{session_id}` | Delete replay session |

### Platform

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/billing/subscription` | Current subscription |
| `POST` | `/api/v1/billing/create-checkout-session` | Stripe Checkout session |
| `POST` | `/api/v1/billing/create-customer-portal-session` | Stripe customer portal session |
| `POST` | `/api/v1/billing/webhook` | Stripe webhook receiver |
| `GET` | `/api/v1/notification-channels` | List notification channels |
| `POST` | `/api/v1/notification-channels` | Create notification channel |
| `GET` | `/api/v1/alerts` | List alerts |
| `POST` | `/api/v1/alerts` | Create alert |
| `GET` | `/api/v1/alerts/events` | List alert events |
| `POST` | `/api/v1/alerts/evaluate` | Evaluate alerts |

### Example: consensus analysis

```bash
curl -X POST http://localhost:8000/api/v1/agent/consensus \
  -H "Content-Type: application/json" \
  -d '{"message": "Should I invest in NVDA right now?"}'
```

### Example: single-agent chat

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
cd backend

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
Financial-Advisor-Agent/       ← project root
├── backend/                   ← all Python backend
│   ├── src/
│   │   ├── agent/
│   │   │   ├── agent.py            # Single-agent and consensus selector
│   │   │   ├── orchestrator.py     # Consensus orchestrator
│   │   │   ├── consensus.py        # Consensus engine
│   │   │   ├── specialists/        # 5 specialist agents
│   │   │   ├── tools.py
│   │   │   └── history.py
│   │   ├── api/                    # FastAPI endpoints
│   │   ├── auth/                   # Supabase JWT auth
│   │   ├── backtesting/
│   │   ├── billing/
│   │   ├── core/                   # App configuration
│   │   ├── data/                   # yfinance + Qdrant helpers
│   │   ├── jobs/                   # LLM worker and scheduled job integrations
│   │   ├── journal/
│   │   ├── llm/                    # Multi-provider LLM gateway
│   │   ├── ml/                     # FinBERT, RF, LSTM
│   │   ├── models/                 # Pydantic schemas
│   │   ├── notifications/
│   │   ├── quant/                  # Strategy toolkit
│   │   ├── quantum/                # QAOA + Markowitz
│   │   ├── rag/                    # RAG pipeline
│   │   ├── risk/
│   │   ├── saas/                   # Entitlements + usage
│   │   └── services/               # Embeddings + ingestion
│   ├── tests/
│   │   ├── unit/
│   │   └── integration/
│   ├── data/                       # conversations.db
│   ├── main.py                     # CLI entry point
│   ├── pyproject.toml
│   └── uv.lock
├── frontend/                  ← Next.js dashboard
│   ├── src/app/                    # App routes
│   ├── src/components/             # Auth, chat, market, research, backtest, and UI components
│   └── src/lib/                    # API client, Supabase client
├── quantum-finance-ai/        ← Vite prototype
├── supabase/
│   └── migrations/                 # Supabase schema and feature migrations
├── docker-compose.yml              # Backend, worker, Redis, and Qdrant services
├── Makefile                        # Local dev orchestration
├── .env                       ← shared secrets (gitignored)
├── .env.example
├── .gitignore
├── README.md
└── PRODUCT.md
```

---

## Single-Agent Tools

The LangGraph agent has access to four tools:

1. **`get_stock_info`** — Current price, daily change, volume (yfinance)
2. **`analyze_sentiment`** — FinBERT sentiment for any list of headlines
3. **`predict_stock_price`** — Random Forest trained on 2y of data
4. **`optimize_portfolio_tool`** — Classical Markowitz or Quantum QAOA

---

## Disclaimer

This is an AI-powered tool for educational and research purposes only. **It is not professional financial advice.** The multi-agent consensus system is designed for research exploration — historical analysis and model predictions do not guarantee future results. Always consult a licensed financial advisor before making investment decisions.
