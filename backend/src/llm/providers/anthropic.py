from typing import Any

from src.config import settings
from src.llm.model_registry import ModelSpec
from src.llm.providers.base import ChatProvider, ProviderUnavailable


class AnthropicProvider(ChatProvider):
    provider_name = "anthropic"

    def create_chat_model(self, spec: ModelSpec) -> Any:
        api_key = settings.secret_value("anthropic_api_key")
        if not api_key:
            raise ProviderUnavailable("ANTHROPIC_API_KEY is required for Anthropic LLM routing")

        try:
            from langchain_anthropic import ChatAnthropic
        except ImportError as exc:
            raise ProviderUnavailable("langchain-anthropic is not installed") from exc

        return ChatAnthropic(model=spec.model, api_key=api_key, temperature=0.3)
