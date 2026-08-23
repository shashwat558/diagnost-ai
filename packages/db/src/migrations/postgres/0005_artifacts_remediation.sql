-- Phase 4: auto-remediation — artifact registry + remediation records

-- versioned patch targets registered by the workspace (prompts, tool schemas)
CREATE TABLE IF NOT EXISTS artifacts (
  id             TEXT PRIMARY KEY,
  workspace_id   TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  kind           TEXT NOT NULL CHECK (kind IN ('prompt', 'tool_schema')),
  name           TEXT NOT NULL,
  handles_intent TEXT NOT NULL,            -- failure intent this artifact owns
  current_version TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, name)
);

CREATE TABLE IF NOT EXISTS artifact_versions (
  id          TEXT PRIMARY KEY,
  artifact_id TEXT NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  version     TEXT NOT NULL,
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (artifact_id, version)
);

-- one proposed fix per (cluster, artifact); eval report embedded
CREATE TABLE IF NOT EXISTS remediations (
  id               TEXT PRIMARY KEY,
  workspace_id     TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  cluster_id       TEXT NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
  artifact_id      TEXT NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  base_version     TEXT NOT NULL,
  proposed_version TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'evaluating'
                   CHECK (status IN ('evaluating','passed','failed_gate','pr_opened','merged','rejected')),
  eval_report      JSONB NOT NULL DEFAULT '{}',
  pr_url           TEXT,
  pr_branch        TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
