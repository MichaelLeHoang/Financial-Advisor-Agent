# Agent Module

## Purpose
Implements the Quanfora conversational advisor, Sabi capability routing, deterministic market grounding, tool execution, queued jobs, conversation history, and Quanfora 2.0 consensus orchestration.

## Responsibilities
- Route Sabi, Quick, Consensus, and Equity Research requests through existing capabilities.
- Ground market-status and quote questions through market search and quote data.
- Run specialist consensus and synthesize responses.
- Derive structured Overview metadata and reader-facing answer sections for stock, sector, market, and consensus answers while preserving detailed quote/news/model evidence.
- Resolve ticker-only follow-up language such as "the stock" or "buy more" from recent chat context before consensus analysis.
- Reuse cached first-turn chat responses when repeated requests do not depend on conversation history.
- Persist signed-in conversation history, including structured response metadata, and execute queued LLM jobs.
- Truncate a selected conversation turn and all later messages so edited prompts and retries regenerate against matching persisted context.

## Key Files
- `agent.py`: primary chat router and ReAct agent.
- `sabi.py`: deterministic Sabi intent planning and existing-capability selection.
- `tools.py`: financial tools exposed to agents.
- `market_grounding.py`: intent detection, entity resolution, quote formatting, and freshness metadata.
- `overview.py`: structured Overview builders for single-agent, market-grounded, consensus, and equity-research answers.
- `response_cache.py`: cache-key normalization and cacheability policy for stateless chat responses.
- `orchestrator.py` / `consensus.py`: Quanfora 2.0 specialist aggregation.
- `llm_queue.py` / `llm_worker.py`: asynchronous job lifecycle and queued response metadata.

## Boundaries
Reuse `data.market_data_service`, `llm.gateway`, `risk`, `quant`, and `saas` rather than duplicating provider or entitlement logic. Shared response shapes belong in `models/`.

## Testing
Cover routing, grounding, overview metadata, response structure, follow-up context, response caching, consensus, queue state, history ownership, and tool failure behavior with mocked providers.

## Latest Change
- Added owned conversation-history truncation for in-place prompt editing and response regeneration.
