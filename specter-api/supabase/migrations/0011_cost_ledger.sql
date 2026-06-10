-- supabase/migrations/0011_cost_ledger.sql
create table if not exists merchant_cost_daily (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  merchant_id uuid not null,
  date date not null,
  cost_type text not null,
  cost_usd numeric(14,6) not null default 0,
  units numeric(18,4) not null default 0,
  sample_count integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint uq_merchant_cost_daily unique (merchant_id, date, cost_type)
);
create index if not exists ix_merchant_cost_daily_date on merchant_cost_daily(date);

create table if not exists cost_event_sample (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  merchant_id uuid not null,
  cost_type text not null,
  proxy_tier text,
  units numeric(18,4) not null,
  cost_usd numeric(14,8) not null,
  domain text
);
create index if not exists ix_cost_event_sample_created on cost_event_sample(created_at);
