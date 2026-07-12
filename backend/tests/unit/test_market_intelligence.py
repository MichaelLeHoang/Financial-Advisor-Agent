from datetime import datetime, timezone

from fastapi.testclient import TestClient

from src.api.news_routes import NewsArticle, NewsResponse
from src.market_intelligence.service import build_market_intelligence_from_news


def _sample_news() -> NewsResponse:
    return NewsResponse(
        articles=[
            NewsArticle(
                id="nvda-1",
                title="Nvidia shares jump as AI chip demand beats expectations",
                summary="Demand for AI accelerators remains strong and analysts raised near-term revenue expectations.",
                publisher="Reuters",
                published_at=datetime.now(timezone.utc).isoformat(),
                url="https://example.com/nvda",
                tickers=["NVDA"],
                category="ai_semiconductors",
            ),
            NewsArticle(
                id="nvda-2",
                title="Chip supply risk remains after export restriction warning",
                summary="New export controls could delay some shipments and increase near-term volatility.",
                publisher="MarketWatch",
                published_at=datetime.now(timezone.utc).isoformat(),
                url="https://example.com/nvda-risk",
                tickers=["NVDA", "AMD"],
                category="ai_semiconductors",
            ),
        ],
        categories_fetched=["ai_semiconductors"],
        total=2,
        sources_attempted=3,
        sources_succeeded=2,
        sources_failed=1,
    )


def test_market_intelligence_builds_briefing_picks_and_reports():
    response = build_market_intelligence_from_news(_sample_news())

    assert response.categories_fetched == ["ai_semiconductors"]
    assert len(response.briefing) == 2
    assert response.briefing[0].sources
    assert response.briefing[0].confidence > 0
    assert response.briefing[0].impact_score > 0
    assert response.picks
    assert response.picks[0].ticker == "NVDA"
    assert response.picks[0].label in {
        "Watchlist candidate",
        "Research opportunity",
        "Momentum setup",
        "Risk elevated",
        "Needs confirmation",
    }
    assert response.picks[0].score_breakdown is not None
    assert response.picks[0].key_evidence
    assert all("Single-source" not in flag for flag in response.picks[0].risk_flags)
    assert response.reports
    assert "what_happened" in response.reports[0].sections
    assert "research_priority" in response.reports[0].signal_summary
    assert response.reports[0].disclaimer


def test_market_intelligence_route_uses_service(monkeypatch):
    from src.api import app as api_app
    from src.api.routes import intelligence

    async def fake_build(categories, limit=30):
        assert categories == ["market"]
        assert limit == 5
        return build_market_intelligence_from_news(_sample_news())

    monkeypatch.setattr(intelligence, "build_market_intelligence", fake_build)

    response = TestClient(api_app.app).get("/api/v1/market-intelligence?categories=market&limit=5")

    assert response.status_code == 200
    data = response.json()
    assert data["briefing"]
    assert data["picks"]
    assert data["reports"]
