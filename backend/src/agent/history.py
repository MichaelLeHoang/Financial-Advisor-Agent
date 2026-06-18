"""
Persistent conversation history using SQLite.
Each session_id gets its own message thread.
"""
import sqlite3
from pathlib import Path
from datetime import UTC, datetime

DB_PATH = Path(__file__).parent.parent.parent / "data" / "conversations.db"
GUEST_USER_ID = "00000000-0000-0000-0000-000000000001"


def _is_guest_user(user_id: str) -> bool:
    return str(user_id) == GUEST_USER_ID


def _get_connection() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id   TEXT    NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
            session   TEXT    NOT NULL,
            role      TEXT    NOT NULL,
            content   TEXT    NOT NULL,
            created_at TEXT   NOT NULL
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            user_id    TEXT NOT NULL,
            session    TEXT NOT NULL,
            title      TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            PRIMARY KEY (user_id, session)
        )
    """)
    _ensure_column(conn, "messages", "user_id", "TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_messages_user_session_id ON messages(user_id, session, id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_sessions_user_updated ON sessions(user_id, updated_at DESC)")
    conn.commit()
    return conn


def _ensure_column(conn: sqlite3.Connection, table: str, column: str, definition: str) -> None:
    columns = {row[1] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()}
    if column not in columns:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")


def _default_title(content: str) -> str:
    title = " ".join(content.strip().split())
    if not title:
        return "New analysis"
    return title[:64]


def _touch_session(conn: sqlite3.Connection, user_id: str, session_id: str, title: str | None = None) -> None:
    now = datetime.now(UTC).isoformat()
    existing = conn.execute(
        "SELECT title FROM sessions WHERE user_id=? AND session=?",
        (user_id, session_id),
    ).fetchone()
    if existing:
        conn.execute(
            """
            UPDATE sessions
            SET updated_at=?,
                title=CASE
                    WHEN ? IS NOT NULL AND title='New analysis' THEN ?
                    ELSE title
                END
            WHERE user_id=? AND session=?
            """,
            (now, title, title, user_id, session_id),
        )
        return

    conn.execute(
        "INSERT INTO sessions (user_id, session, title, created_at, updated_at) VALUES (?,?,?,?,?)",
        (user_id, session_id, title or "New analysis", now, now),
    )


def session_owner(session_id: str) -> str | None:
    """Return the user_id that owns a session_id, if it exists."""
    conn = _get_connection()
    row = conn.execute(
        "SELECT user_id FROM sessions WHERE session=? ORDER BY updated_at DESC LIMIT 1",
        (session_id,),
    ).fetchone()
    if row is None:
        row = conn.execute(
            "SELECT user_id FROM messages WHERE session=? ORDER BY id DESC LIMIT 1",
            (session_id,),
        ).fetchone()
    conn.close()
    return row[0] if row else None


def session_belongs_to_user(session_id: str, user_id: str) -> bool:
    """Return true when a session exists and belongs to the given user."""
    if _is_guest_user(user_id):
        return False
    conn = _get_connection()
    row = conn.execute(
        "SELECT 1 FROM sessions WHERE user_id=? AND session=? LIMIT 1",
        (user_id, session_id),
    ).fetchone()
    if row is None:
        row = conn.execute(
            "SELECT 1 FROM messages WHERE user_id=? AND session=? LIMIT 1",
            (user_id, session_id),
        ).fetchone()
    conn.close()
    return row is not None


def session_claimed_by_another_user(session_id: str, user_id: str) -> bool:
    """Return true when this session_id is already owned by another user."""
    if session_belongs_to_user(session_id, user_id):
        return False
    owner = session_owner(session_id)
    return owner is not None


def load_history(session_id: str, user_id: str = "00000000-0000-0000-0000-000000000001") -> list[dict]:
    """Load all messages for a session, ordered oldest first."""
    if _is_guest_user(user_id):
        return []
    conn = _get_connection()
    rows = conn.execute(
        "SELECT id, role, content, created_at FROM messages WHERE user_id=? AND session=? ORDER BY id",
        (user_id, session_id),
    ).fetchall()
    conn.close()
    return [{"id": row_id, "role": role, "content": content, "created_at": created_at} for row_id, role, content, created_at in rows]


def append_message(
    session_id: str,
    role: str,
    content: str,
    user_id: str = "00000000-0000-0000-0000-000000000001",
) -> None:
    """Append a single message to the session history."""
    if _is_guest_user(user_id):
        return
    conn = _get_connection()
    title = _default_title(content) if role == "user" else None
    _touch_session(conn, user_id, session_id, title)
    conn.execute(
        "INSERT INTO messages (user_id, session, role, content, created_at) VALUES (?,?,?,?,?)",
        (user_id, session_id, role, content, datetime.now(UTC).isoformat()),
    )
    conn.commit()
    conn.close()


def clear_history(session_id: str, user_id: str = "00000000-0000-0000-0000-000000000001") -> bool:
    """Delete all messages for a session and remove the session record."""
    if _is_guest_user(user_id):
        return False
    conn = _get_connection()
    existing = conn.execute(
        "SELECT 1 FROM sessions WHERE user_id=? AND session=?",
        (user_id, session_id),
    ).fetchone()
    if existing is None:
        conn.close()
        return False
    conn.execute("DELETE FROM messages WHERE user_id=? AND session=?", (user_id, session_id))
    conn.execute("DELETE FROM sessions WHERE user_id=? AND session=?", (user_id, session_id))
    conn.commit()
    conn.close()
    return True


def rename_session(
    session_id: str,
    title: str,
    user_id: str = "00000000-0000-0000-0000-000000000001",
) -> dict:
    """Rename a session and return its metadata."""
    if _is_guest_user(user_id):
        raise PermissionError("Guest users cannot rename saved chat sessions.")
    clean_title = _default_title(title)
    conn = _get_connection()
    existing = conn.execute(
        "SELECT 1 FROM sessions WHERE user_id=? AND session=?",
        (user_id, session_id),
    ).fetchone()
    if existing is None:
        conn.close()
        raise KeyError(session_id)
    conn.execute(
        "UPDATE sessions SET title=?, updated_at=? WHERE user_id=? AND session=?",
        (clean_title, datetime.now(UTC).isoformat(), user_id, session_id),
    )
    row = conn.execute(
        """
        SELECT s.session, s.title, s.updated_at, COUNT(m.id) as msg_count
        FROM sessions s
        LEFT JOIN messages m ON m.user_id=s.user_id AND m.session=s.session
        WHERE s.user_id=? AND s.session=?
        GROUP BY s.session, s.title, s.updated_at
        """,
        (user_id, session_id),
    ).fetchone()
    conn.commit()
    conn.close()
    return {
        "session_id": row[0],
        "title": row[1],
        "message_count": row[3],
        "last_active": row[2],
    }


def list_sessions(user_id: str = "00000000-0000-0000-0000-000000000001") -> list[dict]:
    """List all sessions with message count and last activity."""
    if _is_guest_user(user_id):
        return []
    conn = _get_connection()
    conn.execute("""
        INSERT OR IGNORE INTO sessions (user_id, session, title, created_at, updated_at)
        SELECT
            user_id,
            session,
            COALESCE(
                (SELECT substr(content, 1, 64) FROM messages m2 WHERE m2.user_id=messages.user_id AND m2.session=messages.session AND m2.role='user' ORDER BY id LIMIT 1),
                'New analysis'
            ) as title,
            MIN(created_at),
            MAX(created_at)
        FROM messages
        WHERE user_id=?
        GROUP BY user_id, session
    """, (user_id,))
    rows = conn.execute("""
        SELECT s.session, s.title, COUNT(m.id) as msg_count, s.updated_at
        FROM sessions s
        LEFT JOIN messages m ON m.user_id=s.user_id AND m.session=s.session
        WHERE s.user_id=?
        GROUP BY s.session, s.title, s.updated_at
        HAVING msg_count > 0
        ORDER BY s.updated_at DESC
    """, (user_id,)).fetchall()
    conn.commit()
    conn.close()
    return [
        {"session_id": session, "title": title, "message_count": count, "last_active": last_active}
        for session, title, count, last_active in rows
    ]
