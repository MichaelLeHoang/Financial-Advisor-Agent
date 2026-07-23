from dataclasses import dataclass

from src.config import settings
from src.llm.model_registry import LLMMode, ModelSpec, default_model_for_mode, models_for_mode, plan_allows
from src.saas.models import Plan


TASK_MODE_DEFAULTS: dict[str, LLMMode] = {
    "chat": "balanced",
    "market_research": "balanced",
    "sentiment": "fast",
    "portfolio": "balanced",
    "deep_research": "deep_research",
    "coding_export": "coding_export",
    "memory_extraction": "fast",
    "conversation_summary": "fast",
}

PLAN_MODE_LIMITS: dict[Plan, set[LLMMode]] = {
    Plan.FREE: {"fast", "balanced"},
    Plan.PRO: {"fast", "balanced"},
    Plan.TRADER: {"fast", "balanced"},
    Plan.QUANT: {"fast", "balanced", "deep_research", "coding_export"},
    Plan.EXECUTION_ADDON: {"fast", "balanced", "deep_research", "coding_export"},
}


@dataclass(frozen=True)
class RouteDecision:
    selected: ModelSpec
    fallbacks: tuple[ModelSpec, ...]
    requested_mode: LLMMode
    resolved_mode: LLMMode


class RoutingPolicy:
    """Choose a model using plan, task type, preferred friendly mode, and configured provider."""

    def choose(
        self,
        *,
        plan: Plan,
        task_type: str,
        preferred_mode: LLMMode | None = None,
    ) -> RouteDecision:
        requested_mode = preferred_mode or TASK_MODE_DEFAULTS.get(task_type, settings.default_llm_mode)
        resolved_mode = self._allowed_mode(plan, requested_mode)
        candidates = [model for model in models_for_mode(resolved_mode) if plan_allows(plan, model.min_plan)]
        if not candidates:
            selected = default_model_for_mode("fast", plan)
            return RouteDecision(selected=selected, fallbacks=(), requested_mode=requested_mode, resolved_mode="fast")

        selected = self._prefer_configured_provider(candidates)
        fallbacks = tuple(model for model in candidates if model != selected)

        if selected.provider != "google":
            google_fallback = default_model_for_mode("balanced" if resolved_mode != "fast" else "fast", plan)
            if google_fallback not in fallbacks and google_fallback != selected and plan_allows(plan, google_fallback.min_plan):
                fallbacks = (*fallbacks, google_fallback)

        return RouteDecision(
            selected=selected,
            fallbacks=fallbacks,
            requested_mode=requested_mode,
            resolved_mode=resolved_mode,
        )

    def _allowed_mode(self, plan: Plan, mode: LLMMode) -> LLMMode:
        if mode in PLAN_MODE_LIMITS[plan]:
            return mode
        return "balanced" if "balanced" in PLAN_MODE_LIMITS[plan] else "fast"

    def _prefer_configured_provider(self, candidates: list[ModelSpec]) -> ModelSpec:
        for model in candidates:
            if model.provider == settings.default_llm_provider:
                return model
        return candidates[0]
