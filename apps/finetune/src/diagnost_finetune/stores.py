"""Store access for the fine-tuning pipeline."""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

import httpx
import psycopg

from .config import Config


@dataclass(frozen=True)
class LabeledExample:
    conversation_id: str
    intent: str
    user_text: str
    has_error: bool


class Stores:
    def __init__(self, cfg: Config):
        self.cfg = cfg
        self._ch = httpx.Client(
            base_url=cfg.clickhouse_url,
            auth=(cfg.clickhouse_user, cfg.clickhouse_password),
            timeout=120.0,
        )
        self._pg: psycopg.Connection | None = None

    # ── ClickHouse ────────────────────────────────────────────────
    def ch_query(self, sql: str) -> list[dict[str, Any]]:
        res = self._ch.post("/", params={"default_format": "JSONEachRow"}, content=sql)
        res.raise_for_status()
        return [json.loads(line) for line in res.text.splitlines() if line.strip()]

    def fetch_labeled_examples(self, limit: int = 20_000) -> list[LabeledExample]:
        """Labeled conversations: cluster intents joined to user-side text."""
        rows = self._pg_query(
            """
            SELECT cm.conversation_id, c.intent, cm.has_error
            FROM cluster_members cm
            JOIN clusters c ON c.id = cm.cluster_id
            WHERE c.workspace_id = %s AND c.intent NOT IN ('general_inquiry')
            LIMIT %s
            """,
            (self.cfg.workspace_id, limit),
        )
        if not rows:
            return []

        ids = ",".join("'" + r[0].replace("'", "") + "'" for r in rows)
        text_rows = self.ch_query(
            f"""
            SELECT conversation_id,
                   arrayStringConcat(
                     arrayFilter(t -> t != '',
                       arrayMap(m -> JSONExtractString(m,'content'),
                         arrayFlatten(groupArray(
                           if(JSONHas(attributes,'messages'),
                              JSONExtractArrayRaw(attributes,'messages'), [])
                         )))),
                     ' ') AS text,
                   arrayStringConcat(
                     arrayFilter(t -> t != '',
                       arrayMap(m -> concat(lower(JSONExtractString(m,'role')),':',JSONExtractString(m,'content')),
                         arrayFlatten(groupArray(
                           if(JSONHas(attributes,'messages'),
                              JSONExtractArrayRaw(attributes,'messages'), [])
                         )))),
                     ' ') AS tagged
             FROM {self.cfg.clickhouse_db}.events
             WHERE conversation_id IN ({ids})
             GROUP BY conversation_id
            """
        )
        # prefer user-only lines when roles are available
        def user_side(tagged: str) -> str:
            parts = []
            for tok in tagged.split("user:"):
                if tok.strip():
                    piece = tok.split("assistant:")[0].strip()
                    if piece:
                        parts.append(piece)
            return " ".join(parts)

        texts = {str(r["conversation_id"]): (str(r["text"]), user_side(str(r.get("tagged", "")))) for r in text_rows}
        out: list[LabeledExample] = []
        for conv_id, intent, has_error in rows:
            full, users = texts.get(conv_id, ("", ""))
            out.append(
                LabeledExample(
                    conversation_id=conv_id,
                    intent=intent,
                    user_text=(users or full)[:1500],
                    has_error=bool(has_error),
                )
            )
        return out

    # ── Postgres ──────────────────────────────────────────────────
    def _conn(self) -> psycopg.Connection:
        if self._pg is None or self._pg.closed:
            self._pg = psycopg.connect(self.cfg.database_url, autocommit=True)
        return self._pg

    def _pg_query(self, sql: str, params: tuple = ()) -> list[tuple]:
        with self._conn().cursor() as cur:
            cur.execute(sql, params)
            return list(cur.fetchall())

    def execute(self, sql: str, params: tuple = ()) -> None:
        with self._conn().cursor() as cur:
            cur.execute(sql, params)

    def close(self) -> None:
        self._ch.close()
        if self._pg is not None and not self._pg.closed:
            self._pg.close()
