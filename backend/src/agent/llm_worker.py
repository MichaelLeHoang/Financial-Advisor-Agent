from __future__ import annotations

import time
import traceback
from typing import Any

from src.agent.agent import FinancialAdvisorAgent
from src.agent.history import append_message, load_history
from src.agent.llm_queue import LLMJobQueue, QueuedJob
from src.config import settings
from src.core.cache import cached_value
from src.core.redis_client import RedisUnavailable
from src.saas.models import Plan


def execute_llm_job(job: QueuedJob) -> dict[str, Any]:
    payload = job.payload
    user_id = str(payload["user_id"])
    plan = Plan(payload.get("plan", Plan.FREE.value))
    session_id = str(payload["session_id"])
    message = str(payload["message"])
    mode = str(payload.get("mode", "single"))
    remember = bool(payload.get("remember", True))
    is_guest = bool(payload.get("is_guest")) or user_id == "00000000-0000-0000-0000-000000000001"
    preferred_mode = payload.get("preferred_mode")

    agent = FinancialAdvisorAgent(
        user_id=user_id,
        plan=plan,
        task_type="chat",
        preferred_mode=preferred_mode if preferred_mode in {"fast", "balanced", "deep_research", "coding_export"} else None,
    )
    history = [] if is_guest else load_history(session_id, user_id)
    agent._history = [{"role": item["role"], "content": item["content"]} for item in history]

    def compute_response() -> str:
        return agent.chat(message, remember=False, mode=mode)

    if history:
        response = compute_response()
    else:
        response = cached_value(
            "ai_analysis",
            {
                "user_id": user_id,
                "plan": plan.value,
                "mode": mode,
                "preferred_mode": preferred_mode,
                "message": message,
            },
            settings.llm_cache_ttl_seconds,
            compute_response,
        )
    if remember and not is_guest:
        append_message(session_id, "user", message, user_id)
        append_message(session_id, "assistant", response, user_id)

    return {"response": response, "session_id": session_id, "mode": mode}


class LLMWorker:
    def __init__(self, queue: LLMJobQueue | None = None, *, idle_sleep_seconds: float = 1.0) -> None:
        self.queue = queue or LLMJobQueue()
        self.idle_sleep_seconds = idle_sleep_seconds

    def run_forever(self) -> None:
        while True:
            self.process_once()

    def process_once(self) -> bool:
        slot_acquired = False
        try:
            job = self.queue.dequeue()
            if job is None:
                return False

            if not self.queue.try_acquire_slots(job):
                self.queue.requeue(job)
                time.sleep(self.idle_sleep_seconds)
                return False
            slot_acquired = True

            self.queue.update(job.job_id, status="running", started_at=time.time())
            try:
                result = execute_llm_job(job)
                self.queue.update(job.job_id, status="succeeded", result=result)
                return True
            except Exception as exc:
                self.queue.update(
                    job.job_id,
                    status="failed",
                    error={
                        "type": type(exc).__name__,
                        "message": str(exc),
                        "trace": traceback.format_exc()[-2000:],
                    },
                )
                return False
        except RedisUnavailable as exc:
            print(f"Redis unavailable for LLM worker; retrying: {exc}")
            time.sleep(self.idle_sleep_seconds)
            return False
        finally:
            if slot_acquired:
                try:
                    self.queue.release_slots(job)
                except RedisUnavailable as exc:
                    print(f"Redis unavailable while releasing LLM worker slots: {exc}")
