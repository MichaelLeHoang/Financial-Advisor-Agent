# Agent Module

## Purpose
Implements the Quanfora conversational advisor, deterministic market grounding, tool execution, queued jobs, conversation history, and Quanfora 2.0 consensus orchestration.

## Responsibilities
- Route simple, consensus, and equity-research requests.
- Ground market-status and quote questions through market search and quote data.
- Run specialist consensus and synthesize responses.
- Derive structured Overview metadata for reader-friendly stock and consensus answers.
- Persist signed-in conversation history, including structured response metadata, and execute queued LLM jobs.

## Key Files
- `agent.py`: primary chat router and ReAct agent.
- `tools.py`: financial tools exposed to agents.
- `market_grounding.py`: intent detection, entity resolution, quote formatting, and freshness metadata.
- `overview.py`: structured Overview builders for single-agent, market-grounded, consensus, and equity-research answers.
- `orchestrator.py` / `consensus.py`: Quanfora 2.0 specialist aggregation.
- `llm_queue.py` / `llm_worker.py`: asynchronous job lifecycle and queued response metadata.

## Boundaries
Reuse `data.market_data_service`, `llm.gateway`, `risk`, `quant`, and `saas` rather than duplicating provider or entitlement logic. Shared response shapes belong in `models/`.

## Testing
Cover routing, grounding, overview metadata, consensus, queue state, history ownership, and tool failure behavior with mocked providers.

## Latest Change
- Added structured Overview metadata for market-grounded, single-agent, consensus, and queued AI answers, with direct buy/sell/hold leads for decision prompts before the detailed markdown evidence.
