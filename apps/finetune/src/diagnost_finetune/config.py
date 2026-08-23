"""Fine-tuning pipeline configuration (mock-first providers)."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


def _load_dotenv() -> None:
    candidate = Path.cwd() / ".env"
    if not candidate.exists():
        return
    for line in candidate.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip("'\""))


def load_config() -> Config:
    _load_dotenv()
    return Config(
        database_url=os.environ.get(
            "DATABASE_URL", "postgres://diagnost:diagnost_dev_password@localhost:5432/diagnost"
        ),
        clickhouse_url=os.environ.get("CLICKHOUSE_URL", "http://localhost:8123"),
        clickhouse_user=os.environ.get("CLICKHOUSE_USER", "diagnost"),
        clickhouse_password=os.environ.get("CLICKHOUSE_PASSWORD", "diagnost_dev_password"),
        clickhouse_db=os.environ.get("CLICKHOUSE_DB", "events"),
        workspace_id=os.environ.get("WORKSPACE_ID", "ws_dev"),
        trainer=os.environ.get("FINETUNE_TRAINER", "local_specialist"),
        base_model=os.environ.get("FINETUNE_BASE_MODEL", "tfidf-logreg-v1"),
        managed_base_model=os.environ.get("FINETUNE_MANAGED_MODEL", "meta-llama/Llama-3.2-3B-Instruct"),
        openai_api_key=os.environ.get("OPENAI_API_KEY", ""),
        frontier_model=os.environ.get("FRONTIER_MODEL", "gpt-4o-mini"),
        heldout_fraction=float(os.environ.get("HELDOUT_FRACTION", "0.25")),
    )


@dataclass(frozen=True)
class Config:
    database_url: str
    clickhouse_url: str
    clickhouse_user: str
    clickhouse_password: str
    clickhouse_db: str
    workspace_id: str
    trainer: str  # local_specialist | together | fireworks
    base_model: str
    managed_base_model: str
    openai_api_key: str
    frontier_model: str
    heldout_fraction: float
