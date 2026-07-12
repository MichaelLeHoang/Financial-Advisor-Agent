# Jobs Module

## Purpose
Hosts background-job entry points for ingestion, alert evaluation, and queued LLM execution.

## Responsibilities
- Configure the Inngest client and scheduled functions.
- Trigger news ingestion and active-alert evaluation.
- Provide the executable entry point for the Redis-backed LLM worker.

## Key Files
- `inngest_client.py`: Inngest configuration.
- `functions.py`: scheduled and event-driven functions.
- `llm_worker.py`: command entry point delegating to `agent.llm_worker`.

## Boundaries
Jobs coordinate existing services; they should not duplicate ingestion, notification, or agent business logic.

## Testing
Unit-test function delegation with mocked services. Use integration tests only when intentionally exercising Inngest, Redis, or external providers.

## Latest Change
- Updated the queued LLM worker startup message to use Quanfora branding.
