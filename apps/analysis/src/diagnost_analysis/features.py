"""Feature-request extraction: tag 'user asked for X we don't support' signals.

Two-tier design mirroring the rest of the platform:
- offline rule-based detector (cues + slug dictionary) — deterministic, free
- OpenAI-compatible LLM path when keys are configured

Hits aggregate into `feature_requests` keyed by (workspace, slug); frequency
counts CONVERSATIONS mentioning the request, never raw mentions.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class FeatureHit:
    slug: str
    description: str


class FeatureJudge(Protocol):
    mode: str

    def extract(self, text: str) -> list[FeatureHit]: ...


CUE_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"can you (?:please )?(?:add|support|integrate|build|implement)", re.I),
    re.compile(r"(?:does|do) (?:it|this|the agent|you) support", re.I),
    re.compile(r"i wish (?:it |this |you )?(?:could|would|had|supported)", re.I),
    re.compile(r"would be nice (?:if|to have|to)", re.I),
    re.compile(r"it would be great if", re.I),
    re.compile(r"any chance (?:of|you)", re.I),
    re.compile(r"why can'?t (?:it|this|you)", re.I),
    re.compile(r"is there a way to", re.I),
    re.compile(r"please add", re.I),
    re.compile(r"we (?:really )?need", re.I),
    re.compile(r"feature request", re.I),
)

# canonical slugs: signature keyword groups; first match wins
SLUG_RULES: list[tuple[str, tuple[str, ...]]] = [
    ("slack_integration", ("slack",)),
    ("csv_export", ("csv", "export")),
    ("dark_mode", ("dark mode", "dark theme")),
    ("webhooks_api", ("webhook", "public api", "rest api")),
    ("sso_login", ("single sign-on", " sso ", "saml")),
    ("multilingual", ("multilingual", "other languages", "in german", "spanish")),
]

_SENT_SPLIT = re.compile(r"(?<=[.!?\n])\s+")


def _slug_for(sentence: str) -> str | None:
    low = f" {sentence.lower()} "
    for slug, keywords in SLUG_RULES:
        if any(kw in low for kw in keywords):
            return slug
    return None


def _matched_slugs(sentence: str) -> list[str]:
    low = f" {sentence.lower()} "
    return [
        slug for slug, keywords in SLUG_RULES
        if any(kw in low for kw in keywords)
    ]


def _slug_for_sentence(sentence: str, slug: str) -> str:
    return sentence


def _clean(sentence: str) -> str:
    return re.sub(r"\s+", " ", sentence).strip()


def _fallback_slug(text: str) -> str | None:
    """Derive a stable pseudo-slug from salient words for unmapped requests."""
    stop = {
        "the", "and", "for", "with", "that", "this", "have", "has", "can",
        "you", "our", "are", "was", "but", "not", "how", "what", "when",
        "agent", "assistant", "chatbot", "bot", "please", "would", "could",
        "there", "way", "support", "add", "need", "want", "nice",
    }
    words = [
        w for w in re.findall(r"[a-z]{4,}", text.lower())
        if w not in stop
    ]
    if not words:
        return None
    return "req_" + "_".join(words[:2])


class RuleBasedFeatureJudge:
    """Deterministic offline extractor: sentence-level cue matching."""

    mode = "mock"

    def extract(self, text: str) -> list[FeatureHit]:
        hits: dict[str, FeatureHit] = {}
        for sentence in _SENT_SPLIT.split(text):
            cleaned = _clean(sentence)
            if len(cleaned) < 8 or not any(cue.search(cleaned) for cue in CUE_PATTERNS):
                continue
            # compound sentences may carry several requests — match all slugs
            matched = [
                (slug, _slug_for_sentence(cleaned, slug))
                for slug in _matched_slugs(cleaned)
            ]
            if matched:
                for slug, desc in matched:
                    if slug not in hits:
                        hits[slug] = FeatureHit(slug=slug, description=desc[:160])
                continue
            fallback = _fallback_slug(cleaned)
            if fallback and fallback not in hits:
                hits[fallback] = FeatureHit(slug=fallback, description=cleaned[:160])
        return list(hits.values())


class OpenAIFeatureJudge:
    """LLM-based extraction (set OPENAI_API_KEY + FEATURE_JUDGE=openai)."""

    mode = "openai"

    SYSTEM_PROMPT = (
        "You detect product feature requests inside AI-agent support "
        "conversations. A feature request is an explicit ask for something "
        "unsupported ('can you add X', 'I wish it did Y'). Ignore questions "
        "about existing features. Return ONLY JSON: "
        '{"requests":[{"slug":"short_snake_case_name","description":"one sentence"}]}.'
    )

    def __init__(self, base_url: str, api_key: str, model: str):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.model = model

    def extract(self, text: str) -> list[FeatureHit]:
        import httpx

        res = httpx.post(
            f"{self.base_url}/chat/completions",
            headers={"authorization": f"Bearer {self.api_key}"},
            json={
                "model": self.model,
                "messages": [
                    {"role": "system", "content": self.SYSTEM_PROMPT},
                    {"role": "user", "content": text[:6000]},
                ],
                "temperature": 0,
                "response_format": {"type": "json_object"},
            },
            timeout=60.0,
        )
        res.raise_for_status()
        import json as _json

        parsed = _json.loads(res.json()["choices"][0]["message"]["content"])
        out = []
        for item in parsed.get("requests", []):
            slug = re.sub(r"[^a-z0-9_]+", "_", str(item.get("slug", "")).lower()).strip("_")
            if slug:
                out.append(FeatureHit(slug=slug, description=str(item.get("description", ""))[:160]))
        return out


def make_feature_judge(cfg) -> FeatureJudge:
    if getattr(cfg, "llm_provider", "mock") == "openai" and cfg.openai_api_key:
        return OpenAIFeatureJudge(cfg.openai_base_url, cfg.openai_api_key, cfg.llm_model)
    return RuleBasedFeatureJudge()
