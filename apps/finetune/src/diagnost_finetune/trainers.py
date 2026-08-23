"""Trainer abstraction.

- LocalSpecialistTrainer: a genuinely trained tiny router (TF-IDF + logistic
  regression). Real training, real inference — milliseconds, zero marginal
  cost. Stands in for the LoRA'd small model in offline environments.
- ManagedProviderTrainer: Together/Fireworks-shaped job submission; activates
  with FINETUNE_TRAINER=together|fireworks + API credentials.
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Protocol

import joblib

from .export_dataset import ROUTER_SYSTEM_PROMPT


@dataclass
class TrainResult:
    model_ref: str
    train_seconds: float
    metrics: dict = field(default_factory=dict)


class Router(Protocol):
    def predict(self, text: str) -> str: ...


class SpecialistRouter:
    """Loaded specialist model wrapper."""

    def __init__(self, pipeline):
        self._pipeline = pipeline

    def predict(self, text: str) -> str:
        return str(self._pipeline.predict([text or "(empty)"])[0])


class LocalSpecialistTrainer:
    mode = "local_specialist"

    def __init__(self, base_model: str = "tfidf-logreg-v1"):
        self.base_model = base_model

    def train(self, examples: list, out_dir: Path) -> TrainResult:
        from sklearn.linear_model import LogisticRegression
        from sklearn.metrics import accuracy_score
        from sklearn.pipeline import Pipeline
        from sklearn.feature_extraction.text import TfidfVectorizer

        started = time.time()
        texts = [e.user_text or "(empty)" for e in examples]
        labels = [e.intent for e in examples]

        pipeline = Pipeline(
            [
                ("tfidf", TfidfVectorizer(ngram_range=(1, 2), min_df=1, sublinear_tf=True)),
                ("clf", LogisticRegression(max_iter=1000, C=4.0)),
            ]
        )
        pipeline.fit(texts, labels)

        out_dir.mkdir(parents=True, exist_ok=True)
        model_path = out_dir / f"{self.base_model}.joblib"
        joblib.dump(pipeline, model_path)

        # in-sample sanity metric (held-out numbers come from the benchmark)
        train_acc = float(accuracy_score(labels, pipeline.predict(texts)))

        return TrainResult(
            model_ref=str(model_path),
            train_seconds=round(time.time() - started, 3),
            metrics={
                "train_accuracy": round(train_acc, 4),
                "examples": len(examples),
                "classes": sorted(set(labels)),
                "params": {"ngram_range": [1, 2], "C": 4.0},
            },
        )

    @staticmethod
    def load(model_ref: str) -> SpecialistRouter:
        return SpecialistRouter(joblib.load(model_ref))


class ManagedProviderTrainer:
    """Submits an SFT job to a Together/Fireworks-compatible endpoint.

    Shape-complete but requires FINETUNE_API_KEY + endpoint; offline runs use
    LocalSpecialistTrainer instead.
    """

    def __init__(self, provider: str, base_model: str, api_key: str, base_url: str):
        self.mode = provider  # together | fireworks
        self.base_model = base_model
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")

    async def submit_job(self, dataset_s3_uri: str, suffix: str) -> dict:
        import httpx

        res = await httpx.post(
            f"{self.base_url}/fine_tuning/jobs",
            headers={"authorization": f"Bearer {self.api_key}"},
            json={
                "model": self.base_model,
                "training_file": dataset_s3_uri,
                "method": {"type": "lora"},  # LoRA fine-tune of a small open model
                "suffix": suffix,
            },
            timeout=60.0,
        )
        res.raise_for_status()
        return res.json()

    def train(self, examples: list, out_dir: Path) -> TrainResult:  # pragma: no cover
        raise NotImplementedError(
            "managed jobs are asynchronous; call submit_job() and poll "
            "retrieval endpoints — offline acceptance uses local_specialist"
        )


def make_trainer(cfg):
    if cfg.trainer in ("together", "fireworks"):
        api_key = os.environ.get("FINETUNE_API_KEY", "")
        if not api_key:
            raise SystemExit(f"FINETUNE_TRAINER={cfg.trainer} needs FINETUNE_API_KEY")
        base_url = os.environ.get(
            "FINETUNE_BASE_URL",
            {
                "together": "https://api.together.xyz/v1",
                "fireworks": "https://api.fireworks.ai/inference/v1",
            }[cfg.trainer],
        )
        return ManagedProviderTrainer(cfg.trainer, cfg.managed_base_model, api_key, base_url)
    return LocalSpecialistTrainer(cfg.base_model)


def load_router(model_ref: str) -> Router:
    return LocalSpecialistTrainer.load(model_ref)


def router_prompt() -> str:
    return ROUTER_SYSTEM_PROMPT


def _json_dumps(obj) -> str:
    return json.dumps(obj)
