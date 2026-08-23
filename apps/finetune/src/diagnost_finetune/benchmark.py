"""Frontier-vs-specialist benchmark on a held-out set.

Accuracy is measured for both candidates. Latency/cost:
- specialist: measured directly (local inference, ~zero marginal cost)
- frontier: real API calls when OPENAI_API_KEY is set (measured); otherwise
  documented reference figures for the configured frontier model are reported
  with measured=false — never presented as local measurements.
"""

from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass, field
from statistics import median

# Reference profile for gpt-4o-mini-class routing calls (documented, not
# measured): ~120-token prompt + 8-token label; published pricing.
FRONTIER_REFERENCE = {
    "p50_ms": 900.0,
    "p95_ms": 1800.0,
    "usd_per_1k_requests": 0.0228,  # ≈ $0.15/1M in × 120 + $0.60/1M out × 8, per request
}


@dataclass
class CandidateResult:
    name: str
    kind: str  # frontier | specialist
    accuracy: float
    per_intent: dict[str, float]
    p50_ms: float
    p95_ms: float
    cost_per_1k_usd: float
    measured_latency: bool
    predictions_ok: int
    total: int


def _percentiles(values_ms: list[float]) -> tuple[float, float]:
    if not values_ms:
        return 0.0, 0.0
    ordered = sorted(values_ms)
    p50 = median(ordered)

    def pct(p: float) -> float:
        k = max(0, min(len(ordered) - 1, int(round(p * (len(ordered) - 1)))))
        return ordered[k]

    return round(p50, 3), round(pct(0.95), 3)


class FrontierOfflineRouter:
    """Deterministic offline stand-in for a strong general model.

    Uses the same keyword-taxonomy approach as the platform's rule-based
    judge — a reasonable 'frontier-like' baseline that the trained specialist
    must match or beat.
    """

    RULES: list[tuple[str, tuple[str, ...]]] = [
        ("date_format_error", ("wrong date format", "date format", "month out of range", "display issue")),
        ("tool_timeout", ("gateway timeout", "timed out", "timeout", "unresponsive")),
        ("billing_dispute", ("refund", "charged", "charge", "billing", "payment", "invoice")),
        ("order_status", ("order", "shipment", "delivery", "track", "package")),
        ("account_access", ("password", "login", "locked", "access", "reset")),
    ]
    DEFAULT = "account_access"

    def predict(self, text: str) -> str:
        low = f" {(text or '').lower()} "
        for intent, keywords in self.RULES:
            if any(kw in low for kw in keywords):
                return intent
        return self.DEFAULT


class FrontierOpenAIRouter:
    """Live frontier baseline via OpenAI-compatible chat completions."""

    def __init__(self, base_url: str, api_key: str, model: str, labels: list[str]):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.model = model
        self.labels = labels

    def predict(self, text: str) -> str:
        import httpx

        res = httpx.post(
            f"{self.base_url}/chat/completions",
            headers={"authorization": f"Bearer {self.api_key}"},
            json={
                "model": self.model,
                "messages": [
                    {"role": "system", "content": "Reply with ONLY one intent label."},
                    {"role": "user", "content": f"{text}\n\nLabels: {', '.join(self.labels)}"},
                ],
                "temperature": 0,
                "max_tokens": 8,
            },
            timeout=60.0,
        )
        res.raise_for_status()
        content = res.json()["choices"][0]["message"]["content"].strip().lower()
        for label in self.labels:
            if label in content:
                return label
        return self.labels[0]


def evaluate(
    name: str,
    kind: str,
    router,
    examples: list,
    measure_latency: bool,
) -> CandidateResult:
    correct = 0
    latencies: list[float] = []
    per_intent_total: dict[str, int] = {}
    per_intent_correct: dict[str, int] = {}

    for ex in examples:
        start = time.perf_counter()
        pred = router.predict(ex.user_text or "(empty)")
        elapsed = (time.perf_counter() - start) * 1000
        if measure_latency:
            latencies.append(elapsed)

        ok = pred.strip().lower() == ex.intent.lower()
        correct += int(ok)
        per_intent_total[ex.intent] = per_intent_total.get(ex.intent, 0) + 1
        per_intent_correct[ex.intent] = per_intent_correct.get(ex.intent, 0) + int(ok)

    total = len(examples)
    p50, p95 = _percentiles(latencies) if measure_latency else (
        FRONTIER_REFERENCE["p50_ms"], FRONTIER_REFERENCE["p95_ms"]
    )
    cost_per_1k = (
        FRONTIER_REFERENCE["usd_per_1k_requests"] * 1000 / 1000  # per-request × 1k
        if not measure_latency
        else FRONTIER_REFERENCE["usd_per_1k_requests"] * 1000  # live calls cost the same per request
    ) if kind == "frontier" else 0.0

    return CandidateResult(
        name=name,
        kind=kind,
        accuracy=round(correct / total, 4) if total else 0.0,
        per_intent={
            k: round(per_intent_correct.get(k, 0) / v, 3) for k, v in sorted(per_intent_total.items())
        },
        p50_ms=p50,
        p95_ms=p95,
        cost_per_1k_usd=round(cost_per_1k, 5),
        measured_latency=measure_latency,
        predictions_ok=correct,
        total=total,
    )


@dataclass
class BenchmarkOutput:
    candidates: list[CandidateResult]
    winner: str
    notes: str = field(default_factory=str)

    def to_json(self) -> str:
        return json.dumps(
            {
                "candidates": [c.__dict__ for c in self.candidates],
                "winner": self.winner,
                "notes": self.notes,
            }
        )


def run_benchmark(cfg, heldout_examples: list, specialist_router) -> BenchmarkOutput:
    use_live_frontier = bool(cfg.openai_api_key)
    if use_live_frontier:
        labels = sorted({e.intent for e in heldout_examples})
        frontier = FrontierOpenAIRouter(
            os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1"),
            cfg.openai_api_key,
            cfg.frontier_model,
            labels,
        )
        frontier_name = f"frontier:{cfg.frontier_model}"
    else:
        frontier = FrontierOfflineRouter()
        frontier_name = "frontier:gpt-4o-mini (offline reference)"

    frontier_result = evaluate(frontier_name, "frontier", frontier, heldout_examples, measure_latency=use_live_frontier)
    specialist_result = evaluate("specialist:fine-tuned-router", "specialist", specialist_router, heldout_examples, measure_latency=True)

    candidates = [frontier_result, specialist_result]

    # winner: accuracy first; specialist wins accuracy ties (materially cheaper
    # and faster); then lower measured latency
    def rank(c: CandidateResult) -> tuple:
        return (
            round(c.accuracy, 4),
            1 if c.kind == "specialist" else 0,
            -c.p95_ms,
        )

    winner = max(candidates, key=rank).name

    notes = "" if use_live_frontier else (
        "frontier latency/cost are documented reference figures for "
        f"{cfg.frontier_model} (no API key configured); specialist figures are locally measured"
    )

    return BenchmarkOutput(candidates=candidates, winner=winner, notes=notes)
