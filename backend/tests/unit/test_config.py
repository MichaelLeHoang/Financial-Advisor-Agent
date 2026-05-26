from src.core.config import Settings


def test_settings_parse_csv_values():
    settings = Settings(
        _env_file=None,
        gemini_api_key="test-key",
        cors_origins="http://localhost:3000,https://app.example.com",
        default_news_tickers="AAPL,NVDA,VOO",
    )

    assert settings.cors_origins == ["http://localhost:3000", "https://app.example.com"]
    assert settings.default_news_tickers == ["AAPL", "NVDA", "VOO"]
    assert settings.secret_value("gemini_api_key") == "test-key"


def test_news_collection_prefers_legacy_override():
    settings = Settings(
        _env_file=None,
        news_collection="legacy_news",
        qdrant_collection_news="cloud_news",
    )

    assert settings.resolved_news_collection == "legacy_news"


def test_news_collection_defaults_to_qdrant_collection():
    settings = Settings(_env_file=None, news_collection=None, qdrant_collection_news="cloud_news")

    assert settings.resolved_news_collection == "cloud_news"
