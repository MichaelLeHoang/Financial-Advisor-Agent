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

    assert history.clear_history("session-a", "user-1") is True
    assert history.load_history("session-a", "user-1") == []
    assert history.load_history("session-a", "user-2")[0]["content"] == "Other user's chat"


def test_chat_history_auto_title_summarizes_long_first_prompt(tmp_path, monkeypatch):
    monkeypatch.setattr(history, "DB_PATH", tmp_path / "conversations.db")

    created = history.create_session("long-session", "user-1")
    assert created["title"] == "New chat"
    assert created["message_count"] == 0

    history.append_message(
        "long-session",
        "user",
        "Can you optimize my portfolio with AAPL, MSFT, and GOOGL and explain the tradeoffs?",
        "user-1",
    )
    history.append_message(
        "long-session",
        "user",
        "This later message should not rename the existing history item",
        "user-1",
    )

    title = history.list_sessions("user-1")[0]["title"]
    assert title == "optimize portfolio AAPL MSFT GOOGL"
    assert 3 <= len(title.split()) <= 5


def test_chat_history_detects_cross_user_session_ids(tmp_path, monkeypatch):
    monkeypatch.setattr(history, "DB_PATH", tmp_path / "conversations.db")

    history.append_message("shared-looking-session", "user", "User A private chat", "user-a")

    assert history.session_belongs_to_user("shared-looking-session", "user-a") is True
    assert history.session_belongs_to_user("shared-looking-session", "user-b") is False
    assert history.session_claimed_by_another_user("shared-looking-session", "user-b") is True
    assert history.session_claimed_by_another_user("new-session", "user-b") is False


def test_rename_and_delete_require_existing_owned_session(tmp_path, monkeypatch):
    monkeypatch.setattr(history, "DB_PATH", tmp_path / "conversations.db")

    history.append_message("owned-session", "user", "Owner chat", "owner")

    try:
        history.rename_session("owned-session", "Bad rename", "other")
    except KeyError:
        pass
    else:
        raise AssertionError("Expected cross-user rename to fail")

    assert history.clear_history("owned-session", "other") is False
    assert history.load_history("owned-session", "owner")[0]["content"] == "Owner chat"
    assert history.clear_history("owned-session", "owner") is True


def test_chat_history_persists_structured_message_metadata(tmp_path, monkeypatch):
    monkeypatch.setattr(history, "DB_PATH", tmp_path / "conversations.db")

    metadata = {
        "consensus": {
            "opinions": [
                {
                    "agent": "risk_analyst",
                    "verdict": "hold",
                    "confidence": 0.72,
                    "reasoning": "Risk is elevated but manageable.",
                    "data_points": {},
                    "risk_flags": None,
                }
            ]
        }
    }

    history.append_message("metadata-session", "user", "Analyze NVDA", "user-1")
    history.append_message("metadata-session", "assistant", "Combined answer", "user-1", metadata=metadata)

    messages = history.load_history("metadata-session", "user-1")

    assert messages[0].get("metadata") is None
    assert messages[1]["metadata"] == metadata


def test_chat_history_truncates_selected_turn_and_later_messages(tmp_path, monkeypatch):
    monkeypatch.setattr(history, "DB_PATH", tmp_path / "conversations.db")

    for role, content in [
        ("user", "First question"),
        ("assistant", "First answer"),
        ("user", "Question to edit"),
        ("assistant", "Answer to replace"),
        ("user", "Later follow-up"),
    ]:
        history.append_message("edit-session", role, content, "user-1")

    removed = history.truncate_history("edit-session", 2, "user-1")

    assert removed == 3
    assert [message["content"] for message in history.load_history("edit-session", "user-1")] == [
        "First question",
        "First answer",
    ]
    assert history.truncate_history("edit-session", 0, "user-2") == 0


def test_chat_history_truncating_first_turn_allows_title_regeneration(tmp_path, monkeypatch):
    monkeypatch.setattr(history, "DB_PATH", tmp_path / "conversations.db")

    history.append_message("first-turn", "user", "Analyze the old ticker", "user-1")
    history.append_message("first-turn", "assistant", "Old answer", "user-1")

    assert history.truncate_history("first-turn", 0, "user-1") == 2
    history.append_message("first-turn", "user", "Review NVDA earnings risk", "user-1")

    assert history.list_sessions("user-1")[0]["title"] == "Review NVDA earnings risk"
