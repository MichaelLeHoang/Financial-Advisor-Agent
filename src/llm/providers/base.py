from abc import ABC, abstractmethod
from typing import Any

from src.llm.model_registry import ModelSpec


class ProviderUnavailable(RuntimeError):
    """Raised when a provider cannot create a chat model."""


class ChatProvider(ABC):
    provider_name: str

    @abstractmethod
    def create_chat_model(self, spec: ModelSpec) -> Any:
        """Return a LangChain-compatible chat model."""
