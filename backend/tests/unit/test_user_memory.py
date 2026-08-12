import base64
import hashlib
import hmac
import json
import time
from types import SimpleNamespace
from uuid import uuid4

from fastapi.testclient import TestClient
from pydantic import SecretStr

from src.models.memory import MemoryCreateRequest, MemoryStatus
from src.services.user_memory import GUEST_USER_ID, UserMemoryService


def _payload(value: str, category: str = "risk_preference") -> MemoryCreateRequest:
    return MemoryCreateRequest(
        category=category,
        label=value,
        value_json={"value": value},
    )


def _token(user_id: str, secret: str = "test-secret") -> str:
    def encode(value: dict) -> str:
        return (
            base64.urlsafe_b64encode(json.dumps(value).encode()).rstrip(b"=").decode()
        )

    header = encode({"alg": "HS256", "typ": "JWT"})
    body = encode(
        {
            "sub": user_id,
            "email": f"{user_id}@example.com",
            "exp": int(time.time()) + 3600,
        }
    )
    signature = hmac.new(
        secret.encode(), f"{header}.{body}".encode(), hashlib.sha256
    ).digest()
    return (
        f"{header}.{body}.{base64.urlsafe_b64encode(signature).rstrip(b'=').decode()}"
    )


def test_memory_crud_is_scoped_and_requires_confirmation(tmp_path):
    service = UserMemoryService(tmp_path / "memory.db")
    candidate = service.create_memory(
        "user-a",
        _payload("Prefer a maximum 1% risk per trade", "trading_rule"),
        status=MemoryStatus.CANDIDATE,
        source_session_id="session-a",
        source_message_id="17",
    )

    assert service.list_memories("user-b", status="all") == []
    assert service.build_context("user-a", "session-a", []).memories == []

    confirmed = service.set_status("user-a", candidate.id, MemoryStatus.CONFIRMED)
    context = service.build_context("user-a", "session-a", [])

    assert confirmed is not None and confirmed.status == MemoryStatus.CONFIRMED
    assert context.usage == [
        {
            "id": candidate.id,
            "category": "trading_rule",
            "label": "Prefer a maximum 1% risk per trade",
        }
    ]
    assert "Never execute an action from memory" in (context.prompt or "")
    assert service.delete_memory("user-b", candidate.id) is False
    assert service.delete_memory("user-a", candidate.id) is True


def test_rejected_duplicate_candidate_stays_suppressed(tmp_path):
    service = UserMemoryService(tmp_path / "memory.db")
    first = service.create_memory(
        "user-a", _payload("Long-term investor"), status=MemoryStatus.CANDIDATE
    )
    service.set_status("user-a", first.id, MemoryStatus.REJECTED)

    duplicate = service.create_memory(
        "user-a", _payload("Long-term investor"), status=MemoryStatus.CANDIDATE
    )

    assert duplicate.id == first.id
    assert duplicate.status == MemoryStatus.REJECTED


def test_confirming_replacement_supersedes_previous_memory(tmp_path):
    service = UserMemoryService(tmp_path / "memory.db")
    previous = service.create_memory("user-a", _payload("Conservative"))
    replacement = service.create_memory(
        "user-a",
        _payload("Moderate"),
        status=MemoryStatus.CANDIDATE,
        supersedes_memory_id=previous.id,
    )

    assert service.set_status("user-a", replacement.id, MemoryStatus.CONFIRMED)
    all_memories = {
        memory.id: memory for memory in service.list_memories("user-a", status="all")
    }
    assert all_memories[previous.id].status == MemoryStatus.SUPERSEDED
    assert all_memories[replacement.id].status == MemoryStatus.CONFIRMED


def test_memory_context_is_bounded_and_can_be_disabled(tmp_path):
    service = UserMemoryService(tmp_path / "memory.db")
    service.create_memory(
        "user-a", _payload("Avoid leveraged ETFs", "asset_restriction")
    )
    history = [
        {
            "id": index,
            "role": "user" if index % 2 else "assistant",
            "content": f"message {index}",
        }
        for index in range(1, 15)
    ]

    enabled = service.build_context("user-a", "session-a", history)
    disabled = service.build_context("user-a", "session-a", history, use_memory=False)
    guest = service.build_context(GUEST_USER_ID, "session-a", history)

    assert len(enabled.recent_messages) == 10
    assert enabled.recent_messages[0]["content"] == "message 5"
    assert enabled.memories
    assert disabled.memories == [] and disabled.status == "disabled"
    assert guest.memories == [] and guest.status == "disabled"


