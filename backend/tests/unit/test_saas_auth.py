import base64
import hashlib
import hmac
import json
import time
import asyncio
from uuid import uuid4

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature
from pydantic import SecretStr
from fastapi.security import HTTPAuthorizationCredentials


def _b64url(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("utf-8")


def _sign(payload: dict, secret: str = "test-secret") -> str:
    header = _b64url(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    body = _b64url(json.dumps(payload).encode())
    signature = hmac.new(secret.encode(), f"{header}.{body}".encode(), hashlib.sha256).digest()
    return f"{header}.{body}.{_b64url(signature)}"


def _sign_es256(payload: dict, private_key: ec.EllipticCurvePrivateKey, kid: str = "test-kid") -> str:
    header = _b64url(json.dumps({"alg": "ES256", "kid": kid, "typ": "JWT"}).encode())
    body = _b64url(json.dumps(payload).encode())
    der_signature = private_key.sign(f"{header}.{body}".encode(), ec.ECDSA(hashes.SHA256()))
    r, s = decode_dss_signature(der_signature)
    signature = r.to_bytes(32, "big") + s.to_bytes(32, "big")
    return f"{header}.{body}.{_b64url(signature)}"


def test_supabase_jwt_dependency_extracts_user(monkeypatch):
    from src.auth import supabase
    from src.auth.supabase import _verify_hs256

    user_id = uuid4()
    monkeypatch.setattr(supabase.settings, "supabase_jwt_secret", SecretStr("test-secret"))

    token = _sign(
        {
            "sub": str(user_id),
            "email": "test@example.com",
            "exp": int(time.time()) + 3600,
            "user_metadata": {"display_name": "Test User", "plan": "pro"},
        }
    )

    claims = _verify_hs256(token, "test-secret")

    assert claims["sub"] == str(user_id)
    assert claims["email"] == "test@example.com"


def test_supabase_jwt_rejects_bad_signature():
    from src.auth.supabase import _verify_hs256

    token = _sign({"sub": str(uuid4()), "exp": int(time.time()) + 3600}, secret="wrong")

    try:
        _verify_hs256(token, "test-secret")
    except ValueError as exc:
        assert "signature" in str(exc)
    else:
        raise AssertionError("Expected invalid signature")


def test_supabase_es256_jwt_uses_jwks(monkeypatch):
    from src.auth import supabase
    from src.auth.supabase import _verify_supabase_token

    user_id = uuid4()
    private_key = ec.generate_private_key(ec.SECP256R1())
    public_numbers = private_key.public_key().public_numbers()
    jwk = {
        "kid": "test-kid",
        "alg": "ES256",
        "kty": "EC",
        "crv": "P-256",
        "x": _b64url(public_numbers.x.to_bytes(32, "big")),
        "y": _b64url(public_numbers.y.to_bytes(32, "big")),
    }
    monkeypatch.setattr(supabase.settings, "supabase_url", "https://example.supabase.co")
    monkeypatch.setattr(supabase, "_fetch_supabase_jwks", lambda _url: {"keys": [jwk]})

    token = _sign_es256(
        {
            "sub": str(user_id),
            "email": "test@example.com",
            "exp": int(time.time()) + 3600,
        },
        private_key,
    )

    claims = _verify_supabase_token(token)

    assert claims["sub"] == str(user_id)
    assert claims["email"] == "test@example.com"


def test_optional_auth_returns_guest_without_token():
    from src.auth.supabase import GUEST_USER_ID, get_current_or_guest_user

    user = asyncio.run(get_current_or_guest_user(None))

    assert user.id == GUEST_USER_ID
    assert user.plan == "free"
    assert user.is_guest is True


def test_editable_jwt_metadata_cannot_grant_paid_plan(monkeypatch):
    from src.auth import supabase
    from src.auth.supabase import get_current_user
    from src.saas import repository

    user_id = uuid4()
    token = _sign(
        {
            "sub": str(user_id),
            "exp": int(time.time()) + 3600,
            "user_metadata": {"plan": "quant"},
        }
    )
    monkeypatch.setattr(supabase.settings, "supabase_jwt_secret", SecretStr("test-secret"))
    monkeypatch.setattr(repository, "get_store", lambda _user=None: (_ for _ in ()).throw(RuntimeError("store unavailable")))

    user = asyncio.run(
        get_current_user(HTTPAuthorizationCredentials(scheme="Bearer", credentials=token))
    )

    assert user.plan == "free"


def test_active_server_subscription_overrides_untrusted_claims(monkeypatch):
    from src.auth import supabase
    from src.auth.supabase import get_current_user
    from src.saas import repository
    from src.saas.models import Plan

    class SubscriptionStore:
        def get_user_plan(self, _user_id):
            return Plan.PRO

    user_id = uuid4()
    token = _sign(
        {
            "sub": str(user_id),
            "exp": int(time.time()) + 3600,
            "user_metadata": {"plan": "quant"},
        }
    )
    monkeypatch.setattr(supabase.settings, "supabase_jwt_secret", SecretStr("test-secret"))
    monkeypatch.setattr(repository, "get_store", lambda _user=None: SubscriptionStore())

    user = asyncio.run(
        get_current_user(HTTPAuthorizationCredentials(scheme="Bearer", credentials=token))
    )

    assert user.plan == "pro"
