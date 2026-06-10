# SPECTER — Prompt 2: Database Schema & Infrastructure

**Date:** 2026-05-24
**Status:** Approved
**Phase:** Phase 0 — Pre-Development
**Repo:** specter-api

---

## 1. Goal

Implement all 8 SPECTER database tables as SQLAlchemy 2.0 async models, configure Alembic migrations, wire async database sessions and Upstash Redis, and produce a Supabase SQL migration file with RLS enabled on all tables.

---

## 2. Directory Structure

```
specter-api/
├── models/
│   ├── __init__.py          exports all models — no circular imports
│   ├── base.py              DeclarativeBase + shared id/created_at columns
│   ├── merchants.py         Merchant model
│   ├── skus.py              SKU model
│   ├── competitor_urls.py   CompetitorURL model
│   ├── price_snapshots.py   PriceSnapshot model
│   ├── signals.py           Signal model
│   ├── oos_alerts.py        OOSAlert model
│   ├── price_changes.py     PriceChange model
│   └── merchant_addons.py   MerchantAddon model
├── alembic/
│   ├── env.py               async Alembic env
│   ├── script.py.mako       migration template
│   └── versions/
│       └── 0001_initial_schema.py
├── supabase/
│   └── migrations/
│       └── 0001_initial_schema.sql   RLS + full schema for Supabase SQL Editor
├── db.py                    async engine + AsyncSessionLocal + get_db()
├── redis_client.py          Upstash Redis via redis-py
├── alembic.ini
└── .env                     DATABASE_URL + UPSTASH_REDIS_URL (gitignored)
```

---

## 3. Shared Base (models/base.py)

All models inherit from a single `Base` with two shared columns:

```python
id         UUID  PRIMARY KEY  DEFAULT gen_random_uuid()
created_at TIMESTAMP          DEFAULT now()  NOT NULL
```

Using SQLAlchemy 2.0 `DeclarativeBase` + `MappedColumn` typed annotations throughout.

---

## 4. Schema — All 8 Tables

### merchants
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| created_at | TIMESTAMP | NOT NULL DEFAULT now() |
| clerk_user_id | VARCHAR | UNIQUE NOT NULL |
| plan | VARCHAR | NOT NULL — accepts 'recon'\|'cipher'\|'phantom'\|'predator'\|'eclipse' |
| shopify_domain | VARCHAR | NULLABLE |
| shopify_access_token | VARCHAR | NULLABLE (stored encrypted) |
| woo_api_key | VARCHAR | NULLABLE |
| razorpay_subscription_id | VARCHAR | NULLABLE |
| trial_ends_at | TIMESTAMP | NULLABLE |
| read_only | BOOLEAN | NOT NULL DEFAULT false |
| eclipse_interval_ms | INTEGER | NOT NULL DEFAULT 300000 |

### skus
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| created_at | TIMESTAMP | NOT NULL |
| merchant_id | UUID | FK → merchants.id NOT NULL |
| title | VARCHAR | NOT NULL |
| handle | VARCHAR | NULLABLE |
| current_price | DECIMAL(10,2) | NULLABLE |
| floor_price | DECIMAL(10,2) | NULLABLE |
| ceiling_price | DECIMAL(10,2) | NULLABLE |
| shopify_variant_id | VARCHAR | NULLABLE |
| active | BOOLEAN | NOT NULL DEFAULT true |

### competitor_urls
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| created_at | TIMESTAMP | NOT NULL |
| sku_id | UUID | FK → skus.id NOT NULL |
| domain | VARCHAR | NOT NULL |
| url_path | VARCHAR | NOT NULL |
| last_scraped_at | TIMESTAMP | NULLABLE |
| scrape_interval_minutes | INTEGER | NULLABLE |
| robots_blocked | BOOLEAN | NOT NULL DEFAULT false |

### price_snapshots
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| created_at | TIMESTAMP | NOT NULL |
| competitor_url_id | UUID | FK → competitor_urls.id NOT NULL |
| price | DECIMAL(10,2) | NOT NULL |
| in_stock | BOOLEAN | NOT NULL |
| scraped_at | TIMESTAMP | NOT NULL |
| raw_s3_key | VARCHAR | NULLABLE |
| needs_review | BOOLEAN | NOT NULL DEFAULT false |
| delete_at | TIMESTAMP | NULLABLE — NULL = keep; set on PREDATOR downgrade |

