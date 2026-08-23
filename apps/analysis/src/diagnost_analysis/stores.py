"""Store clients: ClickHouse over HTTP (read), Postgres via psycopg (write)."""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

import httpx
import psycopg

from .config import Config


@dataclass(frozen=True)
class Conversation:
    conversation_id: str
    text: str  # concatenated message content (redacted at source by the SDK)
    user_text: str  # user-role messages only — embedding input for pattern discovery
    started_at: str  # ISO timestamp of first event
    ended_at: str  # ISO timestamp of last event
    has_error: bool


# Per event: role-tagged message texts + bare prompt fallback.
_TEXT_PER_EVENT_SQL = """
    SELECT
      conversation_id,
      timestamp,
      status = 'error' AS is_error,
      arrayMap(
        m -> (JSONExtractString(m, 'role'), JSONExtractString(m, 'content')),
        if(JSONHas(attributes, 'messages'),
           JSONExtractArrayRaw(attributes, 'messages'),
           [])
      ) AS msgs,
      coalesce(nullIf(JSONExtractString(attributes, 'prompt'), ''), '') AS prompt
    FROM {db}.events
    WHERE conversation_id IN ({ids})
"""


class ClickHouseReader:
    def __init__(self, cfg: Config):
        self.cfg = cfg
        self._client = httpx.Client(
            base_url=cfg.clickhouse_url,
            auth=(cfg.clickhouse_user, cfg.clickhouse_password),
            timeout=120.0,
        )

    def query(self, sql: str) -> list[dict[str, Any]]:
        res = self._client.post("/", params={"default_format": "JSONEachRow"}, content=sql)
        res.raise_for_status()
        return [json.loads(line) for line in res.text.splitlines() if line.strip()]

    def _quoted_ids(self, ids: list[str]) -> str:
        return ",".join("'" + c.replace("'", "") + "'" for c in ids)

    def fetch_unprocessed_conversations(self, limit: int = 50_000) -> list[Conversation]:
        """Conversations not yet marked processed in Postgres, with transcript text
        aggregated from inline redacted payloads."""
        id_rows = self.query(
            f"SELECT DISTINCT conversation_id FROM {self.cfg.clickhouse_db}.events LIMIT {limit}"
        )
        conv_ids = [r["conversation_id"] for r in id_rows]
        if not conv_ids:
            return []

        events = self.query(
            _TEXT_PER_EVENT_SQL.format(db=self.cfg.clickhouse_db, ids=self._quoted_ids(conv_ids))
        )
        agg: dict[str, dict[str, Any]] = {}
        for r in events:
            cid = str(r["conversation_id"])
            slot = agg.setdefault(
                cid,
                {"started": None, "ended": None, "has_error": False, "texts": [], "user_texts": []},
            )
            slot["started"] = min(slot["started"] or r["timestamp"], r["timestamp"])
            slot["ended"] = max(slot["ended"] or r["timestamp"], r["timestamp"])
            slot["has_error"] = slot["has_error"] or bool(r["is_error"])
            for role, content in r["msgs"]:
                if not content:
                    continue
                slot["texts"].append(str(content))
                if str(role).lower() == "user":
                    slot["user_texts"].append(str(content))
            if r["prompt"]:
                # prompts are treated as user-side signal
                slot["texts"].append(str(r["prompt"]))
                slot["user_texts"].append(str(r["prompt"]))

        return [
            Conversation(
                conversation_id=cid,
                text=" ".join(slot["texts"])[:8000],  # cap judge/term input
                user_text=" ".join(slot["user_texts"])[:4000],  # embedding input
                started_at=str(slot["started"]),
                ended_at=str(slot["ended"]),
                has_error=bool(slot["has_error"]),
            )
            for cid, slot in sorted(agg.items(), key=lambda kv: kv[1]["started"])
        ]

    def close(self) -> None:
        self._client.close()


class PostgresWriter:
    def __init__(self, database_url: str):
        self._conninfo = database_url
        self._conn: psycopg.Connection | None = None

    @property
    def conn(self) -> psycopg.Connection:
        if self._conn is None or self._conn.closed:
            self._conn = psycopg.connect(self._conninfo, autocommit=True)
        return self._conn

    def execute(self, sql: str, params: tuple | list = ()) -> None:
        with self.conn.cursor() as cur:
            cur.execute(sql, params)

    def executemany(self, sql: str, seq: list[tuple]) -> None:
        with self.conn.cursor() as cur:
            cur.executemany(sql, seq)

    def fetchall(self, sql: str, params: tuple | list = ()) -> list[tuple]:
        with self.conn.cursor() as cur:
            cur.execute(sql, params)
            return list(cur.fetchall())

    def close(self) -> None:
        if self._conn is not None and not self._conn.closed:
            self._conn.close()
