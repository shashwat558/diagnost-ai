"""Statistical drift detection over per-cluster failure rates.

EWMA provides the smoothed baseline; CUSUM on the residuals of the second
half of the window detects sustained upward shifts. Cheap, explainable, and
runs before any LLM is involved — the judge labels WHAT broke, the control
chart decides WHEN it broke.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import datetime, timedelta


@dataclass
class Bucket:
    """Failure rate for one time bucket: failures / total."""

    start: datetime
    total: int = 0
    failures: int = 0

    @property
    def rate(self) -> float:
        return self.failures / self.total if self.total else 0.0


@dataclass
class DriftVerdict:
    drifted: bool
    baseline_rate: float
    recent_rate: float
    cusum: float
    threshold: float
    evidence: dict = field(default_factory=dict)


def bucket_conversations(
    items: list[tuple[datetime, bool]],
    bucket_minutes: int,
) -> list[Bucket]:
    """items: (timestamp, failed). Returns ordered, gap-free-ish buckets."""
    if not items:
        return []
    step = timedelta(minutes=bucket_minutes)
    ordered = sorted(items)
    buckets: list[Bucket] = []
    current: Bucket | None = None
    for ts, failed in ordered:
        start = ts.replace(minute=(ts.minute // bucket_minutes) * bucket_minutes % 60,
                           second=0, microsecond=0)
        # normalize hours too when bucket >= 60min
        if bucket_minutes >= 60:
            hours = bucket_minutes // 60
            start = start.replace(hour=(start.hour // hours) * hours)
        if current is None or start > current.start:
            current = Bucket(start=start)
            buckets.append(current)
        current.total += 1
        current.failures += int(failed)
    return buckets


def ewma(values: list[float], alpha: float) -> list[float]:
    """Standard EWMA series; s_0 = first observation."""
    out: list[float] = []
    s: float | None = None
    for v in values:
        s = v if s is None else alpha * v + (1 - alpha) * s
        out.append(s)
    return out


def detect_spike(
    buckets: list[Bucket],
    lambda_: float = 0.3,
    cusum_k: float = 0.05,
    cusum_h_factor: float = 5.0,
    min_total: int = 30,
    min_buckets: int = 6,
    z_gate: float = 3.0,
    min_delta: float = 0.10,
    min_avg_bucket_n: float = 10.0,
) -> DriftVerdict:
    """Split the window in half; fire when ALL gates hold:

    1. **Volume**: enough data overall AND per-bucket (avg n ≥ ``min_avg_bucket_n``).
       Sparse clusters get adaptive upstream bucketing; this is the backstop.
    2. **Significance**: two-proportion z-test between halves exceeds ``z_gate``
       AND absolute lift ≥ ``min_delta``.
    3. **Control chart**: CUSUM of positive deviations crossed its threshold —
       confirming the rise was *sustained*, not a one-off clump.

    Full series ships as evidence for explainability.
    """
    total = sum(b.total for b in buckets)
    if total < min_total or len(buckets) < min_buckets:
        return DriftVerdict(False, 0.0, 0.0, 0.0, 0.0, {"reason": "insufficient_data", "total": total})

    avg_n = total / len(buckets)
    if avg_n < min_avg_bucket_n:
        return DriftVerdict(
            False, 0.0, 0.0, 0.0, 0.0,
            {"reason": "sparse_cluster", "total": total, "buckets": len(buckets),
             "avg_bucket_n": round(avg_n, 2)},
        )

    rates = [b.rate for b in buckets]
    split = len(buckets) // 2
    baseline_buckets = buckets[:split]
    recent_buckets = buckets[split:]

    n1 = sum(b.total for b in baseline_buckets)
    f1 = sum(b.failures for b in baseline_buckets)
    n2 = sum(b.total for b in recent_buckets)
    f2 = sum(b.failures for b in recent_buckets)

    # pooled proportion — unbiased under unequal bucket counts (EWMA-of-rates
    # lets early low-volume zero-buckets drag the baseline artificially low)
    baseline_rate = f1 / n1 if n1 else 0.0
    recent_rate = f2 / n2 if n2 else 0.0

    # ── gate 1: two-proportion z ──────────────────────────────────
    if n1 == 0 or n2 == 0:
        return DriftVerdict(False, round(baseline_rate, 4), round(recent_rate, 4), 0.0, 0.0,
                            {"reason": "empty_half"})
    pooled = (f1 + f2) / (n1 + n2)
    se = math.sqrt(max(pooled * (1 - pooled) * (1 / n1 + 1 / n2), 1e-12))
    z_score = ((recent_rate - baseline_rate) / se) if se > 0 else 0.0
    delta = recent_rate - baseline_rate
    significant = z_score >= z_gate and delta >= min_delta
    if not significant:
        return DriftVerdict(
            False,
            round(baseline_rate, 4),
            round(recent_rate, 4),
            0.0,
            0.0,
            {
                "reason": "not_significant",
                "z": round(z_score, 3),
                "delta": round(delta, 4),
                "required_z": z_gate,
                "required_delta": min_delta,
            },
        )

    # ── gate 2: CUSUM confirms persistence ────────────────────────
    p = min(max(baseline_rate, 1e-3), 1 - 1e-3)
    sigma = math.sqrt(p * (1 - p) / n1)
    h = cusum_h_factor * sigma + 2 * cusum_k

    cusum_pos = 0.0
    trajectory: list[float] = []
    for r in rates[split:]:
        cusum_pos = max(0.0, cusum_pos + (r - baseline_rate - cusum_k))
        trajectory.append(round(cusum_pos, 4))

    return DriftVerdict(
        drifted=cusum_pos >= h,
        baseline_rate=round(baseline_rate, 4),
        recent_rate=round(recent_rate, 4),
        cusum=round(cusum_pos, 4),
        threshold=round(h, 4),
        evidence={
            "z": round(z_score, 3),
            "delta": round(delta, 4),
            "n_baseline": n1,
            "n_recent": n2,
            "buckets": [
                {
                    "start": b.start.isoformat(),
                    "total": b.total,
                    "failures": b.failures,
                    "rate": round(b.rate, 4),
                }
                for b in buckets
            ],
            "cusum_trajectory": trajectory,
            "params": {
                "lambda": lambda_,
                "k": cusum_k,
                "h": round(h, 4),
                "sigma": round(sigma, 4),
                "z_gate": z_gate,
                "min_delta": min_delta,
            },
        },
    )
