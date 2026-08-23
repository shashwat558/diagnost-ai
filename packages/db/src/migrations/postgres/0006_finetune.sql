-- Phase 5: custom model training

-- one row per training run
CREATE TABLE IF NOT EXISTS fine_tunes (
  id             TEXT PRIMARY KEY,
  workspace_id   TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  task           TEXT NOT NULL,               -- routing | extraction | formatting
  trainer        TEXT NOT NULL,               -- local_specialist | together | fireworks
  base_model     TEXT NOT NULL,
  dataset_ref    TEXT NOT NULL,               -- s3://... or local path
  model_ref      TEXT,                        -- s3://... artifact when done
  train_examples INTEGER NOT NULL DEFAULT 0,
  heldout_examples INTEGER NOT NULL DEFAULT 0,
  train_metrics  JSONB NOT NULL DEFAULT '{}',
  status         TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','succeeded','failed')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- benchmark results: frontier vs specialist on a held-out set
CREATE TABLE IF NOT EXISTS model_benchmarks (
  id            TEXT PRIMARY KEY,
  workspace_id  TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  task          TEXT NOT NULL,
  fine_tune_id  TEXT REFERENCES fine_tunes(id) ON DELETE SET NULL,
  dataset_size  INTEGER NOT NULL,
  candidates    JSONB NOT NULL,   -- [{name, kind, accuracy, per_intent, p50_ms, p95_ms, cost_per_1k_usd, measured}]
  winner        TEXT NOT NULL,
  notes         TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
