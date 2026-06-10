-- Performance indexes for all FK columns and common business query patterns.
-- All use CREATE INDEX IF NOT EXISTS for idempotency.

-- ============================================================
-- skus
-- ============================================================

-- FK lookup: all SKUs for a merchant
CREATE INDEX IF NOT EXISTS idx_skus_merchant_id
  ON skus(merchant_id);

-- Dashboard / SKU list: active SKUs for a merchant
CREATE INDEX IF NOT EXISTS idx_skus_merchant_active
  ON skus(merchant_id, active)
  WHERE active = true;

-- ============================================================
-- competitor_urls
-- ============================================================

-- FK lookup: all competitor URLs for a SKU
CREATE INDEX IF NOT EXISTS idx_competitor_urls_sku_id
  ON competitor_urls(sku_id);

-- F3 domain batching: find all tracked entries for a given URL across merchants
-- (same domain+path = one scrape job shared across merchants)
CREATE INDEX IF NOT EXISTS idx_competitor_urls_domain_path
  ON competitor_urls(domain, url_path);

-- Scraper scheduler: fetch URLs due for scraping (active, not blocked)
CREATE INDEX IF NOT EXISTS idx_competitor_urls_scrapeable
  ON competitor_urls(is_active, robots_blocked)
  WHERE is_active = true AND robots_blocked = false;

-- ============================================================
-- price_snapshots
-- ============================================================

-- FK lookup: snapshots for a competitor URL
CREATE INDEX IF NOT EXISTS idx_price_snapshots_competitor_url_id
  ON price_snapshots(competitor_url_id);

-- Signal engine: latest snapshot per URL (DISTINCT ON query pattern)
CREATE INDEX IF NOT EXISTS idx_price_snapshots_url_scraped
  ON price_snapshots(competitor_url_id, scraped_at DESC);

-- Retention cleanup: find expired snapshots efficiently
CREATE INDEX IF NOT EXISTS idx_price_snapshots_delete_at
  ON price_snapshots(delete_at)
  WHERE delete_at IS NOT NULL;

-- ============================================================
-- signals
-- ============================================================

-- FK lookup: signals for a SKU
CREATE INDEX IF NOT EXISTS idx_signals_sku_id
  ON signals(sku_id);

-- Dashboard feed: recent signals for a merchant's SKUs
CREATE INDEX IF NOT EXISTS idx_signals_sku_created
  ON signals(sku_id, created_at DESC);

-- F4 duplicate suppression: same type emitted within 1hr window
CREATE INDEX IF NOT EXISTS idx_signals_sku_type_created
  ON signals(sku_id, type, created_at DESC);

-- Dashboard count: signals in last 24hr across all SKUs (plan-filtered in app)
CREATE INDEX IF NOT EXISTS idx_signals_created_at
  ON signals(created_at DESC);

-- ============================================================
-- oos_alerts
-- ============================================================

-- FK lookup
CREATE INDEX IF NOT EXISTS idx_oos_alerts_sku_id
  ON oos_alerts(sku_id);

CREATE INDEX IF NOT EXISTS idx_oos_alerts_competitor_url_id
  ON oos_alerts(competitor_url_id);

-- Dashboard: active (unresolved) OOS alerts for a merchant's SKUs
CREATE INDEX IF NOT EXISTS idx_oos_alerts_sku_resolved
  ON oos_alerts(sku_id, resolved_at)
  WHERE resolved_at IS NULL;

-- ============================================================
-- price_changes
-- ============================================================

-- FK lookup
CREATE INDEX IF NOT EXISTS idx_price_changes_sku_id
  ON price_changes(sku_id);

CREATE INDEX IF NOT EXISTS idx_price_changes_signal_id
  ON price_changes(signal_id)
  WHERE signal_id IS NOT NULL;

-- F8 attribution: revenue recovered in a date range for a merchant
CREATE INDEX IF NOT EXISTS idx_price_changes_sku_created
  ON price_changes(sku_id, created_at DESC);

-- ============================================================
-- merchant_addons
-- ============================================================

-- FK lookup: add-ons for a merchant
CREATE INDEX IF NOT EXISTS idx_merchant_addons_merchant_id
  ON merchant_addons(merchant_id);
