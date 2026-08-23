-- Phase 2 refinements: per-member failure flags enable failure-impact ranking
-- and pattern-level drift analytics.

ALTER TABLE cluster_members ADD COLUMN IF NOT EXISTS has_error BOOLEAN NOT NULL DEFAULT FALSE;
