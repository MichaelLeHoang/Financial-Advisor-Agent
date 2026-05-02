from functools import lru_cache
from typing import Literal

from pydantic import Field, SecretStr, computed_field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


AppEnvironment = Literal["development", "test", "staging", "production"]
EmbeddingProvider = Literal["local", "gemini"]
LLMProvider = Literal["google", "openai", "anthropic", "openrouter"]
LLMMode = Literal["fast", "balanced", "deep_research", "coding_export"]


class Settings(BaseSettings):
    """Typed application settings loaded from environment variables."""

    app_name: str = "Financial Advisor API"
    app_env: AppEnvironment = "development"
    app_version: str = "0.1.0"
    frontend_url: str = "http://localhost:3000"
    cors_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:3000", "http://127.0.0.1:3000"]
    )

    # Supabase/Postgres
    supabase_url: str | None = None
    supabase_service_role_key: SecretStr | None = None
    supabase_jwt_secret: SecretStr | None = None
    database_url: SecretStr | None = None

    # Billing
    stripe_secret_key: SecretStr | None = None
    stripe_webhook_secret: SecretStr | None = None
    stripe_price_pro: str | None = None
    stripe_price_trader: str | None = None
    stripe_price_quant: str | None = None
    stripe_price_execution_addon: str | None = None

    # LLM providers
    gemini_api_key: SecretStr | None = None
    openai_api_key: SecretStr | None = None
    anthropic_api_key: SecretStr | None = None
    openrouter_api_key: SecretStr | None = None
    default_llm_provider: LLMProvider = "google"
    default_llm_mode: LLMMode = "fast"

    # Market data
    alpha_vantage_api_key: SecretStr | None = None
    finnhub_api_key: SecretStr | None = None

    # Qdrant vector DB
    qdrant_url: str = "http://localhost:6333"
    qdrant_api_key: SecretStr | None = None
    qdrant_collection_news: str = "financial_news"
    qdrant_collection_user_reports: str = "user_reports"

    # Embedding
    embedding_provider: EmbeddingProvider = "local"
    local_embedding_model: str = "all-MiniLM-L6-v2"
    embedding_dimension: int = 384

    # RAG
    chunk_size: int = 512
    chunk_overlap: int = 50
    retrieval_top_k: int = 5

    # Legacy collection names kept for existing modules.
    news_collection: str | None = None
    stock_collection: str = "stock_data"

    # Jobs
    inngest_app_id: str = "financial-advisor-agent"
    inngest_is_production: bool = False
    news_ingestion_cron: str = "0 * * * *"
    default_news_tickers: list[str] = Field(
        default_factory=lambda: ["AAPL", "MSFT", "GOOGL", "NVDA", "TSLA", "AMZN", "META", "VOO", "QQQ", "VFV"]
    )

    # Notifications and observability
    resend_api_key: SecretStr | None = None
    telegram_bot_token: SecretStr | None = None
    notification_secret_key: SecretStr | None = None
    sentry_dsn: SecretStr | None = None
    posthog_key: SecretStr | None = None
    upstash_redis_rest_url: str | None = None
    upstash_redis_rest_token: SecretStr | None = None

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @field_validator("cors_origins", "default_news_tickers", mode="before")
    @classmethod
    def parse_csv_list(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @computed_field
    @property
    def resolved_news_collection(self) -> str:
        return self.news_collection or self.qdrant_collection_news

    def secret_value(self, name: str) -> str | None:
        value = getattr(self, name)
        if isinstance(value, SecretStr):
            return value.get_secret_value()
        return value

    def is_configured(self, name: str) -> bool:
        value = self.secret_value(name)
        return bool(value)


@lru_cache
def get_settings() -> Settings:
    """Return the cached settings instance."""
    return Settings()


settings = get_settings()
