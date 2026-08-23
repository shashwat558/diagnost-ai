"""LLM-judge labeling — deterministic rule-based default, OpenAI-compatible remote."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Protocol

NEGATIVE_LEXICON = {
    "wrong", "broken", "fail", "failed", "failing", "error", "timeout", "useless",
    "angry", "frustrated", "frustrating", "annoyed", "terrible", "awful", "bad",
    "again", "still", "cannot", "can't", "not working", "doesn't work", "didn't",
    "complain", "unacceptable", "ridiculous", "waste",
}

POSITIVE_LEXICON = {"thanks", "thank", "great", "perfect", "works", "solved", "helpful", "nice"}


@dataclass
class JudgeLabel:
    intent: str
    summary: str
    sentiment: float  # -1..1
    frustration: float  # 0..1


@dataclass
class ClusterInput:
    cluster_id: str
    texts: list[str]
    top_terms: list[str] = field(default_factory=list)
    error_rate: float = 0.0


class JudgeProvider(Protocol):
    mode: str

    def label_cluster(self, cluster: ClusterInput) -> JudgeLabel: ...


# Intent taxonomy used by the offline judge, ordered most-specific first:
# a cluster mentioning "gateway timeout" is tool_timeout even if it also says
# "charged"/"payment" — generic vocab must not outvote signature vocabulary.
INTENT_RULES: list[tuple[str, list[str]]] = [
    ("date_format_error", ["wrong date format", "date format", "month out of range", "2026-13"]),
    ("tool_timeout", ["gateway timeout", "timed out", "timeout", "unresponsive", "retry later"]),
    ("billing_dispute", ["refund", "charged", "charge", "billing", "payment", "invoice", "card"]),
    ("order_status", ["order", "shipment", "delivery", "track", "package", "arrived"]),
    ("account_access", ["password", "login", "signin", "locked", "access", "reset"]),
    ("general_inquiry", []),
]

_NEG_RE = re.compile(r"\b(" + "|".join(re.escape(w) for w in NEGATIVE_LEXICON) + r")\b")
_POS_RE = re.compile(r"\b(" + "|".join(re.escape(w) for w in POSITIVE_LEXICON) + r")\b")


class RuleBasedJudge:
    """Offline stand-in for the LLM judge.

    Labels intent by matching top cluster terms against the taxonomy,
    sentiment/frustration from lexicon density blended with observed error rate.
    Deterministic and explainable; swap to OpenAIJudge for production nuance.
    """

    mode = "mock"

    def label_cluster(self, cluster: ClusterInput) -> JudgeLabel:
        corpus = " ".join(cluster.texts[:200]).lower()
        terms = [t.lower() for t in cluster.top_terms[:12]] + _tokens(corpus)[:80]

        # first specific rule with any keyword evidence wins; generic intents
        # only apply when nothing more specific matched
        best_intent, best_score = "general_inquiry", 0
        for intent, keywords in INTENT_RULES:
            if not keywords:
                break
            score = sum(1 for kw in keywords if any(kw in t or kw in corpus for t in terms))
            if score > 0:
                best_intent, best_score = intent, score
                break

        neg = len(_NEG_RE.findall(corpus))
        pos = len(_POS_RE.findall(corpus))
        total = max(neg + pos, 1)
        sentiment = max(-1.0, min(1.0, (pos - neg) / total))
        frustration = max(0.0, min(1.0, 0.5 * (neg / total) + 0.5 * cluster.error_rate))

        size = len(cluster.texts)
        summary = (
            f"{size} conversations about {best_intent.replace('_', ' ')}; "
            f"top signals: {', '.join(cluster.top_terms[:5])}; "
            f"error rate {cluster.error_rate:.0%}."
        )
        return JudgeLabel(
            intent=best_intent,
            summary=summary,
            sentiment=round(sentiment, 3),
            frustration=round(frustration, 3),
        )


def _tokens(text: str) -> list[str]:
    return re.compile(r"[a-z0-9']{3,}").findall(text)


class OpenAIJudge:
    """OpenAI-compatible chat completion judge (set OPENAI_API_KEY)."""

    mode = "openai"

    def __init__(self, base_url: str, api_key: str, model: str):
        self.model = model
        self._base_url = base_url.rstrip("/")
        self._api_key = api_key

    def _post(self, payload: dict) -> dict:
        import httpx

        res = httpx.post(
            f"{self._base_url}/chat/completions",
            headers={"authorization": f"Bearer {self._api_key}"},
            json=payload,
            timeout=90.0,
        )
        res.raise_for_status()
        return res.json()

    def label_cluster(self, cluster: ClusterInput) -> JudgeLabel:
        sample = "\n---\n".join(t[:400] for t in cluster.texts[:25])
        prompt = (
            "You analyze clusters of AI-agent conversations.\n"
            f"Cluster id: {cluster.cluster_id}\n"
            f"Top terms: {', '.join(cluster.top_terms)}\n"
            f"Error rate: {cluster.error_rate:.2f}\n"
            f"Sample conversations:\n{sample}\n\n"
            'Return ONLY JSON: {"intent": "<snake_case>", "summary": "<one sentence>",'
            ' "sentiment": <-1..1>, "frustration": <0..1>}'
        )
        data = self._post(
            {
                "model": self.model,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0,
                "response_format": {"type": "json_object"},
            }
        )
        raw = data["choices"][0]["message"]["content"]
        parsed = json.loads(raw)
        return JudgeLabel(
            intent=str(parsed.get("intent", "unknown"))[:64],
            summary=str(parsed.get("summary", ""))[:500],
            sentiment=float(max(-1.0, min(1.0, parsed.get("sentiment", 0)))),
            frustration=float(max(0.0, min(1.0, parsed.get("frustration", 0)))),
        )


def make_judge(cfg) -> JudgeProvider:
    if cfg.llm_provider == "openai" and cfg.openai_api_key:
        return OpenAIJudge(cfg.openai_base_url, cfg.openai_api_key, cfg.llm_model)
    return RuleBasedJudge()
