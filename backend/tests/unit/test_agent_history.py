from src.agent import history


def test_chat_history_lists_loads_renames_and_scopes_by_user(tmp_path, monkeypatch):
    monkeypatch.setattr(history, "DB_PATH", tmp_path / "conversations.db")

    history.append_message("session-a", "user", "Analyze NVDA earnings risk", "user-1")
    history.append_message("session-a", "assistant", "Here is the risk summary.", "user-1")
    history.append_message("session-a", "user", "This should not change the title", "user-1")
    history.append_message("session-a", "user", "Other user's chat", "user-2")

    sessions = history.list_sessions("user-1")
    assert sessions == [
        {
            "session_id": "session-a",
            "title": "Analyze NVDA earnings risk",
            "message_count": 3,
            "last_active": sessions[0]["last_active"],
        }
    ]

    messages = history.load_history("session-a", "user-1")
    assert [message["role"] for message in messages] == ["user", "assistant", "user"]
    assert messages[0]["content"] == "Analyze NVDA earnings risk"

    renamed = history.rename_session("session-a", "Renamed NVDA brief", "user-1")
    assert renamed["title"] == "Renamed NVDA brief"
    assert history.list_sessions("user-1")[0]["title"] == "Renamed NVDA brief"
    assert history.list_sessions("user-2")[0]["title"] == "Other user's chat"

    history.clear_history("session-a", "user-1")
    assert history.load_history("session-a", "user-1") == []
    assert history.load_history("session-a", "user-2")[0]["content"] == "Other user's chat"
