-- workspaces: tenant root
CREATE TABLE IF NOT EXISTS workspaces (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  plan          TEXT NOT NULL DEFAULT 'free',
  zero_pii_mode BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- per-workspace API keys (sha256 of the raw key; raw key shown once at creation)
CREATE TABLE IF NOT EXISTS api_keys (
  id           TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  key_hash     TEXT NOT NULL UNIQUE,
  prefix       TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_api_keys_workspace ON api_keys(workspace_id);

-- users + roles land in Phase 6; sessions for dashboard auth in Phase 1
CREATE TABLE IF NOT EXISTS users (
  id           TEXT PRIMARY KEY,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
  email        TEXT UNIQUE,
  password_hash TEXT,
  role         TEXT NOT NULL DEFAULT 'member',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
