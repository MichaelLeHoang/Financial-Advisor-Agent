from typing import Any

from src.config import settings
from src.llm.model_registry import ModelSpec
from src.llm.providers.base import ChatProvider, ProviderUnavailable


class OpenRouterProvider(ChatProvider):
    provider_name = "openrouter"

    def create_chat_model(self, spec: ModelSpec) -> Any:
        api_key = settings.secret_value("openrouter_api_key")
        if not api_key:
            raise ProviderUnavailable("OPENROUTER_API_KEY is required for OpenRouter LLM routing")

        try:
            from langchain_openai import ChatOpenAI
        except ImportError as exc:
            raise ProviderUnavailable("langchain-openai is not installed") from exc

        return ChatOpenAI(
            model=spec.model,
            api_key=api_key,
            base_url="https://openrouter.ai/api/v1",
            temperature=0.3,
        )
