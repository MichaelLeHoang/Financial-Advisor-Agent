# Financial Advisor Agent SaaS Implementation Docs

This folder contains the SaaS implementation plan and sprint instructions. Keep these docs separate from the project README so the main README stays focused on running and understanding the app.

## Sprint Order

Current sprint: **4, LLM Gateway And Model Routing**.

| Sprint | Document | Purpose |
|---|---|---|
| Manual setup | [Manual service setup guide](manual-service-setup.md) | Step-by-step dashboard setup for Supabase, Stripe, LLM keys, Qdrant, notifications, and deployment. |
| Billing setup | [Stripe billing testing and production guide](stripe-billing-testing-and-production.md) | Detailed local sandbox, login, webhook, checkout, Customer Portal, and production cutover checklist. |
| 0 | [Service configuration and repo cleanup](sprint-00-service-configuration.md) | Prepare config, status checks, setup docs, and safe secret handling. |
| 1 | [Supabase SaaS foundation](sprint-01-supabase-foundation.md) | Add multi-user data foundation while keeping guest access on Free. |
| 2 | [Feature gates and usage limits](sprint-02-feature-gates.md) | Create plan entitlements, usage caps, and upgrade responses. |
| 3 | [Stripe billing](sprint-03-stripe-billing.md) | Connect subscriptions to Stripe and sync plans into the app. |
| 4 | [LLM Gateway](sprint-04-llm-gateway.md) | Make model routing provider-agnostic with modes and usage tracking. |
| 5 | [Backtesting MVP](sprint-05-backtesting-mvp.md) | Add first paid Trader workflow for saved strategies and backtests. |
| 6 | [Alerts and notifications](sprint-06-alerts-notifications.md) | Add paid strategy/risk alerts and notification channels. |
| 7 | [Portfolio risk and trade journal](sprint-07-risk-journal.md) | Add portfolio risk dashboard and trade journal workflows. |
| 8 | [Advanced Quant features](sprint-08-advanced-quant.md) | Add premium quant validation, exports, and premium routing. |
| Audit | [Security and compliance audit](security-compliance-audit.md) | Review secrets, auth, billing, RLS, prompts, and financial risk. |
| UX gate | [Workspace UX validation sign-off](workspace-ux-validation-signoff.md) | Record the approved prototype flows and deferred Stage B functionality. |

## Global Constraints

- Do not rebuild from scratch.
- Preserve existing AI, RAG, prediction, sentiment, optimization, and frontend capabilities.
- Do not implement live trading yet.
- Keep financial disclaimers on AI, strategy, backtest, signal, and risk workflows.
- Use research language. Do not promise returns or guaranteed profits.
- Build in small, testable pull requests.
- Before writing code for a sprint, list the exact files to modify.

## Current Repo Summary

- FastAPI backend.
- Next.js frontend under `frontend/`.
- LangGraph ReAct agent.
- Gemini default LLM routed through the provider-agnostic LLM gateway.
- Qdrant RAG.
- FinBERT sentiment.
- RF/LSTM prediction.
- Markowitz and QAOA optimization.
- Inngest scheduled jobs.

## Service Setup Notes

See [Manual service setup guide](manual-service-setup.md) for account creation, dashboard steps, API keys, project URLs, webhooks, and deployment environment variables.

Use that guide whenever a sprint needs work outside the repo. It separates manual dashboard work from code work so commits do not accidentally include secrets or one-off setup notes.
