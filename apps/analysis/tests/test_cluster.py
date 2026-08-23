"""Clustering tests with synthetic separable data."""

from __future__ import annotations

import numpy as np

from diagnost_analysis.cluster import run_hdbscan, top_terms


def _blobs(n_per: int = 60, k: int = 3, dim: int = 32, spread=2.0):
    rng = np.random.default_rng(42)
    centers = rng.normal(0, 10, size=(k, dim))
    xs, ys = [], []
    for ci in range(k):
        pts = centers[ci] + rng.normal(0, spread, size=(n_per, dim))
        xs.append(pts)
        ys.extend([ci] * n_per)
    return np.vstack(xs), np.array(ys)


def test_recovers_all_three_blobs():
    X, y = _blobs()
    res = run_hdbscan(X, min_cluster_size=25, min_samples=5)
    assert res.n_clusters == 3
    # every point assigned to a cluster whose majority ground-truth matches
    for cid in set(res.labels):
        mask = res.labels == cid
        assert len(set(y[mask])) == 1 or mask.sum() < len(y) * 0.05


def test_too_small_input_yields_noise():
    res = run_hdbscan(np.random.default_rng(0).normal(size=(8, 16)), min_cluster_size=25)
    assert res.n_clusters == 0 and (res.labels == -1).all()


def test_top_terms_are_discriminative():
    all_texts = (
        ["payment gateway timeout during charge"] * 30
        + ["reset my account password please"] * 30
        + ["track my order shipment status"] * 30
    )
    terms = top_terms(all_texts[:30], all_texts, k=3)
    joined = " ".join(terms)
    assert any(w in joined for w in ("gateway", "timeout", "charge", "payment"))
