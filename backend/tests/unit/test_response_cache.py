import json

from src.agent.llm_queue import QueuedJob
from src.saas.models import Plan


def test_cached_chat_response_reuses_normalized_first_turn_prompt(monkeypatch):
    from src.agent import response_cache

    store = {}
    calls = 0

    def fake_cached_value(namespace, payload, ttl_seconds, compute):
        key = (namespace, json.dumps(payload, sort_keys=True))
        if key not in store:
            store[key] = compute()
        return store[key]

    def compute():
        nonlocal calls
        calls += 1
        return {"response": "cached", "session_id": "s1", "mode": "single"}

    monkeypatch.setattr(response_cache, "cached_value", fake_cached_value)

    first = response_cache.cached_chat_response(
        user_id="user-1",
        plan=Plan.FREE,
        mode="single",
        preferred_mode=None,
        message="Should   I buy NVDA?",
        history=[],
        is_guest=False,
        compute=compute,
    )
    second = response_cache.cached_chat_response(
        user_id="user-1",
        plan=Plan.FREE,
        mode="single",
        preferred_mode=None,
        message="should i buy nvda?",
        history=[],
        is_guest=False,
        compute=compute,
    )

    assert first == second
    assert calls == 1


def test_cached_chat_response_skips_guest_and_history(monkeypatch):
    from src.agent import response_cache

    def fail_if_cached(*args, **kwargs):
        raise AssertionError("cache should not be used")

    monkeypatch.setattr(response_cache, "cached_value", fail_if_cached)

    guest_calls = 0
    history_calls = 0

    def compute_guest():
        nonlocal guest_calls
        guest_calls += 1
        return {"response": "guest", "session_id": "s1", "mode": "single"}

    def compute_history():
        nonlocal history_calls
        history_calls += 1
        return {"response": "history", "session_id": "s1", "mode": "single"}

    response_cache.cached_chat_response(
        user_id="guest",
        plan=Plan.FREE,
        mode="single",
        preferred_mode=None,
        message="Should I buy NVDA?",
        history=[],
        is_guest=True,
        compute=compute_guest,
    )
    response_cache.cached_chat_response(
        user_id="user-1",
        plan=Plan.FREE,
        mode="single",
        preferred_mode=None,
        message="Should I buy NVDA?",
        history=[{"role": "user", "content": "prior turn"}],
        is_guest=False,
        compute=compute_history,
    )

    assert guest_calls == 1
    assert history_calls == 1


def test_llm_worker_caches_full_result_with_metadata(monkeypatch):
    from src.agent import llm_worker, response_cache

    store = {}
    agent_calls = 0
    appended = []

    class FakeAgent:
        def __init__(self, **kwargs):
            self._history = []
            self.last_response_metadata = {"overview": {"title": "NVDA"}}

        def chat(self, message, remember=False, mode="single", progress_callback=None):
            nonlocal agent_calls
            agent_calls += 1
            return "Hold/Wait on NVDA for now."

    def fake_cached_value(namespace, payload, ttl_seconds, compute):
        key = (namespace, json.dumps(payload, sort_keys=True))
        if key not in store:
            store[key] = compute()
        return store[key]

    monkeypatch.setattr(response_cache, "cached_value", fake_cached_value)
    monkeypatch.setattr(llm_worker, "FinancialAdvisorAgent", FakeAgent)
    monkeypatch.setattr(
        llm_worker, "session_claimed_by_another_user", lambda session_id, user_id: False
    )
    monkeypatch.setattr(llm_worker, "load_history", lambda session_id, user_id: [])
    monkeypatch.setattr(
        llm_worker,
        "append_message",
        lambda *args, **kwargs: appended.append((args, kwargs)),
    )

    payload = {
        "user_id": "user-1",
        "plan": "free",
        "session_id": "s1",
        "message": "Should I buy NVDA?",
        "remember": True,
        "mode": "single",
        "preferred_mode": None,
    }
    first = llm_worker.execute_llm_job(QueuedJob("job-1", "single", payload))
    second = llm_worker.execute_llm_job(
        QueuedJob("job-2", "single", {**payload, "message": "should   i buy nvda?"})
    )

    assert first == second
    assert first["overview"] == {"title": "NVDA"}
    assert agent_calls == 1
    assert len(appended) == 4
    assert appended[1][1]["metadata"] == {"overview": {"title": "NVDA"}}
    assert appended[3][1]["metadata"] == {"overview": {"title": "NVDA"}}
