from typing import Any

from src.config import settings
from src.llm.model_registry import ModelSpec
from src.llm.providers.base import ChatProvider, ProviderUnavailable


class GoogleProvider(ChatProvider):
    provider_name = "google"

    def create_chat_model(self, spec: ModelSpec) -> Any:
        api_key = settings.secret_value("gemini_api_key")
        if not api_key:
            raise ProviderUnavailable("GEMINI_API_KEY is required for Google LLM routing")

        try:
            from langchain_google_genai import ChatGoogleGenerativeAI
        except ImportError as exc:
            raise ProviderUnavailable("langchain-google-genai is not installed") from exc

        return ChatGoogleGenerativeAI(
            model=spec.model,
            google_api_key=api_key,
            temperature=0.3,
        )
