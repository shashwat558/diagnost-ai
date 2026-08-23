-- Phase 3: alerting delivery + feature-request extraction

-- per-workspace notification targets
CREATE TABLE IF NOT EXISTS notification_channels (
  id            TEXT PRIMARY KEY,
  workspace_id  TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  channel       TEXT NOT NULL CHECK (channel IN ('slack', 'email')),
  target        TEXT NOT NULL,              -- webhook URL or email address
  enabled       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, channel, target)
);

-- delivery ledger: at-least-once with visible state; rate-limiting keys off it
CREATE TABLE IF NOT EXISTS alert_deliveries (
  id            TEXT PRIMARY KEY,
  alert_id      TEXT NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  channel_id    TEXT NOT NULL REFERENCES notification_channels(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','skipped')),
  detail        TEXT NOT NULL DEFAULT '',
  delivered_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (alert_id, channel_id)
);

-- checkpoint for the feature-request extraction pass
CREATE TABLE IF NOT EXISTS feature_scans (
  conversation_id TEXT PRIMARY KEY,
  scanned_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
