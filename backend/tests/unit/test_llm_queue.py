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
    monkeypatch.setattr(worker_module, "execute_llm_job", lambda job: {"response": "ok", "session_id": "s1", "mode": "single"})

    processed = worker_module.LLMWorker(queue=queue).process_once()
    updated = queue.get(record["job_id"])

    assert processed is True
    assert updated["status"] == "succeeded"
    assert updated["result"]["response"] == "ok"


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
