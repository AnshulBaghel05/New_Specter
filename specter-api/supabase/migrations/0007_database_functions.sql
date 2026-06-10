-- Database functions for business logic that benefits from running close to the data.
-- All functions are STABLE or VOLATILE as appropriate; none modify schema.

-- ============================================================
-- F4: Signal duplicate suppression
-- Returns true if a signal of the given type was already emitted
-- for this SKU within the last `p_window_secs` seconds (default 1 hour).
-- Uses idx_signals_sku_type_created from 0003.
-- ============================================================

CREATE OR REPLACE FUNCTION signal_in_window(
  p_sku_id      UUID,
  p_type        VARCHAR,
  p_window_secs INTEGER DEFAULT 3600
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM signals
    WHERE sku_id = p_sku_id
      AND type   = p_type
      AND created_at > now() - (p_window_secs * INTERVAL '1 second')
  );
$$;

-- ============================================================
-- F9 / F3: Price snapshot retention cleanup
-- Deletes snapshots whose delete_at timestamp has passed.
-- Called by an external scheduler (pg_cron or Railway cron).
-- Returns the number of rows deleted.
-- Uses idx_price_snapshots_delete_at from 0003.
-- ============================================================

CREATE OR REPLACE FUNCTION cleanup_old_price_snapshots()
RETURNS INTEGER
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM price_snapshots
  WHERE delete_at IS NOT NULL
    AND delete_at < now();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- ============================================================
-- F3: Latest competitor price per URL for a SKU
-- Used by signal engine to get the most recent in-stock price
-- from each active competitor URL for a given SKU.
-- Uses idx_price_snapshots_url_scraped and idx_competitor_urls_scrapeable.
-- ============================================================

CREATE OR REPLACE FUNCTION get_latest_competitor_prices(p_sku_id UUID)
RETURNS TABLE (
  competitor_url_id UUID,
  domain            VARCHAR,
  url_path          VARCHAR,
  price             NUMERIC,
  in_stock          BOOLEAN,
  scraped_at        TIMESTAMPTZ
)
LANGUAGE sql
STABLE
AS $$
  SELECT DISTINCT ON (cu.id)
    cu.id          AS competitor_url_id,
    cu.domain,
    cu.url_path,
    ps.price,
    ps.in_stock,
    ps.scraped_at
  FROM competitor_urls cu
  JOIN price_snapshots ps ON ps.competitor_url_id = cu.id
  WHERE cu.sku_id       = p_sku_id
    AND cu.is_active    = true
    AND cu.robots_blocked = false
  ORDER BY cu.id, ps.scraped_at DESC;
$$;

-- ============================================================
-- F6 Dashboard: count of active (unresolved) OOS alerts for a merchant
-- Uses idx_oos_alerts_sku_resolved from 0003.
-- ============================================================

CREATE OR REPLACE FUNCTION get_active_oos_count(p_merchant_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*)::INTEGER
  FROM oos_alerts oa
  JOIN skus s ON s.id = oa.sku_id
  WHERE s.merchant_id  = p_merchant_id
    AND oa.resolved_at IS NULL;
$$;

-- ============================================================
-- F6 / F8 Dashboard: revenue recovered month-to-date from auto price changes
-- PHANTOM+ only (enforced in API, not here).
-- Uses idx_price_changes_sku_created from 0003.
-- ============================================================

CREATE OR REPLACE FUNCTION get_revenue_recovered_mtd(p_merchant_id UUID)
RETURNS NUMERIC
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(SUM(pc.revenue_delta), 0)
  FROM price_changes pc
  JOIN skus s ON s.id = pc.sku_id
  WHERE s.merchant_id   = p_merchant_id
    AND pc.source       = 'auto'
    AND pc.status       = 'applied'
    AND pc.created_at  >= date_trunc('month', now());
$$;

-- ============================================================
-- Optional: schedule daily retention cleanup via pg_cron
-- Uncomment and run once after enabling the pg_cron extension
-- in Supabase Dashboard → Database → Extensions.
-- ============================================================

-- SELECT cron.schedule(
--   'cleanup_price_snapshots',   -- job name
--   '0 3 * * *',                 -- 3:00 AM UTC daily
--   'SELECT cleanup_old_price_snapshots()'
-- );
