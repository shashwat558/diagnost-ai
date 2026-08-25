-- Phase 6: productionization — billing usage, audit logs, roles

-- monthly event usage per workspace (updated by the ingest consumer)
CREATE TABLE IF NOT EXISTS usage_monthly (
  workspace_id TEXT NOT NULL,
  period       TEXT NOT NULL,              -- 'YYYY-MM'
  events       BIGINT NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, period)
);

-- audit trail for privileged actions
CREATE TABLE IF NOT EXISTS audit_logs (
  id            TEXT PRIMARY KEY,
  workspace_id  TEXT,
  actor         TEXT NOT NULL,             -- user email, 'api-key:prefix', 'system'
  action        TEXT NOT NULL,             -- e.g. 'api_key.created', 'plan.changed'
  target        TEXT NOT NULL DEFAULT '',
  metadata      JSONB NOT NULL DEFAULT '{}',
  ip            TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_ws_time ON audit_logs(workspace_id, created_at DESC);

-- dev owner user (roles: owner | admin | member | viewer)
INSERT INTO users (id, workspace_id, email, role)
VALUES ('user_dev_owner', 'ws_dev', 'owner@dev.local', 'owner')
ON CONFLICT (id) DO NOTHING;
