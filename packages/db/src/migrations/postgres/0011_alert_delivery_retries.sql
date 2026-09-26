-- Alert delivery retries: track attempt count and last attempt so a failed
-- delivery can be retried instead of being permanently suppressed by the
-- (alert_id, channel_id) ledger row.

ALTER TABLE alert_deliveries
  ADD COLUMN IF NOT EXISTS attempts      INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Partial index for the notifier poll: only failed rows are ever retried, and
-- only until they exhaust MAX_DELIVERY_ATTEMPTS.
CREATE INDEX IF NOT EXISTS idx_alert_deliveries_retry
  ON alert_deliveries (last_attempt_at)
  WHERE status = 'failed';
