import asyncio

from fastapi.testclient import TestClient


def test_news_endpoint_returns_partial_response_when_sources_timeout(monkeypatch):
    from src.api import app as api_app
    from src.api import news_routes

    async def slow_fetch(*args, **kwargs):
        await asyncio.sleep(0.2)
        return []

    news_routes._NEWS_CACHE.clear()
    monkeypatch.setattr(news_routes, "NEWS_TOTAL_TIMEOUT_SECONDS", 0.01)
    monkeypatch.setattr(news_routes, "_fetch_ticker_articles", slow_fetch)
    monkeypatch.setattr(news_routes, "_fetch_search_articles", slow_fetch)

    response = TestClient(api_app.app).get("/api/v1/news?categories=market&limit=5")

    assert response.status_code == 200
    data = response.json()
    assert data["articles"] == []
    assert data["sources_attempted"] == 3
    assert data["sources_succeeded"] == 0
    assert data["sources_failed"] == 3
