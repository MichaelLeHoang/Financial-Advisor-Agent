from fastapi.testclient import TestClient


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

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "session_id": "default"}
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
