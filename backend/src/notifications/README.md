# Notifications Module

## Purpose
Manages alert channels, encrypted destinations, alert evaluation, and event delivery records.

## Responsibilities
- Encrypt channel destinations and configuration.
- Evaluate active price alerts against market data.
- Deduplicate triggers and record alert events.
- Expose user-scoped alert and notification-channel routes.

## Key Files
- `crypto.py`: encryption helpers.
- `evaluator.py`: alert condition evaluation.
- `routes.py`: alert, channel, event, and evaluation APIs.

## Boundaries
User, plan, and persistence behavior reuse `saas/`. Scheduled execution delegates from `jobs/`.

## Testing
Mock market prices and persistence. Cover encryption, unauthorized users, plan restrictions, duplicate triggers, stale events, and channel masking.

## Latest Change
- Established encrypted notification channels and deterministic active-alert evaluation during the backend package restructure.
