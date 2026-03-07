import sqlite3
import json 
from pathlib import pathlib
from datetime import datetime 

DB_PATH = Path(__file__).parent.parent.parent / "data" / "conversations.db"

def _get_connection() -> sqlite3.Connection: 
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_path))
    con.execute(
        """
        CREATE TABLE IF NOT EXISTS messages (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            session   TEXT    NOT NULL,
            role      TEXT    NOT NULL,
            content   TEXT    NOT NULL,
            created_at TEXT   NOT NULL
        )
    """)
    conn.commit()
    return conn

    def load_history(session_id: str) -> list[dict]:
        """Load all messages for a session, ordered oldest first."""
        conn = _get_connection()
        rows = conn.execute(
             "SELECT role, content FROM messages WHERE session=? ORDER BY id",
             (session_id,),
        ).fetchall()
        conn.close()
        return [{"role": role, "content": content} for role, content in rows]


    def append_message(session_id: str, role: str, content: str) -> None:
        """Append a single message to the session history"""
        conn = _get_connection()
        conn.execute(
            "INSERT INTO messages (session, role, content, created_at) VALUES (?,?,?,?)",
            (session_id, role, content, datetime.utcnow().isoformat()),
        )
        conn.commit()
        conn.close()

    def clear_history(session_id: str) -> None: 
        """Delete all messages for a session"""
        conn = _get_connection()
        conn.execute("DELETE FROM messages WHERE session=?", (session_id,))
        conn.commit()
        conn.close()

    def list_sessions() -> list[dict]:
        """List all sessions with message count and last activity."""
        conn = _get_connection()
        rows = conn.execute(
            """
            SELECT session, COUNT(*) as msg_count, MAX(created_at) as last_active
            FROM messages GROUP BY session ORDER BY last_active DESC
        """).fetchall()
        conn.close()
        return [
            {"session_id": s, "message_count": c, "last_active": a}
            for s, c, a in rows
        ]

        