"""SQLite audit trail: every request, who asked, what was retrieved and cited, which endpoint answered."""
from __future__ import annotations

import json
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT NOT NULL,
    user_id TEXT NOT NULL,
    user_name TEXT,
    groups TEXT NOT NULL,
    question TEXT NOT NULL,
    lang TEXT,
    retrieved TEXT NOT NULL,
    cited TEXT NOT NULL,
    invalid_citations TEXT NOT NULL,
    refused INTEGER NOT NULL,
    answer TEXT,
    endpoint_label TEXT,
    endpoint_url TEXT,
    model TEXT,
    injection_defence INTEGER NOT NULL,
    flags TEXT NOT NULL,
    latency_ms INTEGER,
    llm_latency_ms INTEGER,
    error TEXT,
    agent TEXT
)
"""
JSON_COLS = ("groups", "retrieved", "cited", "invalid_citations", "flags")


class AuditLog:
    def __init__(self, path: Path):
        path.parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._lock = threading.Lock()
        with self._lock:
            self._conn.execute(SCHEMA)
            cols = {r[1] for r in self._conn.execute("PRAGMA table_info(requests)")}
            if "agent" not in cols:  # databases created before agents existed
                self._conn.execute("ALTER TABLE requests ADD COLUMN agent TEXT")
            self._conn.commit()

    def write(self, **rec) -> int:
        rec.setdefault("ts", datetime.now(timezone.utc).isoformat(timespec="seconds"))
        for col in JSON_COLS:
            rec[col] = json.dumps(rec.get(col) or [], ensure_ascii=False)
        rec["refused"] = int(bool(rec.get("refused")))
        rec["injection_defence"] = int(bool(rec.get("injection_defence")))
        cols = ", ".join(rec)
        marks = ", ".join("?" for _ in rec)
        with self._lock:
            cur = self._conn.execute(f"INSERT INTO requests ({cols}) VALUES ({marks})", list(rec.values()))
            self._conn.commit()
            return cur.lastrowid

    def recent(self, limit: int = 100) -> list[dict]:
        with self._lock:
            rows = self._conn.execute("SELECT * FROM requests ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
        out = []
        for r in rows:
            d = dict(r)
            for col in JSON_COLS:
                d[col] = json.loads(d[col])
            d["refused"] = bool(d["refused"])
            d["injection_defence"] = bool(d["injection_defence"])
            out.append(d)
        return out
