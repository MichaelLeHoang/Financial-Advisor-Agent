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


def test_market_quote_returns_normalized_earnings_calendar(monkeypatch):
    from src.api import app as api_app
    from src.data.market_data_service import NormalizedMarketSnapshot

    snapshot = NormalizedMarketSnapshot(
        ticker="AAPL",
        company_name="Apple Inc.",
        logo_url="https://static.example/apple.png",
        latest_price=220.0,
        earnings=[{
            "date": "2026-11-05",
            "session": "post",
            "eps_actual": None,
            "eps_estimate": 1.85,
            "beat_pct": None,
            "revenue_actual": None,
            "revenue_estimate": None,
            "revenue_beat_pct": None,
        }],
    )
    monkeypatch.setattr(api_app.market_data_service, "fetch_snapshot", lambda *args, **kwargs: snapshot)

    response = api_app._fetch_market_quote_response("AAPL", "1y", "1d")

    assert response.earnings[0].date == "2026-11-05"
    assert response.earnings[0].session == "post"
    assert response.earnings[0].eps_estimate == 1.85
    assert response.earnings[0].eps_actual is None
    assert response.logo_url == "https://static.example/apple.png"


def test_market_earnings_calendar_returns_provider_events(monkeypatch):
    from src.api import app as api_app

    monkeypatch.setattr(
        api_app.market_data_service,
        "fetch_earnings_calendar",
        lambda *args, **kwargs: ([{
            "symbol": "NVDA",
            "name": "NVIDIA Corporation",
            "date": "2026-08-26",
            "session": "post",
            "country": "US",
            "market_cap": 5_200_000_000_000,
            "logo_url": None,
            "eps_actual": None,
            "eps_estimate": 2.08,
            "beat_pct": None,
            "revenue_actual": None,
            "revenue_estimate": None,
            "revenue_beat_pct": None,
        }], ["yfinance_earnings_calendar"]),
    )

    response = TestClient(api_app.app).get("/api/v1/market/earnings?from=2026-08-01&to=2026-08-31")

    assert response.status_code == 200
    payload = response.json()
    assert payload["events"][0]["symbol"] == "NVDA"
    assert payload["events"][0]["eps_estimate"] == 2.08
    assert payload["data_sources"] == ["yfinance_earnings_calendar"]
