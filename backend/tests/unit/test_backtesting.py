from datetime import date
from uuid import uuid4

import pandas as pd
from fastapi.testclient import TestClient

from src.auth.supabase import get_current_or_guest_user
from src.backtesting.engine import run_backtest
from src.backtesting.market_data import StaticMarketDataAdapter
from src.backtesting.models import BacktestRequest
from src.saas.models import AuthenticatedUser, Plan
from src.saas.repository import store


def _use_memory_store(monkeypatch):
    from src.saas import repository

    monkeypatch.setattr(repository.settings, "supabase_url", None)
    monkeypatch.setattr(repository.settings, "supabase_service_role_key", None)


def _override_user(user_id, plan=Plan.TRADER):
    async def dependency():
        return AuthenticatedUser(id=user_id, email=f"{user_id}@example.com", plan=plan, is_guest=True)

    return dependency


def _prices(values: list[float]) -> pd.Series:
    return pd.Series(values, index=pd.date_range("2024-01-01", periods=len(values), freq="D"))


def test_buy_and_hold_backtest_calculates_metrics():
    req = BacktestRequest(
        strategy_name="Benchmark",
        strategy_type="buy_and_hold",
        symbols=["AAPL"],
        start_date=date(2024, 1, 1),
        end_date=date(2024, 1, 8),
        initial_capital=10_000,
        fees_bps=0,
        slippage_bps=0,
    )

    metrics, equity_curve, trades, price_series = run_backtest(req, StaticMarketDataAdapter({"AAPL": _prices([100, 102, 104, 108, 110])}))

    assert metrics.total_return == 0.1
    assert metrics.number_of_trades == 1
    assert metrics.fees_paid == 0
    assert equity_curve[-1].value == 11_000
    assert [trade.side for trade in trades] == ["buy", "sell"]
    assert len(price_series["AAPL"]) == 5
    assert price_series["AAPL"][0].close == 100


def test_free_plan_cannot_run_backtest(monkeypatch):
    from src.api.app import app

    _use_memory_store(monkeypatch)
    user_id = uuid4()
    client = TestClient(app)
    app.dependency_overrides[get_current_or_guest_user] = _override_user(user_id, plan=Plan.FREE)

    response = client.post(
        "/api/v1/backtests/run",
        json={
            "strategy_name": "MA test",
            "strategy_type": "moving_average_crossover",
            "symbols": ["AAPL"],
            "start_date": "2024-01-01",
            "end_date": "2024-02-01",
            "initial_capital": 10000,
        },
    )

    assert response.status_code == 403
    assert response.json()["detail"]["feature_key"] == "backtesting"

    app.dependency_overrides.clear()
    store.reset()


