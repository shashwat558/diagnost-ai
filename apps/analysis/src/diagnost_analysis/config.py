"""Environment-driven configuration (mock-first providers)."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path


def _load_dotenv() -> None:
    """Minimal .env loader — real env vars win."""
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
            "DATABASE_URL",
            "postgres://diagnost:diagnost_dev_password@localhost:5432/diagnost",
        ),
        clickhouse_url=os.environ.get("CLICKHOUSE_URL", "http://localhost:8123"),
        clickhouse_user=os.environ.get("CLICKHOUSE_USER", "diagnost"),
        clickhouse_password=os.environ.get("CLICKHOUSE_PASSWORD", "diagnost_dev_password"),
        clickhouse_db=os.environ.get("CLICKHOUSE_DB", "events"),
        workspace_id=os.environ.get("WORKSPACE_ID", "ws_dev"),
        embedding_provider=os.environ.get("EMBEDDING_PROVIDER", "mock"),
        embedding_dim=int(os.environ.get("EMBEDDING_DIM", "256")),
        openai_api_key=os.environ.get("OPENAI_API_KEY", ""),
        openai_base_url=os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1"),
        llm_provider=os.environ.get("LLM_PROVIDER", "mock"),
        llm_model=os.environ.get("LLM_MODEL", "gpt-4o-mini"),
        hdbscan_min_cluster_size=int(os.environ.get("HDBSCAN_MIN_CLUSTER_SIZE", "25")),
        hdbscan_min_samples=int(os.environ.get("HDBSCAN_MIN_SAMPLES", "5")),
        drift_bucket_minutes=int(os.environ.get("DRIFT_BUCKET_MINUTES", "60")),
    )


@dataclass(frozen=True)
class Config:
    database_url: str
    clickhouse_url: str
    clickhouse_user: str
    clickhouse_password: str
    clickhouse_db: str
    workspace_id: str
    embedding_provider: str  # mock | openai
    embedding_dim: int
    openai_api_key: str
    openai_base_url: str
    llm_provider: str  # mock | openai
    llm_model: str
    hdbscan_min_cluster_size: int = field(default=25)
    hdbscan_min_samples: int = field(default=5)
    drift_bucket_minutes: int = field(default=60)
