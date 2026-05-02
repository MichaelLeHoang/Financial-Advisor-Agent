from uuid import uuid4
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from src.auth.supabase import get_current_or_guest_user
from src.saas.entitlements import FeatureKey, feature_allowed
from src.saas.models import AuthenticatedUser, Plan
from src.saas.usage import usage_tracker


def _override_user(plan: Plan):
    async def dependency():
        return AuthenticatedUser(id=uuid4(), email="plan@example.com", plan=plan, is_guest=True)

    return dependency


def test_plan_feature_matrix():
    assert feature_allowed(Plan.FREE, FeatureKey.AI_RESEARCH)
    assert not feature_allowed(Plan.FREE, FeatureKey.CLASSICAL_OPTIMIZATION)
    assert feature_allowed(Plan.PRO, FeatureKey.CLASSICAL_OPTIMIZATION)
    assert not feature_allowed(Plan.PRO, FeatureKey.ML_PREDICTION)
    assert feature_allowed(Plan.TRADER, FeatureKey.ML_PREDICTION)
    assert not feature_allowed(Plan.TRADER, FeatureKey.QUANTUM_OPTIMIZATION)
    assert feature_allowed(Plan.QUANT, FeatureKey.QUANTUM_OPTIMIZATION)


def test_usage_limit_returns_upgrade_required():
    user = AuthenticatedUser(id=uuid4(), plan=Plan.FREE, is_guest=True)
    usage_tracker.reset()

    for _ in range(10):
        usage_tracker.increment(user, FeatureKey.AI_RESEARCH, "ai_messages_per_day")

    with pytest.raises(Exception) as exc:
        usage_tracker.increment(user, FeatureKey.AI_RESEARCH, "ai_messages_per_day")

    assert exc.value.status_code == 403
    assert exc.value.detail["error"] == "upgrade_required"
    usage_tracker.reset()


def test_free_user_cannot_use_classical_optimization():
    from src.api.app import app

    client = TestClient(app)
    app.dependency_overrides[get_current_or_guest_user] = _override_user(Plan.FREE)

    response = client.post(
        "/api/v1/optimize",
        json={"tickers": ["AAPL", "MSFT"], "method": "classical", "risk_tolerance": 1.0},
    )

    assert response.status_code == 403
    assert response.json()["detail"]["error"] == "upgrade_required"
    assert response.json()["detail"]["required_plan"] == "pro"
    app.dependency_overrides.clear()


def test_pro_user_can_use_classical_optimization():
    from src.api.app import app

    client = TestClient(app)
    app.dependency_overrides[get_current_or_guest_user] = _override_user(Plan.PRO)

    with patch("src.api.app.optimize_portfolio", return_value={"method": "classical_markowitz", "weights": {"AAPL": 1.0}}):
        response = client.post(
            "/api/v1/optimize",
            json={"tickers": ["AAPL", "MSFT"], "method": "classical", "risk_tolerance": 1.0},
        )

    assert response.status_code == 200
    assert response.json()["method"] == "classical_markowitz"
    app.dependency_overrides.clear()


def test_quantum_optimization_requires_quant_plan():
    from src.api.app import app

    client = TestClient(app)
    app.dependency_overrides[get_current_or_guest_user] = _override_user(Plan.TRADER)

    response = client.post(
        "/api/v1/optimize",
        json={"tickers": ["AAPL", "MSFT"], "method": "quantum", "target_assets": 1},
    )

    assert response.status_code == 403
    assert response.json()["detail"]["required_plan"] == "quant"
    app.dependency_overrides.clear()
