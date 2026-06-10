-- Auto-update updated_at on every row mutation for tables that change state over time.
-- Trigger function is shared across all tables.

-- ============================================================
-- Trigger function
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================
-- Add updated_at columns
-- ============================================================

-- merchants: plan changes, token rotations, reprice toggles
ALTER TABLE merchants
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- skus: price updates, floor/ceiling edits, active toggle, reprice toggle
ALTER TABLE skus
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- competitor_urls: last_scraped_at, failure_count, robots_blocked, is_active updates
ALTER TABLE competitor_urls
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- ============================================================
-- Attach trigger (CREATE OR REPLACE requires PostgreSQL 14+; Supabase uses PG15)
-- ============================================================

CREATE OR REPLACE TRIGGER merchants_set_updated_at
  BEFORE UPDATE ON merchants
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER skus_set_updated_at
  BEFORE UPDATE ON skus
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER competitor_urls_set_updated_at
  BEFORE UPDATE ON competitor_urls
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
