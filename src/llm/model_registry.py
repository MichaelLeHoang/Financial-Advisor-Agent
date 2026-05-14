from dataclasses import dataclass
from typing import Literal

from src.saas.models import Plan


LLMProviderName = Literal["google", "openai", "anthropic", "openrouter"]
LLMMode = Literal["fast", "balanced", "deep_research", "coding_export"]


PLAN_RANK: dict[Plan, int] = {
    Plan.FREE: 0,
    Plan.PRO: 1,
    Plan.TRADER: 2,
    Plan.QUANT: 3,
    Plan.EXECUTION_ADDON: 4,
}


@dataclass(frozen=True)
class ModelSpec:
    """A routable model plus rough cost metadata for estimates."""

    key: str
    provider: LLMProviderName
    model: str
    mode: LLMMode
    min_plan: Plan
    input_cost_per_million: float
    output_cost_per_million: float


MODEL_REGISTRY: tuple[ModelSpec, ...] = (
    ModelSpec(
        key="google.gemini_flash.fast",
        provider="google",
        model="gemini-2.0-flash",
        mode="fast",
        min_plan=Plan.FREE,
        input_cost_per_million=0.10,
        output_cost_per_million=0.40,
    ),
    ModelSpec(
        key="google.gemini_flash.balanced",
        provider="google",
        model="gemini-2.0-flash",
        mode="balanced",
        min_plan=Plan.FREE,
        input_cost_per_million=0.10,
        output_cost_per_million=0.40,
    ),
    ModelSpec(
        key="openai.gpt_4o_mini.balanced",
        provider="openai",
        model="gpt-4o-mini",
        mode="balanced",
        min_plan=Plan.PRO,
        input_cost_per_million=0.15,
        output_cost_per_million=0.60,
    ),
    ModelSpec(
        key="openai.gpt_4o.deep_research",
        provider="openai",
        model="gpt-4o",
        mode="deep_research",
        min_plan=Plan.QUANT,
        input_cost_per_million=2.50,
        output_cost_per_million=10.00,
    ),
    ModelSpec(
        key="anthropic.claude_sonnet.deep_research",
        provider="anthropic",
        model="claude-sonnet-4-20250514",
        mode="deep_research",
        min_plan=Plan.QUANT,
        input_cost_per_million=3.00,
        output_cost_per_million=15.00,
    ),
    ModelSpec(
        key="openrouter.gpt_4o_mini.coding_export",
        provider="openrouter",
        model="openai/gpt-4o-mini",
        mode="coding_export",
        min_plan=Plan.QUANT,
        input_cost_per_million=0.15,
        output_cost_per_million=0.60,
    ),
)


def plan_allows(plan: Plan, min_plan: Plan) -> bool:
    return PLAN_RANK[plan] >= PLAN_RANK[min_plan]


def models_for_mode(mode: LLMMode) -> list[ModelSpec]:
    return [model for model in MODEL_REGISTRY if model.mode == mode]


def default_model_for_mode(mode: LLMMode, plan: Plan) -> ModelSpec:
    for model in models_for_mode(mode):
        if plan_allows(plan, model.min_plan):
            return model
    return MODEL_REGISTRY[0]
