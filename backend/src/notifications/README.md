# Notifications Module

## Purpose
Manages alert channels, encrypted destinations, alert evaluation, news-digest preferences, and delivery records.

## Responsibilities
- Encrypt channel destinations and configuration.
- Evaluate active price alerts against market data using each alert's bounded repeat interval.
- Deduplicate triggers and record alert events.
- Expose user-scoped alert and notification-channel routes.
- Update and delete owner-scoped alerts.
- Schedule local-time news digests, render deterministic AI fallbacks, and deliver email through Resend.

## Key Files
- `crypto.py`: encryption helpers.
- `evaluator.py`: alert condition evaluation.
- `routes.py`: alert, channel, event, and evaluation APIs.
- `digest.py`: digest scheduling, watchlist-news selection, summary fallback, email rendering, and Resend adapter.

## Boundaries
User, plan, and persistence behavior reuse `saas/`. Scheduled execution delegates from `jobs/`. News normalization remains in `services/`.

## Testing
Mock market prices, persistence, news, AI inference, and email delivery. Cover ownership, local-time scheduling, empty watchlists, summary fallbacks, idempotency, and channel masking.

## Latest Change
- Added owner-scoped alert mutation and opt-in daily news digests with local scheduling, watchlist personalization, general-market fallback, and retry-safe email delivery.
