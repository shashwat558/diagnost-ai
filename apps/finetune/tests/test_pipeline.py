"""Fine-tune pipeline unit tests."""

from __future__ import annotations

from pathlib import Path

from diagnost_finetune.benchmark import evaluate, run_benchmark
from diagnost_finetune.config import load_config
from diagnost_finetune.export_dataset import ROUTER_SYSTEM_PROMPT, stratified_split, to_sft_row, write_sft
from diagnost_finetune.stores import LabeledExample
from diagnost_finetune.trainers import LocalSpecialistTrainer


def _examples(n_per_class: int = 40) -> list[LabeledExample]:
    vocab = {
        "billing_dispute": "charged twice refund payment card invoice",
        "tool_timeout": "gateway timeout request timed out unresponsive",
        "order_status": "order package delivery tracking shipment arrived",
    }
    out: list[LabeledExample] = []
    for intent, words in vocab.items():
        wlist = words.split()
        for i in range(n_per_class):
            text = " ".join(wlist[(i + j) % len(wlist)] for j in range(6))
            out.append(LabeledExample(f"c_{intent}_{i}", intent, text, False))
    return out


def test_split_is_stratified_and_deterministic():
    exs = _examples(20)
    s1 = stratified_split(exs, 0.25, seed=7)
    s2 = stratified_split(exs, 0.25, seed=7)
    assert [e.conversation_id for e in s1.heldout] == [e.conversation_id for e in s2.heldout]

    counts = {}
    for e in s1.heldout:
        counts[e.intent] = counts.get(e.intent, 0) + 1
    assert set(counts.values()) == {5}  # equal per class


def test_sft_row_shape():
    row = to_sft_row(LabeledExample("c1", "billing_dispute", "refund please", True))
    roles = [m["role"] for m in row["messages"]]
    assert roles == ["system", "user", "assistant"]
    assert row["messages"][0]["content"] == ROUTER_SYSTEM_PROMPT
    assert row["messages"][2]["content"] == "billing_dispute"
    assert row["metadata"]["has_error"] is True


def test_write_sft(tmp_path: Path):
    n = write_sft(tmp_path / "ds.jsonl", _examples(3))
    lines = (tmp_path / "ds.jsonl").read_text().strip().splitlines()
    assert n == len(lines) == 9


def test_specialist_trains_and_beats_majority_on_toy(tmp_path: Path):
    # majority class = 33%; a working router must clear it comfortably
    trainer = LocalSpecialistTrainer("test-model")
    result = trainer.train(_examples(40), tmp_path)
    assert result.metrics["train_accuracy"] > 0.9
    assert Path(result.model_ref).exists()

    router = LocalSpecialistTrainer.load(result.model_ref)
    heldout = _examples(8)
    correct = sum(router.predict(e.user_text) == e.intent for e in heldout)
    assert correct / len(heldout) > 0.6


def test_benchmark_reports_and_invariants():
    cfg = load_config()
    cfg_dataclass = type(cfg)(
        **{**cfg.__dict__, "openai_api_key": ""}  # force offline frontier
    )
    trainer = LocalSpecialistTrainer("bench-model")
    out_dir = Path("/tmp/diagnost-finetune-tests")
    trained = trainer.train(_examples(30), out_dir)
    router = LocalSpecialistTrainer.load(trained.model_ref)

    bench = run_benchmark(cfg_dataclass, _examples(10), router)
    frontier = next(c for c in bench.candidates if c.kind == "frontier")
    specialist = next(c for c in bench.candidates if c.kind == "specialist")

    assert specialist.measured_latency and not frontier.measured_latency
    assert specialist.p95_ms < frontier.p95_ms
    assert specialist.cost_per_1k_usd < frontier.cost_per_1k_usd
    assert specialist.accuracy >= frontier.accuracy - 0.05  # toy-data tolerance
    parsed = __import__("json").loads(bench.to_json())
    assert parsed["winner"] in {frontier.name, specialist.name}
