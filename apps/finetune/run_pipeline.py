#!/usr/bin/env python3
"""Phase 5 pipeline: export → train → benchmark → persist.

Run:  apps/finetune/.venv/bin/python apps/finetune/run_pipeline.py
"""
import asyncio
import json
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "src"))

from diagnost_finetune.benchmark import run_benchmark
from diagnost_finetune.config import load_config
from diagnost_finetune.export_dataset import dataset_id_for, stratified_split, upload_to_s3, write_sft
from diagnost_finetune.stores import Stores
from diagnost_finetune.trainers import load_router, make_trainer


def main() -> None:
    cfg = load_config()
    stores = Stores(cfg)

    try:
        # ── 1. export labeled traces → SFT dataset ────────────────────
        examples = stores.fetch_labeled_examples()
        if len(examples) < 50:
            raise SystemExit(f"not enough labeled examples ({len(examples)}) — run Phase 2 analysis first")
        split = stratified_split(examples, cfg.heldout_fraction)

        out_dir = Path("/tmp/diagnost-finetune")
        dataset_id = dataset_id_for(cfg, examples)
        train_path = out_dir / f"{dataset_id}-train.jsonl"
        n = write_sft(train_path, split.train)

        async def upload():
            return await upload_to_s3(cfg, train_path, f"routing/{dataset_id}/train.jsonl")

        s3_ref = asyncio.get_event_loop().run_until_complete(upload()) or str(train_path)
        print(f"[export] {len(examples)} examples → train={len(split.train)} heldout={len(split.heldout)}")
        print(f"[export] dataset {dataset_id} at {s3_ref}")

        # ── 2. train specialist ───────────────────────────────────────
        trainer = make_trainer(cfg)
        if not hasattr(trainer, "train") or trainer.mode != "local_specialist":
            raise SystemExit("managed trainers are async jobs; offline acceptance uses local_specialist")
        result = trainer.train(split.train, out_dir)
        print(f"[train] {trainer.mode} done in {result.train_seconds}s — metrics: {json.dumps(result.metrics)}")

        fine_tune_id = f"ft_{uuid.uuid4().hex[:10]}"
        stores.execute(
            """
            INSERT INTO fine_tunes (id, workspace_id, task, trainer, base_model,
                                    dataset_ref, model_ref, train_examples,
                                    heldout_examples, train_metrics, status)
            VALUES (%s,%s,'routing',%s,%s,%s,%s,%s,%s,%s,'succeeded')
            """,
            (
                fine_tune_id,
                cfg.workspace_id,
                trainer.mode,
                cfg.base_model,
                s3_ref,
                result.model_ref,
                len(split.train),
                len(split.heldout),
                json.dumps(result.metrics),
            ),
        )

        # ── 3. benchmark vs frontier on held-out set ──────────────────
        router = load_router(result.model_ref)
        bench = run_benchmark(cfg, split.heldout, router)
        for c in bench.candidates:
            print(
                f"[bench] {c.name}: acc={c.accuracy:.3f} "
                f"p95={c.p95_ms}ms cost/1k=${c.cost_per_1k_usd} (measured_latency={c.measured_latency})"
            )
        print(f"[bench] winner: {bench.winner}")

        stores.execute(
            """
            INSERT INTO model_benchmarks (id, workspace_id, task, fine_tune_id,
                                          dataset_size, candidates, winner, notes)
            VALUES (%s,%s,'routing',%s,%s,%s,%s,%s)
            """,
            (
                f"bm_{uuid.uuid4().hex[:10]}",
                cfg.workspace_id,
                fine_tune_id,
                len(split.heldout),
                json.dumps([c.__dict__ for c in bench.candidates]),
                bench.winner,
                bench.notes,
            ),
        )

        frontier = next(c for c in bench.candidates if c.kind == "frontier")
        specialist = next(c for c in bench.candidates if c.kind == "specialist")
        assert specialist.accuracy >= frontier.accuracy, "specialist must match-or-beat frontier accuracy"
        assert specialist.cost_per_1k_usd < frontier.cost_per_1k_usd, "specialist must be cheaper"
        assert specialist.p95_ms < frontier.p95_ms, "specialist must be faster"
        print("[bench] acceptance invariants hold: accuracy ≥, cost <, latency <")
    finally:
        stores.close()


if __name__ == "__main__":
    main()
