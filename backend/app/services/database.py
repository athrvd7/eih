import json
import logging

import aiosqlite

from app.config import get_settings

logger = logging.getLogger(__name__)


async def init_db() -> None:
    """Create all database tables if they do not already exist."""
    settings = get_settings()
    async with aiosqlite.connect(settings.db_path) as db:
        await db.execute(
            """
            CREATE TABLE IF NOT EXISTS jobs (
                job_id          TEXT PRIMARY KEY,
                status          TEXT NOT NULL,
                repo_id         TEXT,
                repo_name       TEXT,
                source_type     TEXT,
                source          TEXT,
                collection_name TEXT,
                error           TEXT,
                created_at      TEXT DEFAULT (datetime('now')),
                updated_at      TEXT DEFAULT (datetime('now'))
            )
            """
        )
        await db.execute(
            """
            CREATE TABLE IF NOT EXISTS graphs (
                job_id     TEXT PRIMARY KEY,
                graph_json TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now'))
            )
            """
        )
        await db.execute(
            """
            CREATE TABLE IF NOT EXISTS walkthroughs (
                job_id           TEXT PRIMARY KEY,
                walkthrough_json TEXT NOT NULL,
                created_at       TEXT DEFAULT (datetime('now'))
            )
            """
        )
        await db.execute(
            """
            CREATE TABLE IF NOT EXISTS docs (
                job_id     TEXT PRIMARY KEY,
                docs_json  TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now'))
            )
            """
        )
        await db.execute(
            """
            CREATE TABLE IF NOT EXISTS chat_messages (
                id             INTEGER PRIMARY KEY AUTOINCREMENT,
                job_id         TEXT NOT NULL,
                role           TEXT NOT NULL,
                content        TEXT NOT NULL,
                citations_json TEXT DEFAULT '[]',
                created_at     TEXT DEFAULT (datetime('now'))
            )
            """
        )
        await db.commit()
    logger.info("Database tables ready.")


async def save_job(
    job_id: str,
    status: str,
    repo_id: str = "",
    repo_name: str = "",
    source_type: str = "",
    source: str = "",
    collection_name: str = "",
    error: str = "",
) -> None:
    settings = get_settings()
    async with aiosqlite.connect(settings.db_path) as db:
        await db.execute(
            """
            INSERT OR REPLACE INTO jobs
                (job_id, status, repo_id, repo_name, source_type, source, collection_name, error)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (job_id, status, repo_id, repo_name, source_type, source, collection_name, error),
        )
        await db.commit()


async def get_job(job_id: str) -> dict | None:
    settings = get_settings()
    async with aiosqlite.connect(settings.db_path) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT * FROM jobs WHERE job_id = ?", (job_id,)
        )
        row = await cursor.fetchone()
        return dict(row) if row else None


async def update_job(job_id: str, **kwargs) -> None:
    """Dynamically UPDATE any subset of columns in the jobs table."""
    if not kwargs:
        return
    settings = get_settings()
    set_clauses = ", ".join(f"{col} = ?" for col in kwargs)
    values = list(kwargs.values())
    values.append(job_id)
    async with aiosqlite.connect(settings.db_path) as db:
        await db.execute(
            f"UPDATE jobs SET {set_clauses}, updated_at = datetime('now') WHERE job_id = ?",
            values,
        )
        await db.commit()


async def save_graph(job_id: str, graph_json: str) -> None:
    settings = get_settings()
    async with aiosqlite.connect(settings.db_path) as db:
        await db.execute(
            "INSERT OR REPLACE INTO graphs (job_id, graph_json) VALUES (?, ?)",
            (job_id, graph_json),
        )
        await db.commit()


async def get_graph(job_id: str) -> str | None:
    settings = get_settings()
    async with aiosqlite.connect(settings.db_path) as db:
        cursor = await db.execute(
            "SELECT graph_json FROM graphs WHERE job_id = ?", (job_id,)
        )
        row = await cursor.fetchone()
        return row[0] if row else None


async def save_walkthrough(job_id: str, walkthrough_json: str) -> None:
    settings = get_settings()
    async with aiosqlite.connect(settings.db_path) as db:
        await db.execute(
            "INSERT OR REPLACE INTO walkthroughs (job_id, walkthrough_json) VALUES (?, ?)",
            (job_id, walkthrough_json),
        )
        await db.commit()


async def get_walkthrough(job_id: str) -> str | None:
    settings = get_settings()
    async with aiosqlite.connect(settings.db_path) as db:
        cursor = await db.execute(
            "SELECT walkthrough_json FROM walkthroughs WHERE job_id = ?", (job_id,)
        )
        row = await cursor.fetchone()
        return row[0] if row else None


async def save_docs(job_id: str, docs_json: str) -> None:
    settings = get_settings()
    async with aiosqlite.connect(settings.db_path) as db:
        await db.execute(
            "INSERT OR REPLACE INTO docs (job_id, docs_json) VALUES (?, ?)",
            (job_id, docs_json),
        )
        await db.commit()


async def get_docs(job_id: str) -> str | None:
    settings = get_settings()
    async with aiosqlite.connect(settings.db_path) as db:
        cursor = await db.execute(
            "SELECT docs_json FROM docs WHERE job_id = ?", (job_id,)
        )
        row = await cursor.fetchone()
        return row[0] if row else None


async def save_chat_message(
    job_id: str, role: str, content: str, citations_json: str = "[]"
) -> None:
    settings = get_settings()
    async with aiosqlite.connect(settings.db_path) as db:
        await db.execute(
            """
            INSERT INTO chat_messages (job_id, role, content, citations_json)
            VALUES (?, ?, ?, ?)
            """,
            (job_id, role, content, citations_json),
        )
        await db.commit()


async def get_chat_history(job_id: str, limit: int = 10) -> list[dict]:
    """Return the most recent `limit` messages for a job (newest first)."""
    settings = get_settings()
    async with aiosqlite.connect(settings.db_path) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            """
            SELECT * FROM chat_messages
            WHERE job_id = ?
            ORDER BY created_at DESC
            LIMIT ?
            """,
            (job_id, limit),
        )
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]
