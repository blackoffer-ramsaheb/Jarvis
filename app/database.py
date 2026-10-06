# SQLite database manager for Jarvis
import os
import sqlite3
from pathlib import Path
from typing import List, Dict, Any, Optional

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = str(DATA_DIR / "jarvis.db")


def get_connection():
    """Get database connection and ensure tables exist."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def init_db():
    """Initialize database tables and run automatic migrations if needed."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = get_connection()
    cursor = conn.cursor()

    # Tasks table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            priority TEXT DEFAULT 'medium',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Check and migrate columns if upgrading from earlier version
    cursor.execute("PRAGMA table_info(tasks)")
    columns = [col[1] for col in cursor.fetchall()]
    if "status" not in columns:
        cursor.execute("ALTER TABLE tasks ADD COLUMN status TEXT DEFAULT 'pending'")
    if "priority" not in columns:
        cursor.execute("ALTER TABLE tasks ADD COLUMN priority TEXT DEFAULT 'medium'")
    if "updated_at" not in columns:
        cursor.execute("ALTER TABLE tasks ADD COLUMN updated_at TIMESTAMP DEFAULT NULL")

    # Chat history table for session persistence
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS chat_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_chat_session ON chat_history (session_id)")

    conn.commit()
    conn.close()


# --- TASK OPERATIONS ---

def add_task(task: str, priority: str = "medium") -> int:
    """Add a task and return its generated ID."""
    conn = get_connection()
    cursor = conn.cursor()
    clean_priority = priority.lower() if priority.lower() in ["low", "medium", "high"] else "medium"
    cursor.execute(
        "INSERT INTO tasks (task, status, priority) VALUES (?, 'pending', ?)",
        (task.strip(), clean_priority)
    )
    task_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return task_id


def get_tasks(status: Optional[str] = None) -> List[Dict[str, Any]]:
    """Retrieve tasks, optionally filtered by status ('pending', 'completed', etc.)."""
    conn = get_connection()
    cursor = conn.cursor()
    if status and status.lower() != "all":
        cursor.execute(
            "SELECT id, task, status, priority, created_at, updated_at FROM tasks WHERE LOWER(status) = LOWER(?) ORDER BY id DESC",
            (status.strip(),)
        )
    else:
        cursor.execute(
            "SELECT id, task, status, priority, created_at, updated_at FROM tasks ORDER BY id DESC"
        )
    rows = cursor.fetchall()
    conn.close()
    return [
        {
            "id": r["id"],
            "task": r["task"],
            "status": r["status"] or "pending",
            "priority": r["priority"] or "medium",
            "created_at": r["created_at"],
            "updated_at": r["updated_at"]
        }
        for r in rows
    ]


def update_task_status(task_id: int, status: str) -> bool:
    """Update task status (pending, in_progress, completed)."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (status.lower().strip(), task_id)
    )
    conn.commit()
    updated = cursor.rowcount > 0
    conn.close()
    return updated


def delete_task(task_id: int) -> bool:
    """Delete a task by ID."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
    conn.commit()
    deleted = cursor.rowcount > 0
    conn.close()
    return deleted


def find_task_by_keyword(query: str) -> Optional[Dict[str, Any]]:
    """Find the most recent matching task by a keyword query."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, task, status, priority, created_at FROM tasks WHERE LOWER(task) LIKE LOWER(?) ORDER BY id DESC LIMIT 1",
        (f"%{query.strip()}%",)
    )
    row = cursor.fetchone()
    conn.close()
    if row:
        return {
            "id": row["id"],
            "task": row["task"],
            "status": row["status"] or "pending",
            "priority": row["priority"] or "medium",
            "created_at": row["created_at"]
        }
    return None


# --- CHAT HISTORY OPERATIONS ---

def save_chat_message(session_id: str, role: str, content: str) -> int:
    """Save user or assistant message to persistent chat history."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO chat_history (session_id, role, content) VALUES (?, ?, ?)",
        (session_id.strip(), role.strip(), content.strip())
    )
    msg_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return msg_id


def get_chat_history(session_id: str, limit: int = 50) -> List[Dict[str, Any]]:
    """Retrieve chat history for a session in chronological order."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, role, content, created_at FROM chat_history WHERE session_id = ? ORDER BY id ASC LIMIT ?",
        (session_id.strip(), limit)
    )
    rows = cursor.fetchall()
    conn.close()
    return [
        {
            "id": r["id"],
            "role": r["role"],
            "content": r["content"],
            "created_at": r["created_at"]
        }
        for r in rows
    ]


def clear_chat_history(session_id: str) -> bool:
    """Clear chat history for a specific session."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM chat_history WHERE session_id = ?", (session_id.strip(),))
    conn.commit()
    deleted = cursor.rowcount > 0
    conn.close()
    return deleted