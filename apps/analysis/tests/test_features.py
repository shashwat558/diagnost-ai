"""Feature-request extractor tests."""

from __future__ import annotations

from diagnost_analysis.features import RuleBasedFeatureJudge


def test_csv_export_detected():
    j = RuleBasedFeatureJudge()
    hits = j.extract("The agent was helpful. Can you add CSV export of chat transcripts?")
    assert [h.slug for h in hits] == ["csv_export"]


def test_slack_integration_detected():
    j = RuleBasedFeatureJudge()
    hits = j.extract("Does it support Slack integration for our team channel?")
    assert [h.slug for h in hits] == ["slack_integration"]


def test_dark_mode_detected():
    j = RuleBasedFeatureJudge()
    hits = j.extract("Would be nice if it had dark mode for night shifts.")
    assert [h.slug for h in hits] == ["dark_mode"]


def test_repeated_mention_counts_once_per_conversation():
    j = RuleBasedFeatureJudge()
    text = "Can you add CSV export? Also is there a way to export to csv from the UI?"
    hits = j.extract(text)
    assert len([h for h in hits if h.slug == "csv_export"]) == 1


def test_non_request_questions_ignored():
    j = RuleBasedFeatureJudge()
    hits = j.extract("Where is my order #8817? It should have arrived yesterday.")
    assert hits == []


def test_unknown_request_gets_derived_slug():
    j = RuleBasedFeatureJudge()
    hits = j.extract("I wish it could transcribe voicemail messages automatically")
    assert len(hits) == 1
    assert hits[0].slug.startswith("req_")


def test_multiple_requests_in_one_conversation():
    j = RuleBasedFeatureJudge()
    text = (
        "Please add Slack integration. Also would be nice to have dark mode, "
        "and can you support webhooks?"
    )
    slugs = {h.slug for h in j.extract(text)}
    assert {"slack_integration", "dark_mode", "webhooks_api"} <= slugs


def test_description_is_trimmed_sentence():
    j = RuleBasedFeatureJudge()
    hits = j.extract("Long preamble. " + "x" * 300 + " Is there a way to export conversations to CSV?")
    assert all(len(h.description) <= 160 for h in hits)
