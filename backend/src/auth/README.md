# Authentication Module

## Purpose
Authenticates Supabase users and provides signed-in or guest user dependencies to FastAPI routes.

## Responsibilities
- Validate Supabase JWTs, including symmetric and JWKS-backed signatures.
- Resolve authenticated user identity and plan metadata.
- Provide required-user and optional guest-aware dependencies.

## Key Files
- `supabase.py`: token parsing, verification, user normalization, and FastAPI dependencies.

## Boundaries
Authentication establishes identity only. Feature access and plan limits belong in `saas/entitlements.py` and `saas/usage.py`.

## Testing
Cover valid and invalid signatures, JWKS behavior, missing tokens, guest fallback, and malformed claims with deterministic token fixtures.

## Latest Change
- Established the current Supabase authentication boundary during the backend package restructure.
