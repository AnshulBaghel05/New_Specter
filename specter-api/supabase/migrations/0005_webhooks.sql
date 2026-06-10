-- Custom webhook delivery infrastructure for PHANTOM+ merchants.
-- Two tables: webhook configs (webhooks) and delivery audit log (webhook_deliveries).
-- Feature gate enforced in specter-api; schema is plan-agnostic.

-- ============================================================
-- webhooks: one row per merchant webhook endpoint
-- ============================================================

CREATE TABLE IF NOT EXISTS webhooks (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ,
  merchant_id       UUID        NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  url               VARCHAR     NOT NULL,
  secret            VARCHAR     NOT NULL,   -- HMAC-SHA256 signing secret
  events            TEXT[]      NOT NULL,   -- e.g. ARRAY['signal.created', 'oos.detected']
  is_active         BOOLEAN     NOT NULL DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  failure_count     INTEGER     NOT NULL DEFAULT 0
);

-- ============================================================
-- webhook_deliveries: one row per delivery attempt
-- ============================================================

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  webhook_id        UUID        NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event_type        VARCHAR     NOT NULL,
  payload           JSONB       NOT NULL,
  status            VARCHAR(8)  NOT NULL DEFAULT 'pending',
  -- status values: 'pending' | 'success' | 'failed'
  response_code     INTEGER,
  response_body     TEXT,
  attempt_count     INTEGER     NOT NULL DEFAULT 0,
  next_attempt_at   TIMESTAMPTZ,
  last_attempted_at TIMESTAMPTZ,
  CONSTRAINT webhook_deliveries_status_check
    CHECK (status IN ('pending', 'success', 'failed'))
);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE webhooks           ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access" ON webhooks
  USING (true) WITH CHECK (true);

CREATE POLICY "service_role_full_access" ON webhook_deliveries
  USING (true) WITH CHECK (true);

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_webhooks_merchant_id
  ON webhooks(merchant_id);

-- Scheduler: find active webhooks that subscribe to a given event
CREATE INDEX IF NOT EXISTS idx_webhooks_active
  ON webhooks(merchant_id, is_active)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_id
  ON webhook_deliveries(webhook_id);

-- Retry worker: find pending deliveries due for retry
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_pending
  ON webhook_deliveries(next_attempt_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_created_at
  ON webhook_deliveries(created_at DESC);

-- ============================================================
-- updated_at trigger (requires 0004 to have run first)
-- ============================================================

CREATE OR REPLACE TRIGGER webhooks_set_updated_at
  BEFORE UPDATE ON webhooks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
