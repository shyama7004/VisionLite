"""SQLite storage. One table, one row per visit."""
import json
import sqlite3
from datetime import datetime, timedelta, timezone

from . import config


def _conn() -> sqlite3.Connection:
    config.DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(config.DATA_DIR / "visionlite.db")
    conn.row_factory = sqlite3.Row
    # Cheap and safe to repeat: the table exists even if the startup hook did not run.
    conn.execute(
        "CREATE TABLE IF NOT EXISTS visits ("
        "id TEXT PRIMARY KEY, created_at TEXT, language TEXT, payload TEXT, recommendation TEXT)"
    )
    config.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    return conn


def init() -> None:
    cleanup()


def upsert_visit(visit_id: str, created_at: str, language: str, payload: dict, recommendation: dict | None) -> None:
    with _conn() as c:
        c.execute(
            "INSERT INTO visits (id, created_at, language, payload, recommendation) VALUES (?,?,?,?,?) "
            "ON CONFLICT(id) DO UPDATE SET language=excluded.language, payload=excluded.payload, "
            "recommendation=excluded.recommendation",
            (visit_id, created_at, language, json.dumps(payload), json.dumps(recommendation) if recommendation else None),
        )


def get_visit(visit_id: str) -> dict | None:
    with _conn() as c:
        row = c.execute("SELECT * FROM visits WHERE id=?", (visit_id,)).fetchone()
    if not row:
        return None
    return {
        "id": row["id"],
        "created_at": row["created_at"],
        "language": row["language"],
        "payload": json.loads(row["payload"]),
        "recommendation": json.loads(row["recommendation"]) if row["recommendation"] else None,
    }


def cleanup() -> int:
    """Delete visits older than RETENTION_DAYS."""
    if config.RETENTION_DAYS <= 0:
        return 0
    cutoff = (datetime.now(timezone.utc) - timedelta(days=config.RETENTION_DAYS)).isoformat()
    with _conn() as c:
        cur = c.execute("DELETE FROM visits WHERE created_at < ?", (cutoff,))
        return cur.rowcount
