-- Saved free-tool calculations (Workspace "Saved Reports").
-- Persists public-calculator runs so a logged-in free user can keep history,
-- reload a calculation into the tool, compare runs, and feed the Opportunity
-- Feed. No plan gate — available to every plan incl. `free`.
-- Mirrors Alembic revision 0007_tool_calculations.

CREATE TABLE IF NOT EXISTS tool_calculations (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  merchant_id   UUID        NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  tool_name     VARCHAR     NOT NULL,   -- e.g. 'shipping', 'shopify-profit', 'amazon-fba'
  name          VARCHAR     NOT NULL,   -- user-facing label, e.g. 'May Profit Analysis'
  inputs        JSONB       NOT NULL,   -- raw calculator inputs (opaque per-tool shape)
  results       JSONB       NOT NULL,   -- computed results (opaque per-tool shape)
  currency      VARCHAR,                -- display currency, e.g. 'USD'
  archived_at   TIMESTAMPTZ             -- NULL = active; set = soft-archived
);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE tool_calculations ENABLE ROW LEVEL SECURITY;

-- API uses the service role and enforces merchant scoping at the application
-- layer (every query filters by merchant_id), matching the other tables.
CREATE POLICY "service_role_full_access" ON tool_calculations
  USING (true) WITH CHECK (true);

-- ============================================================
-- Indexes
-- ============================================================

-- Default list query: this merchant's calculations, newest first.
CREATE INDEX IF NOT EXISTS ix_tool_calculations_merchant_created
  ON tool_calculations(merchant_id, created_at DESC);
