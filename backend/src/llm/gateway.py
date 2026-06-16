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
        
        valid_models: list[tuple[ModelSpec, Any]] = []

        for model in candidates:
            attempts.append(model.key)
            provider = self.providers.get(model.provider)
            if provider is None:
                errors.append(f"{model.provider}: provider is not registered")
                continue
            try:
                chat_model = provider.create_chat_model(model)
                valid_models.append((model, chat_model))
            except ProviderUnavailable as exc:
                errors.append(f"{model.key}: {exc}")

        if not valid_models:
            raise ProviderUnavailable("No LLM provider is available. " + " | ".join(errors))

        selected_model, primary_chat_model = valid_models[0]
        fallback_chat_models = [chat_model for _, chat_model in valid_models[1:]]
        if fallback_chat_models and hasattr(primary_chat_model, "with_fallbacks"):
            primary_chat_model = primary_chat_model.with_fallbacks(fallback_chat_models)
            print(f"  🤖 Model: {selected_model.model} (with {len(fallback_chat_models)} fallbacks)")
        else:
            print(f"  🤖 Model: {selected_model.model}")

        return RoutedChatModel(
            chat_model=primary_chat_model,
            model=selected_model,
            requested_mode=decision.requested_mode,
            resolved_mode=decision.resolved_mode,
            fallback_used=selected_model != decision.selected,
            attempts=tuple(attempts),
        )

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
