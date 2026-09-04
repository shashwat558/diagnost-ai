-- Phase 7D: DodoPayments billing — customer/subscription ids on workspaces
-- Full replace of Stripe: keep stripe_* columns for one release (rollback), add dodo_*.

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS dodo_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS dodo_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS dodo_product_id TEXT;

CREATE INDEX IF NOT EXISTS idx_workspaces_dodo_customer ON workspaces(dodo_customer_id);
