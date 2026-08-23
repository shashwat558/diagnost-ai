"""Judge labeling tests — intent mapping and bounded scores."""

from __future__ import annotations

from diagnost_analysis.judge import ClusterInput, RuleBasedJudge


def test_billing_intent_from_terms():
    j = RuleBasedJudge()
    label = j.label_cluster(
        ClusterInput(
            cluster_id="cl_x",
            texts=["I was charged twice, want a refund", "billing dispute on my card"],
            top_terms=["refund", "charged", "card"],
            error_rate=0.4,
        )
    )
    assert label.intent == "billing_dispute"
    assert -1.0 <= label.sentiment <= 1.0
    assert 0.0 <= label.frustration <= 1.0


def test_tool_timeout_intent():
    j = RuleBasedJudge()
    label = j.label_cluster(
        ClusterInput(
            cluster_id="cl_y",
            texts=["payment gateway timeout again", "request timed out"],
            top_terms=["timeout", "gateway"],
            error_rate=0.9,
        )
    )
    assert label.intent == "tool_timeout"
    # high error rate must push frustration up
    assert label.frustration >= 0.5


def test_frustration_reflects_error_rate():
    j = RuleBasedJudge()
    low = j.label_cluster(ClusterInput("c", ["order status please"], ["order"], 0.0))
    high = j.label_cluster(ClusterInput("c", ["order status please"], ["order"], 1.0))
    assert high.frustration > low.frustration


def test_summary_mentions_size():
    j = RuleBasedJudge()
    label = j.label_cluster(
        ClusterInput("c", ["text"] * 7, ["term"], 0.1),
    )
    assert "7" in label.summary


def test_negative_lexicon_drives_sentiment_down():
    j = RuleBasedJudge()
    label = j.label_cluster(
        ClusterInput("c", ["this is broken and useless, terrible experience"], ["broken"], 0.5)
    )
    assert label.sentiment < 0
