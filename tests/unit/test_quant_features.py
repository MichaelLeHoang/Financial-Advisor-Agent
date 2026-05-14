from datetime import date
from uuid import uuid4

import pandas as pd
from fastapi.testclient import TestClient

from src.auth.supabase import get_current_or_guest_user
from src.backtesting.market_data import StaticMarketDataAdapter
from src.quant.calculations import compare_strategies, rank_signals
from src.quant.models import SignalRankingRequest, StrategyComparisonRequest, StrategyConfig
from src.saas.models import AuthenticatedUser, Plan
from src.saas.repository import store


def _use_memory_store(monkeypatch):
    from src.saas import repository

    monkeypatch.setattr(repository.settings, "supabase_url", None)
    monkeypatch.setattr(repository.settings, "supabase_service_role_key", None)


def _override_user(user_id, plan=Plan.QUANT):
    async def dependency():
        return AuthenticatedUser(id=user_id, email=f"{user_id}@example.com", plan=plan, is_guest=True)

    return dependency


def _prices(values: list[float]) -> pd.Series:
    return pd.Series(values, index=pd.date_range("2024-01-01", periods=len(values), freq="D"))


def test_strategy_comparison_calculates_best_strategy():
    req = StrategyComparisonRequest(
        symbols=["AAPL"],
        start_date=date(2024, 1, 1),
        end_date=date(2024, 2, 1),
        strategies=[
            StrategyConfig(name="Hold", strategy_type="buy_and_hold", parameters={}),
            StrategyConfig(name="MA", strategy_type="moving_average_crossover", parameters={"short_window": 2, "long_window": 3}),
        ],
    )

    result = compare_strategies(req, StaticMarketDataAdapter({"AAPL": _prices([100, 101, 102, 103, 104, 105, 106])}))

    assert len(result.results) == 2
    assert result.best_strategy in {"Hold", "MA"}
    assert result.results[0].metrics.total_return > 0


def test_signal_ranking_orders_by_score():
    req = SignalRankingRequest(symbols=["AAA", "BBB"], start_date=date(2024, 1, 1), end_date=date(2024, 4, 1))
    adapter = StaticMarketDataAdapter({
        "AAA": _prices([100 + index for index in range(80)]),
        "BBB": _prices([100 - index * 0.2 for index in range(80)]),
    })

    result = rank_signals(req, adapter)

    assert result[0].symbol == "AAA"
    assert result[0].score > result[1].score


def test_trader_cannot_use_quant_strategy_compare(monkeypatch):
    from src.api.app import app

    _use_memory_store(monkeypatch)
    user_id = uuid4()
    client = TestClient(app)
    app.dependency_overrides[get_current_or_guest_user] = _override_user(user_id, plan=Plan.TRADER)

    response = client.post(
        "/api/v1/quant/strategy-compare",
        json={
            "symbols": ["AAPL"],
            "start_date": "2024-01-01",
            "end_date": "2024-02-01",
            "strategies": [{"name": "Hold", "strategy_type": "buy_and_hold", "parameters": {}}],
        },
    )

    assert response.status_code == 403
    assert response.json()["detail"]["feature_key"] == "strategy_compare"

    app.dependency_overrides.clear()
    store.reset()


def test_quant_export_persists_and_uses_coding_export_mode(monkeypatch):
    from src.api.app import app

    _use_memory_store(monkeypatch)
    user_id = uuid4()
    client = TestClient(app)
    store.reset()
    app.dependency_overrides[get_current_or_guest_user] = _override_user(user_id, plan=Plan.QUANT)

    response = client.post(
        "/api/v1/quant/export",
        json={
            "strategy_name": "MA export",
            "strategy_type": "moving_average_crossover",
            "symbols": ["AAPL"],
            "parameters": {"short_window": 2, "long_window": 5},
            "language": "python",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["routed_mode"] == "coding_export"
    assert data["saved_export_id"]
    assert "generate_signals" in data["content"]

    app.dependency_overrides.clear()
    store.reset()


def test_quant_validation_route_returns_all_validation_blocks(monkeypatch):
    from src.api.app import app
    from src.quant import routes

    _use_memory_store(monkeypatch)
    user_id = uuid4()
    client = TestClient(app)
    store.reset()
    app.dependency_overrides[get_current_or_guest_user] = _override_user(user_id, plan=Plan.QUANT)

    class FakeAdapter:
        def fetch_prices(self, symbols, start_date, end_date):
            return {"AAPL": _prices([100, 101, 102, 103, 104, 105, 106, 107])}

    monkeypatch.setattr(routes, "YFinanceMarketDataAdapter", FakeAdapter)

    response = client.post(
        "/api/v1/quant/validation",
        json={
            "strategy_name": "Validation",
            "strategy_type": "buy_and_hold",
            "symbols": ["AAPL"],
            "start_date": "2024-01-01",
            "end_date": "2024-02-01",
            "walk_forward_windows": 3,
            "monte_carlo_paths": 50,
            "bootstrap_samples": 100,
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["walk_forward"]
    assert data["monte_carlo"]["paths"] == 50
    assert data["bootstrap"]["samples"] == 100
    assert data["saved_run_id"]

    app.dependency_overrides.clear()
    store.reset()
