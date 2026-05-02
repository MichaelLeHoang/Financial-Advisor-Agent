import base64
import hashlib
import hmac
import json
import time
from typing import Any
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from src.config import settings
from src.saas.models import AuthenticatedUser, Plan


bearer_scheme = HTTPBearer(auto_error=False)


def _b64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def _verify_hs256(token: str, secret: str) -> dict[str, Any]:
    parts = token.split(".")
    if len(parts) != 3:
        raise ValueError("Invalid JWT format")

    header_b64, payload_b64, signature_b64 = parts
    header = json.loads(_b64url_decode(header_b64))
    if header.get("alg") != "HS256":
        raise ValueError("Only HS256 Supabase JWTs are supported")

    signed = f"{header_b64}.{payload_b64}".encode("utf-8")
    expected = hmac.new(secret.encode("utf-8"), signed, hashlib.sha256).digest()
    provided = _b64url_decode(signature_b64)
    if not hmac.compare_digest(expected, provided):
        raise ValueError("Invalid JWT signature")

    payload = json.loads(_b64url_decode(payload_b64))
    expires_at = payload.get("exp")
    if expires_at is not None and int(expires_at) < int(time.time()):
        raise ValueError("JWT has expired")

    if not payload.get("sub"):
        raise ValueError("JWT missing subject")

    return payload


def _plan_from_claims(claims: dict[str, Any]) -> Plan:
    app_metadata = claims.get("app_metadata") or {}
    user_metadata = claims.get("user_metadata") or {}
    raw_plan = claims.get("plan") or app_metadata.get("plan") or user_metadata.get("plan") or Plan.FREE.value
    try:
        return Plan(raw_plan)
    except ValueError:
        return Plan.FREE


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> AuthenticatedUser:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    jwt_secret = settings.secret_value("supabase_jwt_secret")
    if not jwt_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="SUPABASE_JWT_SECRET is not configured",
        )

    try:
        claims = _verify_hs256(credentials.credentials, jwt_secret)
        user_metadata = claims.get("user_metadata") or {}
        return AuthenticatedUser(
            id=UUID(claims["sub"]),
            email=claims.get("email"),
            display_name=user_metadata.get("display_name") or user_metadata.get("full_name"),
            plan=_plan_from_claims(claims),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid bearer token: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
