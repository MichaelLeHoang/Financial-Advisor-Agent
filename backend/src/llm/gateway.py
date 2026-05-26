from dataclasses import dataclass
from typing import Any, Mapping, Sequence

from src.llm.model_registry import LLMMode, LLMProviderName, ModelSpec
from src.llm.providers import (
    AnthropicProvider,
    ChatProvider,
    GoogleProvider,
    OpenAIProvider,
    OpenRouterProvider,
    ProviderUnavailable,
)
from src.llm.routing_policy import RoutingPolicy
from src.llm.usage_tracker import LLMUsageEvent, llm_usage_tracker
from src.saas.models import Plan


@dataclass(frozen=True)
class RoutedChatModel:
    chat_model: Any
    model: ModelSpec
    requested_mode: LLMMode
    resolved_mode: LLMMode
    fallback_used: bool
    attempts: tuple[str, ...]


class LLMGateway:
    """Creates chat models through routing policy and provider fallback."""

    def __init__(
        self,
        *,
        routing_policy: RoutingPolicy | None = None,
        providers: Mapping[LLMProviderName, ChatProvider] | None = None,
    ) -> None:
        self.routing_policy = routing_policy or RoutingPolicy()
        self.providers: dict[LLMProviderName, ChatProvider] = dict(
            providers
            or {
                "google": GoogleProvider(),
                "openai": OpenAIProvider(),
                "anthropic": AnthropicProvider(),
                "openrouter": OpenRouterProvider(),
            }
        )

    def get_chat_model(
        self,
        *,
        user_id: str,
        plan: Plan,
        task_type: str,
        messages: Sequence[Mapping[str, str]],
        preferred_mode: LLMMode | None = None,
    ) -> RoutedChatModel:
        del user_id, messages  # Future hooks for BYO keys and prompt-aware routing.
        decision = self.routing_policy.choose(
            plan=plan,
            task_type=task_type,
            preferred_mode=preferred_mode,
        )
        candidates = (decision.selected, *decision.fallbacks)
        attempts: list[str] = []
        errors: list[str] = []

        for index, model in enumerate(candidates):
            attempts.append(model.key)
            provider = self.providers.get(model.provider)
            if provider is None:
                errors.append(f"{model.provider}: provider is not registered")
                continue
            try:
                return RoutedChatModel(
                    chat_model=provider.create_chat_model(model),
                    model=model,
                    requested_mode=decision.requested_mode,
                    resolved_mode=decision.resolved_mode,
                    fallback_used=index > 0,
                    attempts=tuple(attempts),
                )
            except ProviderUnavailable as exc:
                errors.append(f"{model.key}: {exc}")

        raise ProviderUnavailable("No LLM provider is available. " + " | ".join(errors))

    def record_usage(
        self,
        *,
        user_id: str,
        task_type: str,
        routed_model: RoutedChatModel,
        input_text: str,
        output_text: str,
    ) -> LLMUsageEvent:
        return llm_usage_tracker.record(
            user_id=user_id,
            task_type=task_type,
            mode=routed_model.resolved_mode,
            model=routed_model.model,
            input_text=input_text,
            output_text=output_text,
        )


llm_gateway = LLMGateway()
