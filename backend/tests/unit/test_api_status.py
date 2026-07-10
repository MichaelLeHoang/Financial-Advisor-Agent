from fastapi.testclient import TestClient
import base64
import hashlib
import hmac
import json
import time
from uuid import uuid4

from pydantic import SecretStr


def _b64url(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("utf-8")


def _sign(payload: dict, secret: str = "test-secret") -> str:
    header = _b64url(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    body = _b64url(json.dumps(payload).encode())
    signature = hmac.new(secret.encode(), f"{header}.{body}".encode(), hashlib.sha256).digest()
    return f"{header}.{body}.{_b64url(signature)}"


def _auth_headers(user_id) -> dict[str, str]:
    token = _sign({"sub": str(user_id), "email": f"{user_id}@example.com", "exp": int(time.time()) + 3600})
    return {"Authorization": f"Bearer {token}"}


def test_status_endpoint_redacts_secrets_and_reports_services(monkeypatch):
    from src.api import app as api_app

    class FakeCollections:
        collections = [object(), object()]

    class FakeQdrantClient:
        def get_collections(self):
            return FakeCollections()

    monkeypatch.setattr(api_app, "get_qdrant_client", lambda: FakeQdrantClient())
    monkeypatch.setattr(api_app, "_check_redis", lambda: {"status": "ok", "configured": True})

    response = TestClient(api_app.app).get("/api/v1/status")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["services"]["qdrant"]["status"] == "ok"
    assert data["services"]["qdrant"]["collections"] == 2
    assert "GEMINI_API_KEY" not in str(data)
    assert "sk_" not in str(data)


def test_status_endpoint_separates_optional_degradation(monkeypatch):
    from src.api import app as api_app

    monkeypatch.setattr(
        api_app,
        "_check_qdrant",
        lambda: {"status": "error", "configured": True, "detail": "connection refused"},
    )
    monkeypatch.setattr(
        api_app,
        "_check_redis",
        lambda: {"status": "error", "configured": True, "detail": "connection refused"},
    )

    response = TestClient(api_app.app).get("/api/v1/status")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "degraded"
    assert data["core_status"] == "ok"
    assert data["optional_status"] == "degraded"
    assert data["core_error_services"] == []
    assert data["degraded_optional_services"] == ["qdrant", "redis"]


def test_agent_reset_uses_default_session(monkeypatch):
    from src.api import app as api_app

    cleared_sessions = []

    class FakeAgent:
        def reset_history(self):
            self.reset = True

    monkeypatch.setattr(api_app, "get_agent", lambda: FakeAgent())
    monkeypatch.setattr("src.agent.history.clear_history", lambda session_id, user_id=None: cleared_sessions.append((session_id, user_id)))

    response = TestClient(api_app.app).post("/api/v1/agent/reset")

    assert response.status_code == 401
    assert cleared_sessions == []


def test_agent_chat_job_endpoints_use_queue(monkeypatch):
    from src.api import app as api_app
    import src.agent.llm_queue as queue_module

    class FakeQueue:
        def __init__(self):
            self.record = None

        def enqueue(self, payload, kind):
            self.record = {
                "job_id": "job-1",
                "kind": kind,
                "status": "queued",
                "payload": payload,
                "created_at": 1.0,
            }
            return self.record

        def queue_position(self, job_id, kind):
            return 1

        def get(self, job_id):
            return self.record

    fake_queue = FakeQueue()
    monkeypatch.setattr(queue_module, "get_llm_job_queue", lambda: fake_queue)

    client = TestClient(api_app.app)
    create = client.post(
        "/api/v1/agent/chat/jobs",
        json={"message": "What is AAPL?", "session_id": "s1", "mode": "single"},
    )

    assert create.status_code == 200
    assert create.json() == {"job_id": "job-1", "status": "queued", "queue_position": 1}

    status = client.get("/api/v1/agent/chat/jobs/job-1")
    assert status.status_code == 200
    assert status.json()["status"] == "queued"


def test_agent_chat_job_status_is_scoped_to_current_user(monkeypatch):
    from src.api import app as api_app
    from src.auth import supabase
    import src.agent.llm_queue as queue_module

    monkeypatch.setattr(supabase.settings, "supabase_jwt_secret", SecretStr("test-secret"))

    class FakeQueue:
        def __init__(self):
            self.record = None

        def enqueue(self, payload, kind):
            self.record = {
                "job_id": "job-user-a",
                "kind": kind,
                "status": "queued",
                "payload": payload,
                "created_at": 1.0,
            }
            return self.record

        def queue_position(self, job_id, kind):
            return 1

        def get(self, job_id):
            return self.record

    fake_queue = FakeQueue()
    monkeypatch.setattr(queue_module, "get_llm_job_queue", lambda: fake_queue)

    user_a = uuid4()
    user_b = uuid4()
    client = TestClient(api_app.app)

    create = client.post(
        "/api/v1/agent/chat/jobs",
        json={"message": "What is AAPL?", "session_id": "user-a-session", "mode": "single"},
        headers=_auth_headers(user_a),
    )

    assert create.status_code == 200
    assert fake_queue.record["payload"]["user_id"] == str(user_a)
    assert client.get("/api/v1/agent/chat/jobs/job-user-a", headers=_auth_headers(user_b)).status_code == 404

    own_status = client.get("/api/v1/agent/chat/jobs/job-user-a", headers=_auth_headers(user_a))
    assert own_status.status_code == 200
    assert own_status.json()["status"] == "queued"


def test_agent_session_endpoints_scope_to_current_user(tmp_path, monkeypatch):
    from src.api import app as api_app
    from src.agent import history
    from src.auth import supabase

    monkeypatch.setattr(history, "DB_PATH", tmp_path / "conversations.db")
    monkeypatch.setattr(supabase.settings, "supabase_jwt_secret", SecretStr("test-secret"))

    user_a = uuid4()
    user_b = uuid4()
    history.append_message("session-a", "user", "User A private question", str(user_a))
    history.append_message("session-a", "assistant", "User A private answer", str(user_a))
    history.append_message("session-b", "user", "User B private question", str(user_b))

    client = TestClient(api_app.app)

    created = client.post(
        "/api/v1/agent/sessions",
        headers=_auth_headers(user_a),
        json={"session_id": "empty-session", "title": "New chat"},
    )
    assert created.status_code == 200
    assert created.json()["title"] == "New chat"
    assert created.json()["message_count"] == 0

    sessions_a = client.get("/api/v1/agent/sessions", headers=_auth_headers(user_a))
    assert sessions_a.status_code == 200
    assert {row["session_id"] for row in sessions_a.json()} == {"session-a", "empty-session"}

    own_messages = client.get("/api/v1/agent/sessions/session-a/messages", headers=_auth_headers(user_a))
    assert own_messages.status_code == 200
    assert own_messages.json()["messages"][0]["content"] == "User A private question"

    cross_messages = client.get("/api/v1/agent/sessions/session-b/messages", headers=_auth_headers(user_a))
    assert cross_messages.status_code == 404

    cross_rename = client.patch(
        "/api/v1/agent/sessions/session-b",
        headers=_auth_headers(user_a),
        json={"title": "stolen"},
    )
    assert cross_rename.status_code == 404

    cross_delete = client.delete("/api/v1/agent/sessions/session-b", headers=_auth_headers(user_a))
    assert cross_delete.status_code == 404
    assert history.load_history("session-b", str(user_b))[0]["content"] == "User B private question"


def test_guest_cannot_load_or_mutate_saved_chat_sessions(tmp_path, monkeypatch):
    from src.api import app as api_app
    from src.agent import history

    monkeypatch.setattr(history, "DB_PATH", tmp_path / "conversations.db")

    client = TestClient(api_app.app)
    assert client.post("/api/v1/agent/sessions", json={"session_id": "any", "title": "New chat"}).status_code == 401
    assert client.get("/api/v1/agent/sessions").status_code == 401
    assert client.get("/api/v1/agent/sessions/any/messages").status_code == 401
    assert client.patch("/api/v1/agent/sessions/any", json={"title": "x"}).status_code == 401
    assert client.delete("/api/v1/agent/sessions/any").status_code == 401


def test_ingestion_rejects_unauthenticated_callers(monkeypatch):
    from src.api import app as api_app

    called = False

    def fake_ingest(_tickers):
        nonlocal called
        called = True
        return {}

    monkeypatch.setattr(api_app, "ingest_news", fake_ingest)

    response = TestClient(api_app.app).post("/api/v1/ingest")

    assert response.status_code == 401
    assert called is False


def test_rag_query_uses_ai_quota(monkeypatch):
    from src.api import app as api_app
    from src.models.schemas import RAGResponse

    increments = []
    monkeypatch.setattr(
        api_app,
        "rag_ask",
        lambda question, ticker_filter=None: RAGResponse(
            answer=f"Answer for {question}",
            sources=[],
            query=question,
            confidence=0.5,
        ),
    )
    monkeypatch.setattr(api_app.usage_tracker, "increment", lambda *args: increments.append(args))

    response = TestClient(api_app.app).post("/api/v1/query", params={"question": "AAPL outlook"})

    assert response.status_code == 200
    assert len(increments) == 1
