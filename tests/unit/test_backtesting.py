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

    metrics, equity_curve, trades = run_backtest(req, StaticMarketDataAdapter({"AAPL": _prices([100, 102, 104, 108, 110])}))

    assert metrics.total_return == 0.1
    assert metrics.number_of_trades == 1
    assert metrics.fees_paid == 0
    assert equity_curve[-1].value == 11_000
    assert [trade.side for trade in trades] == ["buy", "sell"]


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
