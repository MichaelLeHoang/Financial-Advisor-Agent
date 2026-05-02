import base64
import hashlib
import hmac
import json
import time
import asyncio
from uuid import uuid4

from pydantic import SecretStr


def _b64url(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("utf-8")


def _sign(payload: dict, secret: str = "test-secret") -> str:
    header = _b64url(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    body = _b64url(json.dumps(payload).encode())
    signature = hmac.new(secret.encode(), f"{header}.{body}".encode(), hashlib.sha256).digest()
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


def test_optional_auth_returns_guest_without_token():
    from src.auth.supabase import GUEST_USER_ID, get_current_or_guest_user

    user = asyncio.run(get_current_or_guest_user(None))

    assert user.id == GUEST_USER_ID
    assert user.plan == "free"
    assert user.is_guest is True
