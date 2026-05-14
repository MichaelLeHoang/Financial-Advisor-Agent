import base64
import hashlib
import json
from typing import Any

from cryptography.fernet import Fernet

from src.config import settings


def _fernet() -> Fernet | None:
    secret = settings.secret_value("notification_secret_key")
    if not secret:
        return None
    key = base64.urlsafe_b64encode(hashlib.sha256(secret.encode("utf-8")).digest())
    return Fernet(key)


def encrypt_text(value: str | None) -> str | None:
    if value is None:
        return None
    fernet = _fernet()
    if fernet is None:
        # Development fallback keeps tests and local setup usable. Production
        # readiness is reported through /api/v1/status when the secret is absent.
        return f"plain:{value}"
    return fernet.encrypt(value.encode("utf-8")).decode("utf-8")


def encrypt_json(value: dict[str, Any]) -> dict[str, Any]:
    encrypted = encrypt_text(json.dumps(value))
    return {"encrypted": encrypted} if encrypted else {}
