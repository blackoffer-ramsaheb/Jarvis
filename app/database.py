# SQLite database manager
import os
import sqlite3
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = str(DATA_DIR / "jarvis.db")


def get_connection():
    """Get database connection with absolute path and ensure schema is initialized."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH)
    connection.execute("""
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    connection.commit()
    return connection


def init_db():
    """Explicit database initialization."""
    conn = get_connection()
    conn.close()


def add_task(task: str):
    """Add a task and return its generated ID."""
    connection = get_connection()
    cursor = connection.cursor()
    cursor.execute(
        "INSERT INTO tasks (task) VALUES (?)",
        (task,)
    )
    task_id = cursor.lastrowid
    connection.commit()
    connection.close()
    return task_id


def get_tasks():
    """Retrieve all tasks ordered by latest first."""
    connection = get_connection()
    cursor = connection.cursor()
    rows = cursor.execute(
        "SELECT id, task, created_at FROM tasks ORDER BY id DESC"
    ).fetchall()
    connection.close()
    return [{"id": r[0], "task": r[1], "created_at": r[2]} for r in rows]


def delete_task(task_id: int):
    """Delete a task by ID."""
    connection = get_connection()
    cursor = connection.cursor()
    cursor.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
    connection.commit()
    deleted = cursor.rowcount > 0
    connection.close()
    return deleted