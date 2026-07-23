# Agent Module

## Purpose
Implements the Quanfora conversational advisor, Sabi capability routing, deterministic market grounding, tool execution, queued jobs, conversation history, and Quanfora 2.0 consensus orchestration.

## Responsibilities
- Route Sabi, Quick, Consensus, and Equity Research requests through existing capabilities.
- Require runtime market, news, and SEC evidence for time-sensitive market questions before LLM reasoning.
- Ground market-status and quote questions through market search and quote data.
- Run specialist consensus and synthesize responses.
- Derive structured Overview metadata and reader-facing answer sections for stock, sector, market, and consensus answers while preserving detailed quote/news/model evidence.
- Resolve ticker-only follow-up language such as "the stock" or "buy more" from recent chat context before consensus analysis.
- Reuse cached first-turn chat responses only when repeated requests do not depend on conversation history or current market evidence.
- Persist signed-in conversation history, including structured response metadata, and execute queued chat and low-priority memory jobs.
- Inject bounded recent turns, rolling conversation summaries, and explicitly confirmed user preferences into every supported AI mode.
- Truncate a selected conversation turn and all later messages so edited prompts and retries regenerate against matching persisted context.

## Key Files
- `agent.py`: primary chat router and ReAct agent.
- `sabi.py`: deterministic Sabi intent planning and existing-capability selection.
- `tools.py`: financial tools exposed to agents.
- `market_grounding.py`: intent detection, entity resolution, quote formatting, and freshness metadata.
- `current_market_context.py`: freshness policy, pre-reasoning evidence retrieval, fail-closed behavior, and source metadata.
- `overview.py`: structured Overview builders for single-agent, market-grounded, consensus, and equity-research answers.
- `response_cache.py`: cache-key normalization and cacheability policy for stateless chat responses.
- `orchestrator.py` / `consensus.py`: Quanfora 2.0 specialist aggregation.
- `llm_queue.py` / `llm_worker.py`: asynchronous job lifecycle and queued response metadata.
- `history.py`: owner-scoped SQLite conversation history shared with the memory store.

## Boundaries
Reuse `data.market_data_service`, `llm.gateway`, `risk`, `quant`, and `saas` rather than duplicating provider or entitlement logic. Shared response shapes belong in `models/`.

## Testing
Cover routing, grounding, overview metadata, response structure, bounded personal context, response caching, consensus, queue state, history ownership, background maintenance, and tool failure behavior with mocked providers.

## Latest Change
- Added user-controlled conversational memory across direct, queued, consensus, WebSocket, and equity-research paths, and now resolve ticker-relative follow-ups before Sabi planning and market grounding.
