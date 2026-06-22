from __future__ import annotations

import json
import time
from dataclasses import dataclass
from typing import Any, Literal
from uuid import uuid4

from src.config import settings
from src.core.redis_client import RedisUnavailable, get_redis_client, normalize_redis_error


JobStatus = Literal["queued", "running", "succeeded", "failed", "cancelled"]
JobKind = Literal["single", "consensus"]


@dataclass(frozen=True)
class QueuedJob:
    job_id: str
    kind: JobKind
    payload: dict[str, Any]


class LLMJobQueue:
    """Redis-backed queue and status store for LLM jobs."""

    def __init__(self, client: Any | None = None) -> None:
        self.client = client or get_redis_client()

    def enqueue(self, payload: dict[str, Any], kind: JobKind) -> dict[str, Any]:
        job_id = str(uuid4())
        now = time.time()
        record = {
            "job_id": job_id,
            "kind": kind,
            "status": "queued",
            "payload": payload,
            "created_at": now,
            "updated_at": now,
        }
        self._write_job(job_id, record)
        self._call(self.client.lpush, self._queue_key(kind), job_id)
        return self.get(job_id) or record

    def get(self, job_id: str) -> dict[str, Any] | None:
        raw = self._call(self.client.get, self._job_key(job_id))
        if raw is None:
            return None
        return json.loads(raw)

    def update(self, job_id: str, **fields: Any) -> dict[str, Any] | None:
        record = self.get(job_id)
        if record is None:
            return None
        record.update(fields)
        record["updated_at"] = time.time()
        if record.get("status") in {"succeeded", "failed", "cancelled"}:
            record.setdefault("finished_at", time.time())
        self._write_job(job_id, record)
        return record

    def update_progress(
        self,
        job_id: str,
        *,
        mode: JobKind,
        active_tool: str | None = None,
        completed_tools: list[str] | None = None,
        active_label: str | None = None,
        message: str | None = None,
    ) -> dict[str, Any] | None:
        record = self.get(job_id)
        if record is None:
            return None
        previous = record.get("progress") or {}
        progress = {
            "mode": mode,
            "active_tool": active_tool,
            "completed_tools": completed_tools or [],
            "active_label": active_label,
            "message": message,
            "sequence": int(previous.get("sequence") or 0) + 1,
            "updated_at": time.time(),
        }
        record["progress"] = progress
        record["progress_events"] = [*(record.get("progress_events") or []), progress][-80:]
        record["updated_at"] = time.time()
        self._write_job(job_id, record)
        return record

    def queue_position(self, job_id: str, kind: JobKind) -> int | None:
        items = self._call(self.client.lrange, self._queue_key(kind), 0, -1)
        try:
            # lpush + brpop means the next job is at the right end.
            return list(reversed(items)).index(job_id) + 1
        except ValueError:
            return None

    def dequeue(self, timeout_seconds: int | None = None) -> QueuedJob | None:
        timeout = settings.llm_worker_poll_timeout_seconds if timeout_seconds is None else timeout_seconds
        result = self._call(self.client.brpop, [self._queue_key("consensus"), self._queue_key("single")], timeout=timeout)
        if result is None:
            return None
        _, job_id = result
        record = self.get(job_id)
        if record is None or record.get("status") == "cancelled":
            return None
        return QueuedJob(job_id=job_id, kind=record["kind"], payload=record["payload"])

    def requeue(self, job: QueuedJob) -> None:
        self._call(self.client.rpush, self._queue_key(job.kind), job.job_id)

    def try_acquire_slots(self, job: QueuedJob) -> bool:
        user_id = str(job.payload.get("user_id", "guest"))
        global_limit = settings.llm_consensus_concurrency if job.kind == "consensus" else settings.llm_single_concurrency
        global_key = f"llm:locks:{job.kind}"
        user_key = f"llm:locks:user:{user_id}"

        if not self._try_acquire(global_key, global_limit):
            return False
        if not self._try_acquire(user_key, settings.llm_per_user_concurrency):
            self._release(global_key)
            return False
        return True

    def release_slots(self, job: QueuedJob) -> None:
        user_id = str(job.payload.get("user_id", "guest"))
        self._release(f"llm:locks:{job.kind}")
        self._release(f"llm:locks:user:{user_id}")

    def _try_acquire(self, key: str, limit: int) -> bool:
        script = """
        local current = tonumber(redis.call('get', KEYS[1]) or '0')
        local limit = tonumber(ARGV[1])
        if current >= limit then
            return 0
        end
        redis.call('incr', KEYS[1])
        redis.call('expire', KEYS[1], ARGV[2])
        return 1
        """
        ttl = max(60, settings.llm_job_ttl_seconds)
        return bool(self._call(self.client.eval, script, 1, key, limit, ttl))

    def _release(self, key: str) -> None:
        script = """
        local current = tonumber(redis.call('get', KEYS[1]) or '0')
        if current <= 1 then
            redis.call('del', KEYS[1])
            return 0
        end
        return redis.call('decr', KEYS[1])
        """
        self._call(self.client.eval, script, 1, key)

    def _write_job(self, job_id: str, record: dict[str, Any]) -> None:
        self._call(self.client.setex, self._job_key(job_id), settings.llm_job_ttl_seconds, json.dumps(record, default=str))

    @staticmethod
    def _call(func: Any, *args: Any, **kwargs: Any) -> Any:
        try:
            return func(*args, **kwargs)
        except Exception as exc:
            raise normalize_redis_error(exc) from exc

    @staticmethod
    def _job_key(job_id: str) -> str:
        return f"llm:job:{job_id}"

    @staticmethod
    def _queue_key(kind: JobKind) -> str:
        return f"llm:queue:{kind}"


def get_llm_job_queue() -> LLMJobQueue:
    try:
        return LLMJobQueue()
    except RedisUnavailable:
        raise
