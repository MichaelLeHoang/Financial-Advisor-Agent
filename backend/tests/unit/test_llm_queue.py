class FakeRedis:
    def __init__(self):
        self.values = {}
        self.lists = {}

    def setex(self, key, ttl, value):
        self.values[key] = value

    def get(self, key):
        return self.values.get(key)

    def lpush(self, key, value):
        self.lists.setdefault(key, []).insert(0, value)

    def rpush(self, key, value):
        self.lists.setdefault(key, []).append(value)

    def brpop(self, keys, timeout=0):
        for key in keys:
            items = self.lists.get(key, [])
            if items:
                return key, items.pop()
        return None

    def lrange(self, key, start, end):
        items = self.lists.get(key, [])
        if end == -1:
            end = len(items) - 1
        return items[start : end + 1]

    def eval(self, script, numkeys, key, *args):
        if "current >= limit" in script:
            limit = int(args[0])
            current = int(self.values.get(key, "0"))
            if current >= limit:
                return 0
            self.values[key] = str(current + 1)
            return 1
        current = int(self.values.get(key, "0"))
        if current <= 1:
            self.values.pop(key, None)
            return 0
        self.values[key] = str(current - 1)
        return current - 1


def test_llm_queue_enqueues_and_reports_position():
    from src.agent.llm_queue import LLMJobQueue

    queue = LLMJobQueue(client=FakeRedis())
    first = queue.enqueue({"user_id": "u1"}, "single")
    second = queue.enqueue({"user_id": "u1"}, "single")

    assert first["status"] == "queued"
    assert queue.queue_position(first["job_id"], "single") == 1
    assert queue.queue_position(second["job_id"], "single") == 2
    assert [event["type"] for event in first["activity_events"]] == [
        "analysis.planned",
        "analysis.queued",
    ]
    assert first["activity_events"][0]["planned_steps"][0]["step_id"] == "single_scope"


def test_llm_queue_appends_resumable_activity_in_sequence():
    from src.agent.llm_queue import LLMJobQueue

    queue = LLMJobQueue(client=FakeRedis())
    record = queue.enqueue({"user_id": "u1"}, "single")

    appended = queue.append_activity(
        record["job_id"],
        {"type": "analysis.started", "label": "Analysis started", "status": "active"},
    )

    updated = queue.get(record["job_id"])
    assert appended["sequence"] == 3
    assert [event["sequence"] for event in updated["activity_events"]] == [1, 2, 3]
    assert updated["activity_events"][-1]["run_id"] == record["job_id"]


def test_llm_queue_persists_progress_updates():
    from src.agent.llm_queue import LLMJobQueue

    queue = LLMJobQueue(client=FakeRedis())
    record = queue.enqueue({"user_id": "u1"}, "consensus")

    queue.update_progress(
        record["job_id"],
        mode="consensus",
        active_tool="quant_researcher",
        completed_tools=[],
        active_label="Quant Researcher",
        message="Quant Researcher is working...",
    )
    queue.update_progress(
        record["job_id"],
        mode="consensus",
        active_tool="quant_analyst",
        completed_tools=["quant_researcher"],
        active_label="Quant Analyst",
        message="Quant Analyst is working...",
    )

    updated = queue.get(record["job_id"])

    assert updated["progress"]["mode"] == "consensus"
    assert updated["progress"]["active_tool"] == "quant_analyst"
    assert updated["progress"]["completed_tools"] == ["quant_researcher"]
    assert updated["progress"]["sequence"] == 2
    assert [event["active_tool"] for event in updated["progress_events"]] == [
        "quant_researcher",
        "quant_analyst",
    ]


def test_llm_worker_processes_successful_job(monkeypatch):
    from src.agent import llm_worker as worker_module
    from src.agent.llm_queue import LLMJobQueue

    queue = LLMJobQueue(client=FakeRedis())
    record = queue.enqueue(
        {
            "user_id": "u1",
            "plan": "free",
            "session_id": "s1",
            "message": "hello",
            "remember": False,
            "mode": "single",
            "preferred_mode": None,
        },
        "single",
    )
    monkeypatch.setattr(
        worker_module,
        "execute_llm_job",
        lambda job, progress_callback=None: {
            "response": "ok",
            "session_id": "s1",
            "mode": "single",
        },
    )

    processed = worker_module.LLMWorker(queue=queue).process_once()
    updated = queue.get(record["job_id"])

    assert processed is True
    assert updated["status"] == "succeeded"
    assert updated["result"]["response"] == "ok"
    assert updated["progress"]["active_tool"] is None
    assert updated["progress"]["completed_tools"] == []
    assert updated["progress"]["message"] == "Agent response completed."
    assert updated["activity_events"][-1]["type"] == "analysis.completed"


