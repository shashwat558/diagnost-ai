-- Phase 7A: hosted auth — server-side sessions for the dashboard

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,          -- sha256 of the raw cookie token
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- seed a password for the dev owner so local acceptance (phases 2/3/5/6) and
-- manual dev flows can log in without a separate signup; hash = scrypt("devpassword123")
UPDATE users
   SET password_hash = 'scrypt$3adaa88475923283dfa90afd505553d0$3668179bc7384ad58adc2e77894f9fdb08cfcbd6d643cb46db18eac16a1c1e1602387d8f7f94f21fb41fc8c5671ac2c751648d3cd932e2250df446eaacf5e352'
 WHERE email = 'owner@dev.local' AND (password_hash IS NULL OR password_hash = '');
