import time
from types import SimpleNamespace

from fastapi.testclient import TestClient


def test_market_quote_times_out_without_blocking(monkeypatch):
    from src.api import app as api_app

    def slow_quote(*args, **kwargs):
        time.sleep(0.2)

    monkeypatch.setattr(api_app, "MARKET_QUOTE_TIMEOUT_SECONDS", 0.01)
    monkeypatch.setattr(api_app, "_fetch_market_quote_response", slow_quote)

    response = TestClient(api_app.app).get("/api/v1/market/quote/AAPL")

    assert response.status_code == 504
    assert "timed out" in response.json()["detail"]


def test_market_search_times_out_without_blocking(monkeypatch):
    from src.api import app as api_app

    def slow_search(*args, **kwargs):
        time.sleep(0.2)
        return []

    monkeypatch.setattr(api_app, "MARKET_SEARCH_TIMEOUT_SECONDS", 0.01)
    monkeypatch.setattr(api_app, "_search_market_symbols", slow_search)

    response = TestClient(api_app.app).get("/api/v1/market/search?q=AAPL")

    assert response.status_code == 504
    assert "timed out" in response.json()["detail"]


def test_market_quote_fallback_history_uses_live_quote_when_history_missing():
    from src.api import app as api_app

    snapshot = SimpleNamespace(
        latest_price=105.0,
        previous_close=100.0,
        open_price=101.0,
        day_high=106.0,
        day_low=99.5,
        volume=12345,
    )

    points = api_app._fallback_quote_history(snapshot, "1d")

    assert [point.label for point in points] == ["Open", "Now"]
    assert [point.price for point in points] == [101.0, 105.0]
    assert points[-1].volume == 12345
