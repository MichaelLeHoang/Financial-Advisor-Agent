# Agent Module

## Purpose
Implements the QuanAd conversational advisor, deterministic market grounding, tool execution, queued jobs, conversation history, and QuanAd 2.0 consensus orchestration.

## Responsibilities
- Route simple, consensus, and equity-research requests.
- Ground market-status and quote questions through market search and quote data.
- Run specialist consensus and synthesize responses.
- Persist signed-in conversation history and execute queued LLM jobs.

## Key Files
- `agent.py`: primary chat router and ReAct agent.
- `tools.py`: financial tools exposed to agents.
- `market_grounding.py`: intent detection, entity resolution, quote formatting, and freshness metadata.
- `orchestrator.py` / `consensus.py`: QuanAd 2.0 specialist aggregation.
- `llm_queue.py` / `llm_worker.py`: asynchronous job lifecycle.

## Boundaries
Reuse `data.market_data_service`, `llm.gateway`, `risk`, `quant`, and `saas` rather than duplicating provider or entitlement logic. Shared response shapes belong in `models/`.

## Testing
Cover routing, grounding, consensus, queue state, history ownership, and tool failure behavior with mocked providers.

## Latest Change
- Expanded ensemble prediction tool output and regression coverage for available and unavailable valuation summaries, combined signals, and validation performance labels.
