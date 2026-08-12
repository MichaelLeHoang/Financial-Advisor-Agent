# Jobs Module

## Purpose
Hosts background-job entry points for ingestion, alert evaluation, personalized news digests, and queued LLM execution.

## Responsibilities
- Configure the Inngest client and scheduled functions.
- Trigger news ingestion and active-alert evaluation.
- Fan out due digest recipients and durably summarize and deliver one email per user and local date.
- Provide the executable entry point for the Redis-backed LLM worker.

## Key Files
- `inngest_client.py`: Inngest configuration.
- `functions.py`: scheduled and event-driven functions.
- `llm_worker.py`: command entry point delegating to `agent.llm_worker`.

## Boundaries
Jobs coordinate existing services; they should not duplicate ingestion, notification, or agent business logic.

## Testing
Unit-test function delegation and scheduling with mocked services. Use integration tests only when intentionally exercising Inngest, Redis, Resend, AI inference, or external news providers.

## Latest Change
- Added a 15-minute digest coordinator and concurrency-limited per-user worker using Inngest AI inference, retryable Resend delivery, and idempotent delivery claims.
