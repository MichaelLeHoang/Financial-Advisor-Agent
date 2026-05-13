from dataclasses import dataclass

import pytest

from src.llm.gateway import LLMGateway
from src.llm.model_registry import ModelSpec
from src.llm.providers.base import ChatProvider, ProviderUnavailable
from src.llm.routing_policy import RoutingPolicy
from src.llm.usage_tracker import llm_usage_tracker
from src.saas.models import Plan


@dataclass
class FakeChatModel:
    provider: str
    model: str


class FakeProvider(ChatProvider):
    def __init__(self, provider_name: str, *, fail: bool = False) -> None:
        self.provider_name = provider_name
        self.fail = fail

    def create_chat_model(self, spec: ModelSpec):
        if self.fail:
            raise ProviderUnavailable(f"{self.provider_name} unavailable")
        return FakeChatModel(provider=spec.provider, model=spec.model)


def test_free_plan_deep_research_downgrades_to_friendly_balanced_mode():
    decision = RoutingPolicy().choose(
        plan=Plan.FREE,
        task_type="deep_research",
        preferred_mode="deep_research",
    )

    assert decision.requested_mode == "deep_research"
    assert decision.resolved_mode == "balanced"
    assert decision.selected.min_plan == Plan.FREE


def test_gateway_falls_back_when_selected_provider_fails(monkeypatch):
    import src.llm.routing_policy as routing_policy

    monkeypatch.setattr(routing_policy.settings, "default_llm_provider", "openai")
    gateway = LLMGateway(
        providers={
            "google": FakeProvider("google"),
            "openai": FakeProvider("openai", fail=True),
            "anthropic": FakeProvider("anthropic"),
            "openrouter": FakeProvider("openrouter"),
        }
    )

    routed = gateway.get_chat_model(
        user_id="user-1",
        plan=Plan.PRO,
        task_type="chat",
        messages=[{"role": "user", "content": "hello"}],
        preferred_mode="balanced",
    )

    assert routed.fallback_used is True
    assert routed.model.provider == "google"
    assert routed.chat_model.provider == "google"
    assert routed.attempts[0].startswith("openai.")


def test_gateway_records_estimated_usage():
    llm_usage_tracker.reset()
    gateway = LLMGateway(
        providers={
            "google": FakeProvider("google"),
            "openai": FakeProvider("openai"),
            "anthropic": FakeProvider("anthropic"),
            "openrouter": FakeProvider("openrouter"),
        }
    )
    routed = gateway.get_chat_model(
        user_id="user-usage",
        plan=Plan.FREE,
        task_type="chat",
        messages=[{"role": "user", "content": "Should I buy AAPL?"}],
        preferred_mode="fast",
    )

    event = gateway.record_usage(
        user_id="user-usage",
        task_type="chat",
        routed_model=routed,
        input_text="Should I buy AAPL?",
        output_text="This is a test answer.",
    )
    totals = llm_usage_tracker.totals_for_user("user-usage")

    assert event.input_tokens > 0
    assert event.output_tokens > 0
    assert totals["requests"] == 1
    assert totals["estimated_cost_usd"] >= 0