def test_trader_backtest_route_persists_run_and_strategy(monkeypatch):
    from src.api.app import app
    from src.backtesting import routes

    _use_memory_store(monkeypatch)
    user_id = uuid4()
    client = TestClient(app)
    store.reset()
    app.dependency_overrides[get_current_or_guest_user] = _override_user(user_id, plan=Plan.TRADER)

    class FakeAdapter:
        def fetch_prices(self, symbols, start_date, end_date):
            return {"AAPL": _prices([100, 101, 102, 103, 104, 105, 106])}

    monkeypatch.setattr(routes, "YFinanceMarketDataAdapter", FakeAdapter)

    response = client.post(
        "/api/v1/backtests/run",
        json={
            "strategy_name": "Saved MA",
            "strategy_type": "moving_average_crossover",
            "symbols": ["AAPL"],
            "start_date": "2024-01-01",
            "end_date": "2024-02-01",
            "initial_capital": 10000,
            "fees_bps": 0,
            "slippage_bps": 0,
            "parameters": {"short_window": 2, "long_window": 3},
            "save_strategy": True,
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["run"]["strategy_name"] == "Saved MA"
    assert data["run"]["strategy_id"] is not None
    assert data["metrics"]["total_return"] > 0
    assert "Historical results do not guarantee future performance" in data["disclaimer"]

    runs = client.get("/api/v1/backtests/runs")
    assert runs.status_code == 200
    assert len(runs.json()) == 1

    strategies = client.get("/api/v1/backtests/strategies")
    assert strategies.status_code == 200
    assert strategies.json()[0]["name"] == "Saved MA"

    app.dependency_overrides.clear()
    store.reset()


class FakeOhlcAdapter:
    def __init__(self, symbols=("AAPL",), values=(100, 101, 102, 103, 104, 105, 106)):
        self._symbols = symbols
        self._values = list(values)

    def fetch_prices(self, symbols, start_date, end_date):
        return {symbol: _prices(self._values) for symbol in symbols if symbol in self._symbols}

    def fetch_ohlc(self, symbols, start_date, end_date):
        closes = _prices(self._values)
        frame = pd.DataFrame(
            {
                "Open": closes - 1,
                "High": closes + 1,
                "Low": closes - 2,
                "Close": closes,
                "Volume": pd.Series([1_000] * len(closes), index=closes.index),
            }
        )
        return {symbol: frame for symbol in symbols if symbol in self._symbols}


def _setup_client(monkeypatch, plan=Plan.TRADER, adapter=None):
    from src.api.app import app
    from src.backtesting import routes

    _use_memory_store(monkeypatch)
    store.reset()
    user_id = uuid4()
    client = TestClient(app)
    app.dependency_overrides[get_current_or_guest_user] = _override_user(user_id, plan=plan)
    monkeypatch.setattr(routes, "YFinanceMarketDataAdapter", adapter or FakeOhlcAdapter)
    return app, client


def test_candles_endpoint_returns_ohlc(monkeypatch):
    app, client = _setup_client(monkeypatch)

    response = client.get("/api/v1/backtests/market-data/candles?symbols=aapl, AAPL&start=2024-01-01&end=2024-02-01")

    assert response.status_code == 200
    data = response.json()
    assert set(data["candles"]) == {"AAPL"}
    first = data["candles"]["AAPL"][0]
    assert first["date"] == "2024-01-01"
    assert first["low"] <= first["open"] <= first["high"]
    assert first["volume"] == 1_000

    missing = client.get("/api/v1/backtests/market-data/candles?symbols=MSFT&start=2024-01-01&end=2024-02-01")
    assert missing.status_code == 400

    bad_range = client.get("/api/v1/backtests/market-data/candles?symbols=AAPL&start=2024-02-01&end=2024-01-01")
    assert bad_range.status_code == 400

    app.dependency_overrides.clear()
    store.reset()


def test_candles_endpoint_requires_plan(monkeypatch):
    app, client = _setup_client(monkeypatch, plan=Plan.FREE)

    response = client.get("/api/v1/backtests/market-data/candles?symbols=AAPL&start=2024-01-01&end=2024-02-01")

    assert response.status_code == 403
    assert response.json()["detail"]["feature_key"] == "backtesting"

    app.dependency_overrides.clear()
    store.reset()


def test_run_get_and_delete_lifecycle(monkeypatch):
    app, client = _setup_client(monkeypatch)

    created = client.post(
        "/api/v1/backtests/run",
        json={
            "strategy_name": "Lifecycle",
            "strategy_type": "buy_and_hold",
            "symbols": ["AAPL"],
            "start_date": "2024-01-01",
            "end_date": "2024-02-01",
            "initial_capital": 10000,
        },
    )
    assert created.status_code == 200
    run_id = created.json()["run"]["id"]

    fetched = client.get(f"/api/v1/backtests/runs/{run_id}")
    assert fetched.status_code == 200
    assert fetched.json()["strategy_name"] == "Lifecycle"
    assert fetched.json()["trades"]

    assert client.get(f"/api/v1/backtests/runs/{uuid4()}").status_code == 404

    deleted = client.delete(f"/api/v1/backtests/runs/{run_id}")
    assert deleted.status_code == 204
    assert client.get(f"/api/v1/backtests/runs/{run_id}").status_code == 404
    assert client.get("/api/v1/backtests/runs").json() == []

    app.dependency_overrides.clear()
    store.reset()


def test_replay_session_lifecycle(monkeypatch):
    app, client = _setup_client(monkeypatch)

    created = client.post(
        "/api/v1/backtests/replay-sessions",
        json={
            "name": "AAPL practice",
            "symbol": "aapl",
            "start_date": "2024-01-01",
            "end_date": "2024-02-01",
            "initial_balance": 5000,
        },
    )
    assert created.status_code == 200
    session = created.json()
    assert session["symbol"] == "AAPL"
    assert session["status"] == "active"
    assert session["total_bars"] == 7
    assert session["cash"] == 5000

    session_id = session["id"]

    progress = client.patch(
        f"/api/v1/backtests/replay-sessions/{session_id}",
        json={
            "current_index": 4,
            "cash": 2500,
            "position_qty": 24.5,
            "position_avg_price": 102,
            "trades": [{"date": "2024-01-03", "side": "buy", "quantity": 24.5, "price": 102, "fee": 0}],
            "equity_curve": [{"date": "2024-01-03", "value": 5000}],
        },
    )
    assert progress.status_code == 200
    assert progress.json()["current_index"] == 4
    assert progress.json()["trades"][0]["side"] == "buy"

    completed = client.patch(
        f"/api/v1/backtests/replay-sessions/{session_id}",
        json={"status": "completed", "metrics": {"total_return": 0.05, "number_of_trades": 2}},
    )
    assert completed.status_code == 200
    assert completed.json()["status"] == "completed"
    assert completed.json()["current_index"] == 4
    assert completed.json()["metrics"]["total_return"] == 0.05

    listing = client.get("/api/v1/backtests/replay-sessions")
    assert listing.status_code == 200
    assert [row["id"] for row in listing.json()] == [session_id]

    assert client.delete(f"/api/v1/backtests/replay-sessions/{session_id}").status_code == 204
    assert client.get(f"/api/v1/backtests/replay-sessions/{session_id}").status_code == 404

    app.dependency_overrides.clear()
    store.reset()


def test_replay_session_requires_data_and_plan(monkeypatch):
    app, client = _setup_client(monkeypatch)

    no_data = client.post(
        "/api/v1/backtests/replay-sessions",
        json={
            "name": "No data",
            "symbol": "MSFT",
            "start_date": "2024-01-01",
            "end_date": "2024-02-01",
            "initial_balance": 5000,
        },
    )
    assert no_data.status_code == 400

    app.dependency_overrides[get_current_or_guest_user] = _override_user(uuid4(), plan=Plan.FREE)
    forbidden = client.get("/api/v1/backtests/replay-sessions")
    assert forbidden.status_code == 403

    app.dependency_overrides.clear()
    store.reset()
