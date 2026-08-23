"""SFT/DPO dataset export from labeled production traces.

Emits chat-format SFT JSONL (system prompt + user text → intent) with a
deterministic stratified train/held-out split. DPO export shares the same
example loader; pairs are formed from error-vs-corrected response candidates.
"""

from __future__ import annotations

import hashlib
import json
import os
import random
from dataclasses import dataclass, field
from pathlib import Path

from .config import Config
from .stores import LabeledExample, Stores

ROUTER_SYSTEM_PROMPT = (
    "You classify support-agent conversations into exactly one intent label "
    "from this fixed set. Reply with ONLY the label.\n"
    "Labels: billing_dispute, date_format_error, tool_timeout, order_status, "
    "account_access."
)


@dataclass
class Split:
    train: list[LabeledExample] = field(default_factory=list)
    heldout: list[LabeledExample] = field(default_factory=list)


def stratified_split(examples: list[LabeledExample], heldout_fraction: float, seed: int = 42) -> Split:
    """Deterministic per-class shuffle so both sides see every intent."""
    by_class: dict[str, list[LabeledExample]] = {}
    for ex in examples:
        by_class.setdefault(ex.intent, []).append(ex)

    rng = random.Random(seed)
    out = Split()
    for _, group in sorted(by_class.items()):
        idx = list(range(len(group)))
        rng.shuffle(idx)
        n_hold = max(1, int(len(group) * heldout_fraction))
        for i, pos in enumerate(idx):
            (out.heldout if i < n_hold else out.train).append(group[pos])
    return out


def to_sft_row(example: LabeledExample) -> dict:
    return {
        "messages": [
            {"role": "system", "content": ROUTER_SYSTEM_PROMPT},
            {"role": "user", "content": example.user_text or "(empty)"},
            {"role": "assistant", "content": example.intent},
        ],
        "metadata": {
            "conversation_id": example.conversation_id,
            "has_error": example.has_error,
        },
    }


def write_sft(path: Path, examples: list[LabeledExample]) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w") as f:
        for ex in examples:
            f.write(json.dumps(to_sft_row(ex)) + "\n")
    return len(examples)


def dataset_id_for(cfg: Config, examples: list[LabeledExample]) -> str:
    digest = hashlib.sha1(
        "|".join(sorted(e.conversation_id for e in examples)).encode()
    ).hexdigest()[:10]
    return f"routing-{digest}"


async def upload_to_s3(cfg: Config, local_path: Path, key: str) -> str | None:
    """Best-effort upload to the MinIO finetune bucket; returns s3 uri or None."""
    try:
        import boto3  # optional dependency
    except ImportError:
        print("[export] boto3 not installed — skipping S3 upload")
        return None
    try:
        s3 = boto3.client(
            "s3",
            endpoint_url=os.getenv("S3_ENDPOINT", "http://localhost:9000"),
            aws_access_key_id=os.getenv("S3_ACCESS_KEY", "minioadmin"),
            aws_secret_access_key=os.getenv("S3_SECRET_KEY", "minioadmin_dev_password"),
            region_name=os.getenv("S3_REGION", "us-east-1"),
        )
        bucket = os.getenv("S3_BUCKET_FINETUNE", "finetune-datasets")
        s3.upload_file(str(local_path), bucket, key)
        return f"s3://{bucket}/{key}"
    except Exception as err:  # upload must never block the pipeline
        print(f"[export] S3 upload skipped: {err}")
        return None


