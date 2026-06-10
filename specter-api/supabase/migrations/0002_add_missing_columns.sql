-- Missing columns required for full feature support beyond the initial 8-table schema.
-- All additions use IF NOT EXISTS / DROP CONSTRAINT IF EXISTS for idempotency.

-- ============================================================
-- merchants
-- ============================================================

-- F7 AC#7: global auto-reprice toggle (CIPHER+ only, enforced in API)
ALTER TABLE merchants
  ADD COLUMN IF NOT EXISTS auto_reprice_enabled BOOLEAN NOT NULL DEFAULT false;

-- WooCommerce P1: site URL needed alongside woo_api_key for API calls
ALTER TABLE merchants
  ADD COLUMN IF NOT EXISTS woo_site_url VARCHAR;

-- Plan validity constraint
ALTER TABLE merchants
  DROP CONSTRAINT IF EXISTS merchants_plan_check;
ALTER TABLE merchants
  ADD CONSTRAINT merchants_plan_check
  CHECK (plan IN ('recon', 'cipher', 'phantom', 'predator', 'eclipse'));

-- ============================================================
-- skus
-- ============================================================

-- F7 AC#7: per-SKU auto-reprice override (false = disabled for this SKU)
ALTER TABLE skus
  ADD COLUMN IF NOT EXISTS auto_reprice_enabled BOOLEAN NOT NULL DEFAULT false;

-- ============================================================
-- competitor_urls
-- ============================================================

-- F5 AC#6: merchant can silence OOS email alerts per competitor URL
ALTER TABLE competitor_urls
  ADD COLUMN IF NOT EXISTS oos_alerts_silenced BOOLEAN NOT NULL DEFAULT false;

-- F3 AC#6: dead-letter after 3 consecutive scrape failures
ALTER TABLE competitor_urls
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE competitor_urls
  ADD COLUMN IF NOT EXISTS failure_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE competitor_urls
  ADD COLUMN IF NOT EXISTS last_failed_at TIMESTAMPTZ;

-- ============================================================
-- price_changes
-- ============================================================

-- F7 AC#7 edge cases: track whether Shopify price-write succeeded or was clamped/failed
-- Values: 'applied' | 'failed' | 'clamped'
ALTER TABLE price_changes
  ADD COLUMN IF NOT EXISTS status VARCHAR(8) NOT NULL DEFAULT 'applied';

ALTER TABLE price_changes
  DROP CONSTRAINT IF EXISTS price_changes_status_check;
ALTER TABLE price_changes
  ADD CONSTRAINT price_changes_status_check
  CHECK (status IN ('applied', 'failed', 'clamped'));

-- Optional error detail populated when status = 'failed'
ALTER TABLE price_changes
  ADD COLUMN IF NOT EXISTS error_detail TEXT;
