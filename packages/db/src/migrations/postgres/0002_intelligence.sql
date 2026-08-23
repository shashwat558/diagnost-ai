-- Phase 2: conversation intelligence

-- one row per analyzed cluster
CREATE TABLE IF NOT EXISTS clusters (
  id             TEXT PRIMARY KEY,
  workspace_id   TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  label          TEXT NOT NULL,
  intent         TEXT NOT NULL DEFAULT 'unknown',
  summary        TEXT NOT NULL DEFAULT '',
  sentiment      REAL NOT NULL DEFAULT 0,      -- -1..1
  frustration    REAL NOT NULL DEFAULT 0,      -- 0..1
  size           INTEGER NOT NULL DEFAULT 0,
  error_rate     REAL NOT NULL DEFAULT 0,      -- share of member conversations with an error event
  top_terms      TEXT[] NOT NULL DEFAULT '{}',
  judge_mode     TEXT NOT NULL DEFAULT 'mock', -- mock | openai (auditability)
  embedding_mode TEXT NOT NULL DEFAULT 'mock',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_clusters_workspace_size ON clusters(workspace_id, size DESC);

-- conversation ↔ cluster membership (a conversation lands in exactly one cluster or noise)
CREATE TABLE IF NOT EXISTS cluster_members (
  cluster_id      TEXT NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL,
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (cluster_id, conversation_id)
);
CREATE INDEX IF NOT EXISTS idx_cluster_members_conversation ON cluster_members(conversation_id);

-- drift alerts (EWMA/CUSUM evidence included)
CREATE TABLE IF NOT EXISTS alerts (
  id            TEXT PRIMARY KEY,
  workspace_id  TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  cluster_id    TEXT REFERENCES clusters(id) ON DELETE SET NULL,
  type          TEXT NOT NULL,                -- failure_rate_spike | new_cluster | friction_rise
  severity      TEXT NOT NULL DEFAULT 'warning', -- info | warning | critical
  message       TEXT NOT NULL,
  evidence      JSONB NOT NULL DEFAULT '{}',  -- rates per bucket, thresholds fired
  dedupe_key    TEXT NOT NULL UNIQUE,         -- idempotent re-runs
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- pipeline checkpoint: conversations already embedded/clustered
CREATE TABLE IF NOT EXISTS processed_conversations (
  conversation_id TEXT PRIMARY KEY,
  processed_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- feature requests arrive in Phase 3; table reserved here to keep one migration
CREATE TABLE IF NOT EXISTS feature_requests (
  id            TEXT PRIMARY KEY,
  workspace_id  TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  slug          TEXT NOT NULL,
  description   TEXT NOT NULL,
  frequency     INTEGER NOT NULL DEFAULT 0,
  example_conversation_ids TEXT[] NOT NULL DEFAULT '{}',
  first_seen_at TIMESTAMPTZ,
  last_seen_at  TIMESTAMPTZ,
  UNIQUE (workspace_id, slug)
);