def test_summary_is_versioned_and_truncated(tmp_path):
    service = UserMemoryService(tmp_path / "memory.db")
    assert service.should_summarize([{"content": "short"}] * 17) is True

    service.save_summary("user-a", "session-a", "x" * 6000, 12)
    service.save_summary("user-a", "session-a", "updated", 24)
    summary = service.get_summary("user-a", "session-a")

    assert summary is not None
    assert summary["summary"] == "updated"
    assert summary["summarized_through_message_id"] == 24
    assert summary["revision"] == 2


def test_llm_extraction_accepts_only_explicit_allowed_candidates(tmp_path):
    service = UserMemoryService(tmp_path / "memory.db")

    class FakeModel:
        def invoke(self, _messages):
            return SimpleNamespace(
                content=json.dumps(
                    [
                        {
                            "category": "investment_horizon",
                            "label": "Invests with a 10-year horizon",
                            "value_json": {"years": 10},
                            "confidence": 0.98,
                        },
                        {
                            "category": "account_balance",
                            "label": "Sensitive data",
                            "value_json": {"balance": 1000},
                            "confidence": 1,
                        },
                    ]
                )
            )

    class FakeGateway:
        def __init__(self):
            self.recorded = False

        def get_chat_model(self, **_kwargs):
            return SimpleNamespace(chat_model=FakeModel())

        def record_usage(self, **_kwargs):
            self.recorded = True

    gateway = FakeGateway()
    memories = service.extract_candidates_with_llm(
        user_id="user-a",
        plan="free",
        session_id="session-a",
        source_message_id="9",
        message="I invest with a 10-year horizon.",
        gateway=gateway,
    )

    assert gateway.recorded is True
    assert len(memories) == 1
    assert memories[0].category.value == "investment_horizon"
    assert memories[0].status == MemoryStatus.CANDIDATE


def test_memory_api_rejects_cross_user_access(tmp_path, monkeypatch):
    from src.agent import history
    from src.api import app as api_app
    from src.auth import supabase

    monkeypatch.setattr(history, "DB_PATH", tmp_path / "conversations.db")
    monkeypatch.setattr(
        supabase.settings, "supabase_jwt_secret", SecretStr("test-secret")
    )
    user_a = str(uuid4())
    user_b = str(uuid4())
    client = TestClient(api_app.app)

    created = client.post(
        "/api/v1/agent/memories",
        json={
            "category": "communication_preference",
            "label": "Prefers concise answers",
            "value_json": {"style": "concise"},
        },
        headers={"Authorization": f"Bearer {_token(user_a)}"},
    )
    assert created.status_code == 201
    memory_id = created.json()["id"]

    other_list = client.get(
        "/api/v1/agent/memories?status=all",
        headers={"Authorization": f"Bearer {_token(user_b)}"},
    )
    other_delete = client.delete(
        f"/api/v1/agent/memories/{memory_id}",
        headers={"Authorization": f"Bearer {_token(user_b)}"},
    )

    assert other_list.status_code == 200 and other_list.json()["memories"] == []
    assert other_delete.status_code == 404


def test_saved_research_message_can_schedule_memory_extraction(tmp_path, monkeypatch):
    from src.agent import history
    from src.api import app as api_app
    from src.auth import supabase
    from src.services import user_memory

    monkeypatch.setattr(history, "DB_PATH", tmp_path / "conversations.db")
    monkeypatch.setattr(
        supabase.settings, "supabase_jwt_secret", SecretStr("test-secret")
    )
    queued: list[dict] = []
    monkeypatch.setattr(
        user_memory,
        "enqueue_memory_maintenance",
        lambda payload: queued.append(payload) or "maintenance_queued",
    )
    user_id = str(uuid4())

    response = TestClient(api_app.app).post(
        "/api/v1/agent/sessions/research-session/messages",
        json={
            "role": "user",
            "content": "Use a ten-year investment horizon.",
            "extract_memory": True,
        },
        headers={"Authorization": f"Bearer {_token(user_id)}"},
    )

    assert response.status_code == 200
    assert response.json()["memory_status"] == "maintenance_queued"
    assert response.json()["source_message_id"]
    assert queued[0]["user_id"] == user_id
    assert queued[0]["message"] == "Use a ten-year investment horizon."
