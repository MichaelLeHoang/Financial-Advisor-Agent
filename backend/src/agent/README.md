# Agent Module

## Purpose
Implements the Quanfora conversational advisor, deterministic market grounding, tool execution, queued jobs, conversation history, and Quanfora 2.0 consensus orchestration.

## Responsibilities
- Route simple, consensus, and equity-research requests.
- Ground market-status and quote questions through market search and quote data.
- Run specialist consensus and synthesize responses.
- Persist signed-in conversation history, including structured response metadata, and execute queued LLM jobs.

## Key Files
- `agent.py`: primary chat router and ReAct agent.
- `tools.py`: financial tools exposed to agents.
- `market_grounding.py`: intent detection, entity resolution, quote formatting, and freshness metadata.
- `orchestrator.py` / `consensus.py`: Quanfora 2.0 specialist aggregation.
- `llm_queue.py` / `llm_worker.py`: asynchronous job lifecycle and queued response metadata.

## Boundaries
Reuse `data.market_data_service`, `llm.gateway`, `risk`, `quant`, and `saas` rather than duplicating provider or entitlement logic. Shared response shapes belong in `models/`.

## Testing
Cover routing, grounding, consensus, queue state, history ownership, and tool failure behavior with mocked providers.

## Latest Change
- Added prediction ticker aliasing for SpaceX-style company names and clarified that prediction requests must resolve current public tickers before answering from model memory.
