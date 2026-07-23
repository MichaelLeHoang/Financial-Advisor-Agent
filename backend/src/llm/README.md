# LLM Module

## Purpose
Provides provider-agnostic model selection, fallback routing, and usage tracking.

## Responsibilities
- Register model capabilities and plan eligibility.
- Map task types to fast, balanced, deep-research, or export modes.
- Route memory extraction and conversation summarization to fast models so maintenance stays inexpensive and off the response path.
- Instantiate provider chat models through adapters.
- Fall back across providers and record estimated usage.

## Key Files
- `gateway.py`: routing execution and fallback.
- `model_registry.py`: model metadata and plan access.
- `routing_policy.py`: task-to-mode decisions.
- `usage_tracker.py`: usage accounting.
- `providers/`: provider adapters.

## Boundaries
Agent modules request models through the gateway and must not instantiate provider SDK clients directly.

## Testing
Mock providers and cover plan downgrades, provider failure, fallback order, selected modes, and usage recording.

## Latest Change
- Added fast-mode routing defaults for background memory extraction and rolling conversation summaries.
