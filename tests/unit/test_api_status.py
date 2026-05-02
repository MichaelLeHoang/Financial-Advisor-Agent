from fastapi.testclient import TestClient


def test_status_endpoint_redacts_secrets_and_reports_services(monkeypatch):
    from src.api import app as api_app

    class FakeCollections:
        collections = [object(), object()]

    class FakeQdrantClient:
        def get_collections(self):
            return FakeCollections()

    monkeypatch.setattr(api_app, "get_qdrant_client", lambda: FakeQdrantClient())

    response = TestClient(api_app.app).get("/api/v1/status")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["services"]["qdrant"]["status"] == "ok"
    assert data["services"]["qdrant"]["collections"] == 2
    assert "GEMINI_API_KEY" not in str(data)
    assert "sk_" not in str(data)


def test_agent_reset_uses_default_session(monkeypatch):
    from src.api import app as api_app

    cleared_sessions = []

    class FakeAgent:
        def reset_history(self):
            self.reset = True

    monkeypatch.setattr(api_app, "get_agent", lambda: FakeAgent())
    monkeypatch.setattr("src.agent.history.clear_history", lambda session_id: cleared_sessions.append(session_id))

    response = TestClient(api_app.app).post("/api/v1/agent/reset")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "session_id": "default"}
    assert cleared_sessions == ["default"]