def test_llm_worker_records_callback_progress(monkeypatch):
    from src.agent import llm_worker as worker_module
    from src.agent.llm_queue import LLMJobQueue

    queue = LLMJobQueue(client=FakeRedis())
    record = queue.enqueue(
        {
            "user_id": "u1",
            "plan": "free",
            "session_id": "s1",
            "message": "hello",
            "remember": False,
            "mode": "consensus",
            "preferred_mode": None,
        },
        "consensus",
    )
    seen_progress = []

    def fake_execute(job, progress_callback=None):
        progress_callback(
            {
                "active_tool": "quant_researcher",
                "completed_tools": [],
                "active_label": "Quant Researcher",
                "message": "Quant Researcher is working...",
            }
        )
        seen_progress.append(queue.get(job.job_id)["progress"])
        progress_callback(
            {
                "active_tool": "quant_analyst",
                "completed_tools": ["quant_researcher"],
                "active_label": "Quant Analyst",
                "message": "Quant Analyst is working...",
            }
        )
        seen_progress.append(queue.get(job.job_id)["progress"])
        return {"response": "ok", "session_id": "s1", "mode": "consensus"}

    monkeypatch.setattr(worker_module, "execute_llm_job", fake_execute)

    processed = worker_module.LLMWorker(queue=queue).process_once()
    updated = queue.get(record["job_id"])

    assert processed is True
    assert seen_progress[0]["active_tool"] == "quant_researcher"
    assert seen_progress[1]["active_tool"] == "quant_analyst"
    assert seen_progress[1]["completed_tools"] == ["quant_researcher"]
    assert updated["progress"]["completed_tools"] == ["quant_researcher"]
    activity_types = [event["type"] for event in updated["activity_events"]]
    assert "step.completed" in activity_types
    assert updated["activity_events"][-1]["type"] == "analysis.completed"


def test_llm_worker_processes_background_memory_job_without_chat_progress(monkeypatch):
    from src.agent import llm_worker as worker_module
    from src.agent.llm_queue import LLMJobQueue

    queue = LLMJobQueue(client=FakeRedis())
    record = queue.enqueue(
        {
            "user_id": "u1",
            "plan": "free",
            "session_id": "s1",
            "source_message_id": "7",
            "message": "I prefer concise answers.",
        },
        "memory",
    )
    monkeypatch.setattr(
        worker_module,
        "execute_memory_job",
        lambda job: {"candidates_created": 1, "summary_updated": False},
    )

    processed = worker_module.LLMWorker(queue=queue).process_once()
    updated = queue.get(record["job_id"])

    assert processed is True
    assert updated["status"] == "succeeded"
    assert updated["result"]["candidates_created"] == 1
    assert "progress" not in updated


def test_llm_worker_requeues_when_concurrency_slots_unavailable(monkeypatch):
    from src.agent.llm_worker import LLMWorker
    from src.agent.llm_queue import LLMJobQueue

    queue = LLMJobQueue(client=FakeRedis())
    record = queue.enqueue({"user_id": "u1"}, "consensus")
    monkeypatch.setattr(queue, "try_acquire_slots", lambda job: False)

    processed = LLMWorker(queue=queue, idle_sleep_seconds=0).process_once()

    assert processed is False
    assert queue.get(record["job_id"])["status"] == "queued"
    assert queue.queue_position(record["job_id"], "consensus") == 1


def test_llm_queue_wraps_redis_timeouts():
    from src.agent.llm_queue import LLMJobQueue
    from src.core.redis_client import RedisUnavailable

    class TimeoutRedis(FakeRedis):
        def get(self, key):
            raise TimeoutError("Timeout reading from socket")

    queue = LLMJobQueue(client=TimeoutRedis())

    try:
        queue.get("job-1")
    except RedisUnavailable as exc:
        assert "Timeout reading from socket" in str(exc)
    else:
        raise AssertionError("Redis timeout should be normalized")
