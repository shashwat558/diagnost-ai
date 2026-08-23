"""Unit tests for embedding determinism and topic separation."""

from __future__ import annotations

import numpy as np

from diagnost_analysis.embeddings import HashingEmbedder


def test_deterministic_across_calls():
    e = HashingEmbedder(dim=64)
    a1 = e.embed_batch(["gateway timeout while processing refund"])[0]
    a2 = e.embed_batch(["gateway timeout while processing refund"])[0]
    assert a1 == a2


def test_same_topic_more_similar_than_different_topic():
    e = HashingEmbedder(dim=128)
    a = e.embed_batch(["payment gateway timeout during billing lookup"])[0]
    b = e.embed_batch(["gateway timed out on refund charge attempt"])[0]
    c = e.embed_batch(["how do I reset my account password"])[0]
    va, vb, vc = np.array(a), np.array(b), np.array(c)
    assert float(va @ vb) > float(va @ vc)


def test_l2_normalized():
    e = HashingEmbedder(dim=64)
    v = np.array(e.embed_batch(["some reasonably long text about orders and shipments"])[0])
    assert abs(float(np.linalg.norm(v)) - 1.0) < 1e-6


def test_empty_text_is_zero_vector():
    e = HashingEmbedder(dim=32)
    v = e.embed_batch([""])[0]
    assert sum(abs(x) for x in v) == 0.0


def test_batch_shapes():
    e = HashingEmbedder(dim=48)
    out = e.embed_batch(["a b c", "d e f", ""])
    assert len(out) == 3 and all(len(v) == 48 for v in out)
