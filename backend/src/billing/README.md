# Billing Module

## Purpose
Integrates Stripe checkout, customer portal, subscription status, and webhook processing.

## Responsibilities
- Create checkout and billing-portal sessions.
- Validate Stripe webhook signatures and process subscription events.
- Translate Stripe subscription state into Quanfora plan state.
- Keep secrets and provider requests behind the Stripe service boundary.

## Key Files
- `routes.py`: authenticated billing API and webhook endpoints.
- `stripe_service.py`: Stripe request signing, API calls, webhook verification, and subscription mapping.

## Boundaries
Plan definitions and feature access belong in `saas/`; authentication belongs in `auth/`. Do not call Stripe directly from unrelated routes.

## Testing
Mock Stripe HTTP calls and Supabase/repository updates. Cover bad signatures, duplicate events, missing price IDs, guests, and subscription fallback behavior.

## Latest Change
- Established the current billing package and Stripe service boundary during the backend package restructure.
