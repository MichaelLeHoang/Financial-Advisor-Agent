from dataclasses import dataclass
from threading import Lock
from time import time

from src.llm.model_registry import ModelSpec


@dataclass(frozen=True)
class LLMUsageEvent:
    user_id: str
    task_type: str
    mode: str
    provider: str
    model: str
    input_tokens: int
    output_tokens: int
    estimated_cost_usd: float
    created_at: float


class LLMUsageTracker:
    """In-memory usage tracker. Replace with persistent usage_events storage later."""

    def __init__(self) -> None:
        self._events: list[LLMUsageEvent] = []
        self._lock = Lock()

    def record(
        self,
        *,
        user_id: str,
        task_type: str,
        mode: str,
        model: ModelSpec,
        input_text: str,
        output_text: str,
    ) -> LLMUsageEvent:
        input_tokens = estimate_tokens(input_text)
        output_tokens = estimate_tokens(output_text)
        cost = estimate_cost(model, input_tokens, output_tokens)
        event = LLMUsageEvent(
            user_id=user_id,
            task_type=task_type,
            mode=mode,
            provider=model.provider,
            model=model.model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            estimated_cost_usd=cost,
            created_at=time(),
        )
        with self._lock:
            self._events.append(event)
        return event

    def totals_for_user(self, user_id: str) -> dict[str, float | int]:
        with self._lock:
            events = [event for event in self._events if event.user_id == user_id]
        return {
            "requests": len(events),
            "input_tokens": sum(event.input_tokens for event in events),
            "output_tokens": sum(event.output_tokens for event in events),
            "estimated_cost_usd": round(sum(event.estimated_cost_usd for event in events), 8),
        }

    def reset(self) -> None:
        with self._lock:
            self._events.clear()


def estimate_tokens(text: str) -> int:
    if not text:
        return 0
    return max(1, (len(text) + 3) // 4)


def estimate_cost(model: ModelSpec, input_tokens: int, output_tokens: int) -> float:
    input_cost = input_tokens / 1_000_000 * model.input_cost_per_million
    output_cost = output_tokens / 1_000_000 * model.output_cost_per_million
    return round(input_cost + output_cost, 8)


llm_usage_tracker = LLMUsageTracker()
