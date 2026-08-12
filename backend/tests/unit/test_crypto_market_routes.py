from datetime import UTC, datetime

from fastapi.testclient import TestClient

from src.api import app as api_app
from src.api import crypto_market as crypto_routes
from src.models.crypto_market import CryptoOverviewResponse


def test_crypto_overview_route_returns_normalized_identity(monkeypatch):
    monkeypatch.setattr(
        crypto_routes.crypto_market_service,
        "overview",
        lambda base, quote: CryptoOverviewResponse(
            base_asset=base.upper(),
            quote_currency=quote.upper(),
            provider_symbol=f"{base.upper()}-{quote.upper()}",
            name="Bitcoin",
            venue="Kraken",
            price=100_000,
            updated_at=datetime.now(UTC).isoformat(),
        ),
    )

    response = TestClient(api_app.app).get("/api/v1/crypto/assets/BTC/overview?quote=CAD")

    assert response.status_code == 200
    assert response.json()["asset_type"] == "crypto"
    assert response.json()["provider_symbol"] == "BTC-CAD"


def test_crypto_series_rejects_invalid_range(monkeypatch):
    response = TestClient(api_app.app).get("/api/v1/crypto/assets/BTC/series?range=10Y")

    assert response.status_code == 400
    assert "Unsupported range" in response.json()["detail"]
