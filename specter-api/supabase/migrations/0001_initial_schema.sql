-- SPECTER initial schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- Enables RLS on all tables with a permissive service-role policy.
-- Per-table user policies are added in a later migration (Prompt 12).

-- ============================================================
-- Tables
-- ============================================================

CREATE TABLE merchants (
  id                       UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at               TIMESTAMPTZ  NOT NULL DEFAULT now(),
  clerk_user_id            VARCHAR      NOT NULL UNIQUE,
  plan                     VARCHAR      NOT NULL,
  shopify_domain           VARCHAR,
  shopify_access_token     VARCHAR,
  woo_api_key              VARCHAR,
  razorpay_subscription_id VARCHAR,
  trial_ends_at            TIMESTAMPTZ,
  read_only                BOOLEAN      NOT NULL DEFAULT false,
  eclipse_interval_ms      INTEGER      NOT NULL DEFAULT 300000
);

CREATE TABLE skus (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
  merchant_id         UUID          NOT NULL REFERENCES merchants(id),
  title               VARCHAR       NOT NULL,
  handle              VARCHAR,
  current_price       DECIMAL(10,2),
  floor_price         DECIMAL(10,2),
  ceiling_price       DECIMAL(10,2),
  shopify_variant_id  VARCHAR,
  active              BOOLEAN       NOT NULL DEFAULT true
);

CREATE TABLE competitor_urls (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  sku_id                   UUID        NOT NULL REFERENCES skus(id),
  domain                   VARCHAR     NOT NULL,
  url_path                 VARCHAR     NOT NULL,
  last_scraped_at          TIMESTAMPTZ,
  scrape_interval_minutes  INTEGER,
  robots_blocked           BOOLEAN     NOT NULL DEFAULT false
);

CREATE TABLE price_snapshots (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
  competitor_url_id   UUID          NOT NULL REFERENCES competitor_urls(id),
  price               DECIMAL(10,2) NOT NULL,
  in_stock            BOOLEAN       NOT NULL,
  scraped_at          TIMESTAMPTZ   NOT NULL,
  raw_s3_key          VARCHAR,
  needs_review        BOOLEAN       NOT NULL DEFAULT false,
  delete_at           TIMESTAMPTZ
);

CREATE TABLE signals (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  sku_id           UUID          NOT NULL REFERENCES skus(id),
  type             VARCHAR(5)    NOT NULL,
  confidence       DECIMAL(3,2)  NOT NULL,
  reasoning        TEXT,
  price_suggestion DECIMAL(10,2),
  source           VARCHAR(4)    NOT NULL,
  ai_fallback      BOOLEAN       NOT NULL DEFAULT false,
  ai_model         VARCHAR(32)
);

CREATE TABLE oos_alerts (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  competitor_url_id   UUID        NOT NULL REFERENCES competitor_urls(id),
  sku_id              UUID        NOT NULL REFERENCES skus(id),
  detected_at         TIMESTAMPTZ NOT NULL,
  resolved_at         TIMESTAMPTZ,
  notified_at         TIMESTAMPTZ
);

CREATE TABLE price_changes (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  sku_id        UUID          NOT NULL REFERENCES skus(id),
  signal_id     UUID          REFERENCES signals(id),
  old_price     DECIMAL(10,2) NOT NULL,
  new_price     DECIMAL(10,2) NOT NULL,
  source        VARCHAR(6)    NOT NULL,
  revenue_delta DECIMAL(10,2)
);

CREATE TABLE merchant_addons (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  merchant_id  UUID        NOT NULL REFERENCES merchants(id),
  addon_type   VARCHAR     NOT NULL,
  quantity     INTEGER     NOT NULL DEFAULT 1
);

-- ============================================================
-- Row-Level Security
-- ============================================================

ALTER TABLE merchants        ENABLE ROW LEVEL SECURITY;
ALTER TABLE skus             ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_urls  ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_snapshots  ENABLE ROW LEVEL SECURITY;
ALTER TABLE signals          ENABLE ROW LEVEL SECURITY;
ALTER TABLE oos_alerts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_changes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_addons  ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Service-role permissive policies (specter-api full access)
-- Per-user policies added in a later migration (Prompt 12).
-- ============================================================

CREATE POLICY "service_role_full_access" ON merchants
  USING (true) WITH CHECK (true);

CREATE POLICY "service_role_full_access" ON skus
  USING (true) WITH CHECK (true);

CREATE POLICY "service_role_full_access" ON competitor_urls
  USING (true) WITH CHECK (true);

CREATE POLICY "service_role_full_access" ON price_snapshots
  USING (true) WITH CHECK (true);

CREATE POLICY "service_role_full_access" ON signals
  USING (true) WITH CHECK (true);

CREATE POLICY "service_role_full_access" ON oos_alerts
  USING (true) WITH CHECK (true);

CREATE POLICY "service_role_full_access" ON price_changes
  USING (true) WITH CHECK (true);

CREATE POLICY "service_role_full_access" ON merchant_addons
  USING (true) WITH CHECK (true);
