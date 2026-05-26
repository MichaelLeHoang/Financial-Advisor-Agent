import base64
import hashlib
import hmac
import json
import time
from functools import lru_cache
from typing import Any
from urllib.request import urlopen
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import encode_dss_signature

from src.config import settings
from src.saas.models import AuthenticatedUser, Plan


bearer_scheme = HTTPBearer(auto_error=False)
GUEST_USER_ID = UUID("00000000-0000-0000-0000-000000000001")


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


@lru_cache(maxsize=4)
def _fetch_supabase_jwks(supabase_url: str) -> dict[str, Any]:
    jwks_url = f"{supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
    with urlopen(jwks_url, timeout=10) as response:
        return json.loads(response.read().decode("utf-8"))


def _verify_es256(token: str, supabase_url: str) -> dict[str, Any]:
    parts = token.split(".")
    if len(parts) != 3:
        raise ValueError("Invalid JWT format")

    header_b64, payload_b64, signature_b64 = parts
    header = json.loads(_b64url_decode(header_b64))
    if header.get("alg") != "ES256":
        raise ValueError("Only ES256 asymmetric Supabase JWTs are supported")

    kid = header.get("kid")
    if not kid:
        raise ValueError("JWT missing key id")

    jwks = _fetch_supabase_jwks(supabase_url)
    key = next(
        (
            item for item in jwks.get("keys", [])
            if item.get("kid") == kid and item.get("alg") == "ES256" and item.get("kty") == "EC"
        ),
        None,
    )
    if not key:
        raise ValueError("No matching Supabase JWKS key")

    if key.get("crv") != "P-256":
        raise ValueError("Unsupported ES256 curve")

    x = int.from_bytes(_b64url_decode(key["x"]), "big")
    y = int.from_bytes(_b64url_decode(key["y"]), "big")
    public_key = ec.EllipticCurvePublicNumbers(x, y, ec.SECP256R1()).public_key()

    raw_signature = _b64url_decode(signature_b64)
    if len(raw_signature) != 64:
        raise ValueError("Invalid ES256 signature length")

    r = int.from_bytes(raw_signature[:32], "big")
    s = int.from_bytes(raw_signature[32:], "big")
    der_signature = encode_dss_signature(r, s)
    signed = f"{header_b64}.{payload_b64}".encode("utf-8")

    try:
        public_key.verify(der_signature, signed, ec.ECDSA(hashes.SHA256()))
    except InvalidSignature as exc:
        raise ValueError("Invalid JWT signature") from exc

    payload = json.loads(_b64url_decode(payload_b64))
    expires_at = payload.get("exp")
    if expires_at is not None and int(expires_at) < int(time.time()):
        raise ValueError("JWT has expired")

    if not payload.get("sub"):
        raise ValueError("JWT missing subject")

    return payload


def _verify_supabase_token(token: str) -> dict[str, Any]:
    parts = token.split(".")
    if len(parts) != 3:
        raise ValueError("Invalid JWT format")

    header = json.loads(_b64url_decode(parts[0]))
    alg = header.get("alg")

    if alg == "HS256":
        jwt_secret = settings.secret_value("supabase_jwt_secret")
        if not jwt_secret:
            raise ValueError("SUPABASE_JWT_SECRET is not configured")
        return _verify_hs256(token, jwt_secret)

    if alg == "ES256":
        if not settings.supabase_url:
            raise ValueError("SUPABASE_URL is not configured")
        return _verify_es256(token, settings.supabase_url)

    raise ValueError(f"Unsupported JWT algorithm: {alg}")


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

    if not settings.supabase_url and not settings.secret_value("supabase_jwt_secret"):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase JWT verification is not configured",
        )

    try:
        claims = _verify_supabase_token(credentials.credentials)
        user_metadata = claims.get("user_metadata") or {}
        user = AuthenticatedUser(
            id=UUID(claims["sub"]),
            email=claims.get("email"),
            display_name=user_metadata.get("display_name") or user_metadata.get("full_name"),
            username=user_metadata.get("username"),
            avatar_url=user_metadata.get("avatar_url"),
            plan=_plan_from_claims(claims),
        )
        try:
            from src.saas.repository import get_store

            synced_plan = get_store(user).get_user_plan(user.id)
            if synced_plan:
                user.plan = synced_plan
        except Exception:
            pass
        return user
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid bearer token: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


def get_guest_user() -> AuthenticatedUser:
    return AuthenticatedUser(
        id=GUEST_USER_ID,
        email=None,
        display_name="Guest",
        plan=Plan.FREE,
        is_guest=True,
    )


async def get_current_or_guest_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> AuthenticatedUser:
    if credentials is None or credentials.scheme.lower() != "bearer":
        return get_guest_user()

    if not settings.supabase_url and not settings.secret_value("supabase_jwt_secret"):
        return get_guest_user()

    try:
        claims = _verify_supabase_token(credentials.credentials)
        user_metadata = claims.get("user_metadata") or {}
        user = AuthenticatedUser(
            id=UUID(claims["sub"]),
            email=claims.get("email"),
            display_name=user_metadata.get("display_name") or user_metadata.get("full_name"),
            username=user_metadata.get("username"),
            avatar_url=user_metadata.get("avatar_url"),
            plan=_plan_from_claims(claims),
            is_guest=False,
        )
        try:
            from src.saas.repository import get_store

            synced_plan = get_store(user).get_user_plan(user.id)
            if synced_plan:
                user.plan = synced_plan
        except Exception:
            pass
        return user
    except Exception:
        return get_guest_user()
