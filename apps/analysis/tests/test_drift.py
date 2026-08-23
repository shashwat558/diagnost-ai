"""Drift engine tests: fires on sustained spikes, stays quiet on flat noise."""

from __future__ import annotations

from datetime import datetime, timedelta

from diagnost_analysis.drift import bucket_conversations, detect_spike, ewma


def _timeline(rates_by_block: list[tuple[int, float]], start=datetime(2026, 1, 1)) -> list:
    items = []
    t = start
    for n, rate in rates_by_block:
        for i in range(n):
            items.append((t, (i / max(n, 1)) < rate))
            t += timedelta(minutes=10)
    return items


def test_fires_on_sustained_spike():
    items = _timeline([(40, 0.10), (40, 0.60)])
    verdict = detect_spike(bucket_conversations(items, 120))
    assert verdict.drifted
    assert verdict.recent_rate > verdict.baseline_rate * 2


def test_quiet_on_flat_noise():
    items = []
    t = datetime(2026, 1, 1)
    for i in range(80):
        # deterministic pseudo-noise around 15%
        failed = (i * 37 % 100) < 15
        items.append((t, failed))
        t += timedelta(minutes=10)
    verdict = detect_spike(bucket_conversations(items, 120))
    assert not verdict.drifted


def test_quiet_on_single_one_off_spike_bucket():
    # one bad bucket in an otherwise flat series must not trip CUSUM:
    # with enough trailing clean buckets the statistic decays below h
    items = _timeline([(30, 0.05), (5, 0.9), (60, 0.05)])
    verdict = detect_spike(bucket_conversations(items, 120))
    assert not verdict.drifted


def test_insufficient_data_is_noop():
    items = _timeline([(4, 0.8)])
    verdict = detect_spike(bucket_conversations(items, 120))
    assert not verdict.drifted
    assert verdict.evidence.get("reason") == "insufficient_data"


def test_ewma_baseline_matches_manual_series():
    s = ewma([0.1, 0.2, 0.3], alpha=0.5)
    assert abs(s[0] - 0.1) < 1e-9
    assert abs(s[1] - (0.5 * 0.2 + 0.5 * 0.1)) < 1e-9
    assert abs(s[2] - (0.5 * 0.3 + 0.5 * s[1])) < 1e-9


def test_buckets_are_ordered_and_counts_add_up():
    items = _timeline([(50, 0.2), (25, 0.7)])
    buckets = bucket_conversations(items, 120)
    assert [b.start for b in buckets] == sorted(b.start for b in buckets)
    assert sum(b.total for b in buckets) == 75
    assert all(b.failures <= b.total for b in buckets)


def test_sparse_cluster_moderate_noise_stays_quiet():
    # ~200-member cluster, 8% baseline vs 15% recent — noise, not drift
    items = []
    t = datetime(2026, 1, 1)
    for i in range(120):
        items.append((t, (i * 37 % 100) < 8))
        t += timedelta(minutes=10)
    for i in range(80):
        items.append((t, (i * 37 % 100) < 15))
        t += timedelta(minutes=10)
    verdict = detect_spike(bucket_conversations(items, 120))
    assert not verdict.drifted


def test_dense_cluster_genuine_ramp_fires():
    items = _timeline([(60, 0.15), (40, 0.9)])
    verdict = detect_spike(bucket_conversations(items, 120))
    assert verdict.drifted
    assert verdict.evidence.get("z", 0) >= 3
