-- Email / notification audit log.
-- Prevents duplicate sends (OOS emails, trial reminders) and provides
-- a delivery audit trail for debugging Resend delivery issues.

CREATE TABLE IF NOT EXISTS notification_logs (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  merchant_id       UUID        NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  type              VARCHAR(32) NOT NULL,
  -- type values:
  --   'oos_alert'            – competitor went OOS (F5)
  --   'trial_reminder_12d'   – trial ending in 2 days
  --   'trial_reminder_14d'   – trial ending today
  --   'trial_expired'        – account moved to read-only
  --   'scrape_failure'       – dead-lettered scrape job (F3 AC#6)
  --   'reconnect_shopify'    – token revoked, reconnect needed (F1)
  --   'reconnect_woo'        – WooCommerce API key invalidated
  --   'reprice_failed'       – Shopify price-write failed after 3 retries (F7)
  --   'downgrade_readonly'   – trial expired without payment
  --   'predator_slack_invite'– PREDATOR onboarding Slack invite (F9)
  reference_id      UUID,       -- oos_alerts.id, price_changes.id, etc.
  sent_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  resend_message_id VARCHAR,    -- Resend API message ID for delivery tracking
  error             TEXT        -- non-null when send attempt failed
);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access" ON notification_logs
  USING (true) WITH CHECK (true);

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_notification_logs_merchant_id
  ON notification_logs(merchant_id);

-- Dedup check: was this type already sent for this merchant recently?
CREATE INDEX IF NOT EXISTS idx_notification_logs_merchant_type
  ON notification_logs(merchant_id, type, sent_at DESC);

-- Dedup check: was a notification already sent for this specific reference (e.g. oos_alert.id)?
CREATE INDEX IF NOT EXISTS idx_notification_logs_reference_id
  ON notification_logs(reference_id)
  WHERE reference_id IS NOT NULL;