### signals
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| created_at | TIMESTAMP | NOT NULL |
| sku_id | UUID | FK → skus.id NOT NULL |
| type | VARCHAR(5) | NOT NULL — 'RAISE'\|'LOWER'\|'HOLD' |
| confidence | DECIMAL(3,2) | NOT NULL |
| reasoning | TEXT | NULLABLE |
| price_suggestion | DECIMAL(10,2) | NULLABLE — NULL when source='rule' |
| source | VARCHAR(4) | NOT NULL — 'ai'\|'rule' |
| ai_fallback | BOOLEAN | NOT NULL DEFAULT false |
| ai_model | VARCHAR(32) | NULLABLE — NULL when source='rule' |

### oos_alerts
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| created_at | TIMESTAMP | NOT NULL |
| competitor_url_id | UUID | FK → competitor_urls.id NOT NULL |
| sku_id | UUID | FK → skus.id NOT NULL |
| detected_at | TIMESTAMP | NOT NULL |
| resolved_at | TIMESTAMP | NULLABLE |
| notified_at | TIMESTAMP | NULLABLE |

### price_changes
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| created_at | TIMESTAMP | NOT NULL |
| sku_id | UUID | FK → skus.id NOT NULL |
| signal_id | UUID | FK → signals.id NULLABLE |
| old_price | DECIMAL(10,2) | NOT NULL |
| new_price | DECIMAL(10,2) | NOT NULL |
| source | VARCHAR(6) | NOT NULL — 'manual'\|'auto' |
| revenue_delta | DECIMAL(10,2) | NULLABLE |

### merchant_addons
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| created_at | TIMESTAMP | NOT NULL |
| merchant_id | UUID | FK → merchants.id NOT NULL |
| addon_type | VARCHAR | NOT NULL |
| quantity | INTEGER | NOT NULL DEFAULT 1 |

---

## 5. db.py

```python
DATABASE_URL = os.environ["DATABASE_URL"]  # Supabase PostgreSQL connection string

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
```

Required extra package: `asyncpg` (async PostgreSQL driver).

---

## 6. redis_client.py

```python
UPSTASH_REDIS_URL = os.environ["UPSTASH_REDIS_URL"]  # rediss://... format

redis = Redis.from_url(UPSTASH_REDIS_URL, decode_responses=True)
```

Required extra package: `redis[hiredis]`.

---

## 7. Alembic Configuration

- `alembic.ini` points `script_location = alembic`; `sqlalchemy.url` is overridden in `env.py` from `DATABASE_URL` env var (not hardcoded in .ini)
- `alembic/env.py` uses async engine via `run_async_migrations()` pattern
- Migration `0001_initial_schema.py` auto-generated from model metadata; creates all 8 tables in dependency order (merchants → skus → competitor_urls → price_snapshots, signals, oos_alerts, price_changes, merchant_addons)

---

## 8. Supabase SQL Migration File

`supabase/migrations/0001_initial_schema.sql` contains:
1. `CREATE TABLE` statements for all 8 tables (exact match to Alembic migration)
2. `ALTER TABLE <table> ENABLE ROW LEVEL SECURITY` for all 8 tables
3. Service-role permissive policy on each table:
   ```sql
   CREATE POLICY "service_role_full_access" ON <table>
     USING (true) WITH CHECK (true);
   ```
   This allows specter-api's Supabase service role full access while blocking direct anon/client access. Policies are tightened per-table in Prompt 12.

---

## 9. Environment Variables Required

Add to `specter-api/.env` (gitignored):
```
DATABASE_URL=postgresql+asyncpg://postgres:<password>@<host>:5432/postgres
UPSTASH_REDIS_URL=rediss://:<password>@<host>:<port>
```

Note: Supabase connection string uses `postgresql+asyncpg://` prefix for asyncpg driver.

---

## 10. Success Criteria

1. `alembic upgrade head` exits 0
2. `alembic current` shows `0001_initial_schema (head)`
3. `python -c "from models.merchants import Merchant; print('ok')"` prints `ok`
4. `python -c "from redis_client import redis; print(redis.ping())"` prints `True`
5. All 8 tables visible in Supabase dashboard with RLS enabled
