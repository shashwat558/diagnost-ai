"""Embedding providers — deterministic offline default, OpenAI-compatible remote."""

from __future__ import annotations

import hashlib
import math
import re
from typing import Protocol

_TOKEN_RE = re.compile(r"[a-z0-9']{3,}")


class EmbeddingProvider(Protocol):
    mode: str

    def embed_batch(self, texts: list[str]) -> list[list[float]]: ...


def _tokens(text: str) -> list[str]:
    return _TOKEN_RE.findall(text.lower())


class HashingEmbedder:
    """Feature-hashing embedding: deterministic, dependency-free, offline.

    Each token contributes a signed unit vector at hashed positions (token and
    bigram channels). Not semantically deep, but stable and fast — clusters
    formed from it are driven by shared vocabulary, which is exactly what the
    seeded failure patterns exercise. Swap to `OpenAIEmbedder` for semantic
    quality in production.
    """

    def __init__(self, dim: int = 256):
        self.dim = dim
        self.mode = "mock"

    @staticmethod
    def _slot(token: str) -> tuple[int, float]:
        digest = hashlib.sha1(token.encode()).digest()
        idx = int.from_bytes(digest[:4], "little") % 2**32
        sign = 1.0 if digest[4] % 2 == 0 else -1.0
        return idx, sign

    def _one(self, text: str) -> list[float]:
        vec = [0.0] * self.dim
        toks = _tokens(text)
        channels: list[str] = []
        channels.extend(toks)
        channels.extend(f"{a}_{b}" for a, b in zip(toks, toks[1:]))
        weights: dict[int, float] = {}
        for ch in channels:
            idx, sign = self._slot(ch)
            pos = idx % self.dim
            # sublinear tf
            weights[pos] = weights.get(pos, 0.0) + sign
        norm = math.sqrt(sum(w * w for w in weights.values())) or 1.0
        for pos, w in weights.items():
            vec[pos] = w / norm
        return vec

    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        return [self._one(t) for t in texts]


class OpenAIEmbedder:
    """OpenAI-compatible embeddings endpoint (set EMBEDDING_PROVIDER=openai)."""

    def __init__(self, base_url: str, api_key: str, model: str = "text-embedding-3-small"):
        import httpx  # local import keeps offline path dependency-light

        self.mode = "openai"
        self.model = model
        self._client = httpx.Client(
            base_url=base_url.rstrip("/"),
            headers={"authorization": f"Bearer {api_key}"},
            timeout=60.0,
        )

    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        res = self._client.post(
            "/embeddings",
            json={"model": self.model, "input": [t[:8000] for t in texts]},
        )
        res.raise_for_status()
        data = res.json()["data"]
        return [item["embedding"] for item in sorted(data, key=lambda d: d["index"])]


def make_embedder(cfg) -> EmbeddingProvider:
    if cfg.embedding_provider == "openai" and cfg.openai_api_key:
        return OpenAIEmbedder(cfg.openai_base_url, cfg.openai_api_key)
    return HashingEmbedder(dim=cfg.embedding_dim)
