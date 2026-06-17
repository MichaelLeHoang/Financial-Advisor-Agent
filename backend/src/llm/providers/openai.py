from typing import Any

from src.config import settings
from src.llm.model_registry import ModelSpec
from src.llm.providers.base import ChatProvider, ProviderUnavailable


class OpenAIProvider(ChatProvider):
    provider_name = "openai"

    def create_chat_model(self, spec: ModelSpec) -> Any:
        api_key = settings.secret_value("openai_api_key")
        if not api_key:
            raise ProviderUnavailable("OPENAI_API_KEY is required for OpenAI LLM routing")

        try:
            from langchain_openai import ChatOpenAI
        except ImportError as exc:
            raise ProviderUnavailable("langchain-openai is not installed") from exc

        return ChatOpenAI(
            model=spec.model,
            api_key=api_key,
            temperature=0.3,
            max_retries=settings.llm_retry_attempts,
        )
