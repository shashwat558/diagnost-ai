"""Conversation clustering: TF-IDF top-term extraction + HDBSCAN."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np


@dataclass
class ClusterResult:
    labels: np.ndarray  # per-conversation cluster id, -1 = noise
    probabilities: np.ndarray
    n_clusters: int


def run_hdbscan(
    embeddings: np.ndarray,
    min_cluster_size: int = 25,
    min_samples: int = 5,
    selection_epsilon: float = 0.08,
) -> ClusterResult:
    import hdbscan  # heavy import deferred

    if len(embeddings) < max(min_cluster_size * 2, 10):
        return ClusterResult(
            labels=np.full(len(embeddings), -1, dtype=int),
            probabilities=np.zeros(len(embeddings)),
            n_clusters=0,
        )
    clusterer = hdbscan.HDBSCAN(
        min_cluster_size=min_cluster_size,
        min_samples=min_samples,
        metric="euclidean",
        # eom keeps dense regions whole; epsilon merges sibling branches that
        # split along template phrasing so one failure pattern stays one cluster
        cluster_selection_method="eom",
        cluster_selection_epsilon=selection_epsilon,
    )
    labels = clusterer.fit_predict(embeddings)
    probs = getattr(clusterer, "probabilities_", np.ones(len(embeddings)))
    return ClusterResult(
        labels=labels,
        probabilities=probs,
        n_clusters=len(set(labels) - {-1}),
    )


def top_terms(texts: list[str], all_texts: list[str], k: int = 10) -> list[str]:
    """Most discriminative terms for a cluster vs. everything else (TF-IDF delta)."""
    from collections import Counter

    from sklearn.feature_extraction.text import TfidfVectorizer

    if not texts or not all_texts:
        return []
    try:
        vec = TfidfVectorizer(max_features=2048, stop_words="english", token_pattern=r"[a-zA-Z']{3,}")
        vec.fit(all_texts)
        vocab = vec.get_feature_names_out()
        in_vec = vec.transform(texts).mean(axis=0).A1
        rest = [t for t in all_texts if t not in set(texts)] or all_texts
        out_vec = vec.transform(rest[:4000]).mean(axis=0).A1
        delta = in_vec - out_vec
        order = np.argsort(delta)[::-1][:k]
        return [str(vocab[i]) for i in order if delta[i] > 0]
    except Exception:
        # degenerate corpora — fall back to raw frequency
        counter: Counter[str] = Counter()
        for t in texts:
            for tok in t.lower().split():
                if len(tok) >= 4:
                    counter[tok] += 1
        return [w for w, _ in counter.most_common(k)]
