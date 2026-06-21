# SPECTER — In-Depth Deployment Runbook

The authoritative, copy-pasteable, top-to-bottom guide to deploy **every** SPECTER
component to production and wire them together. Someone with no prior context can
follow this start to finish. (`DEPLOYMENT-GUIDE.md` is the higher-level overview;
this runbook is the exhaustive step-by-step.)

> **Tech stack recap.** Frontend: Next.js 14 (App Router) → **Vercel**. Backend:
> FastAPI (Python) → **Railway**. Scraper: Node 18 + BullMQ workers (`ts-node`,
> Playwright) → **Railway**. Control plane: a Python dispatcher loop → **Railway**.
> Data: **Postgres** (Supabase/Neon/Railway) + **Redis** (Upstash). Auth:
> **Supabase JWT**. Billing: **Razorpay**. Email: **Resend**.

---

## 0. The full service topology

You will run **one Vercel project** and **these Railway services** (all from the
same GitHub repo, differing by *Root Directory* + *Start Command*):

| # | Service                             | Root dir                | Runtime | Start command                                    | Purpose                                                               |
| - | ----------------------------------- | ----------------------- | ------- | ------------------------------------------------ | --------------------------------------------------------------------- |
| 1 | **API**                       | `specter-api`         | Python  | `uvicorn main:app --host 0.0.0.0 --port $PORT` | FastAPI: auth, billing, signals, ingest, CRUD                         |
| 2 | **Dispatcher**                | `specter-api`         | Python  | `python run_dispatcher.py`                     | Control-plane loop: claims due URLs → enqueues one shared crawl each |
| 3 | **Worker: probe**             | `specter-api/scraper` | Node    | `npm run worker:probe`                         | Classifies new domains (HTTP-ok / JS-required / blocked)              |
| 4 | **Worker: http**              | `specter-api/scraper` | Node    | `npm run worker:http`                          | Datacenter HTTP fetch (80–90% of traffic)                            |
| 5 | **Worker: playwright**        | `specter-api/scraper` | Node    | `npm run worker:playwright`                    | Browser render (last resort) —**needs Chromium**               |
| 6 | **Worker: captcha**           | `specter-api/scraper` | Node    | `npm run worker:captcha`                       | Offloaded CAPTCHA solving                                             |
| 7 | **Cron**                      | n/a (schedules)         | curl    | see §8                                          | Trial monitor, retention purge, cost flush, proxy guard               |
| 8 | **Bull Board** *(optional)* | `specter-api/scraper` | Node    | `npm run bull-board`                           | Queue ops dashboard (basic-auth)                                      |

Plus managed **Postgres** + **Redis (Upstash)**.

### Why this order (do not reorder)

```
Postgres + Redis  →  migrations  →  API  →  dispatcher + workers  →  cron  →  frontend  →  final wiring
```

- **Stores first** — everything else fails its health check without them.
- **Migrations before any app boot** — the schema must exist.
- **API before dispatcher/workers** — workers POST results to the API's `/internal`
  ingest; the dispatcher reads/writes the same DB + Redis.
- **Frontend last** — it needs the API's public URL, and the API needs the
  frontend's origin for CORS (a chicken-and-egg resolved in §9).

---

## 1. Prerequisites

Accounts: **GitHub** (repo pushed), **Vercel**, **Railway**, **Supabase**,
**Upstash**, **Razorpay**, **Resend**, optionally **Sentry** + **PostHog** + a
**proxy provider** (datacenter + residential) + **2Captcha**.

Local CLIs:

```bash
# Node 18+ and Python 3.11+ installed, then:
npm i -g vercel            # Vercel CLI
npm i -g @railway/cli      # Railway CLI
railway login
vercel login
```

---

## 2. Provision data stores

### 2a. Postgres (Supabase example)

1. Supabase → **New project**. Save the DB password.
2. **Settings → Database → Connection string**. You need **two** forms:
   - **Direct** (port `5432`) — for running **migrations** (no pooler).
   - **Pooler / Transaction** (port `6543`) — for the **app** at runtime.
3. Convert both to the SQLAlchemy **async** driver — the URL must start with
   `postgresql+asyncpg://` (not `postgres://`):
   ```
   postgresql+asyncpg://postgres:PASSWORD@db.PROJECT.supabase.co:5432/postgres        # DIRECT (migrations)
   postgresql+asyncpg://postgres:PASSWORD@db.PROJECT.supabase.co:6543/postgres         # POOLER (app)
   ```

   > The app engine already sets `statement_cache_size=0` + `pool_pre_ping`
   > (`db.py`), which is exactly what asyncpg needs behind a transaction pooler.
   >

### 2b. Redis (Upstash)

1. Upstash → **Create database** (Global or a region near Railway). Enable **TLS**.
2. Copy the **`rediss://`** URL (TLS). This is `UPSTASH_REDIS_URL`.
   ```
   rediss://default:PASSWORD@YOUR-HOST.upstash.io:6379
   ```

   > Optional scale-out: set `BROKER_REDIS_URL` (durable job queue) and
   > `STATE_REDIS_URL` (ephemeral state) to separate instances. If unset, both
   > collapse to `UPSTASH_REDIS_URL` — fine to start.
   >

### 2c. Supabase Auth keys (for later)

Supabase → **Settings → API**: copy **Project URL**, **anon key**, and the
**JWT Secret** (Settings → API → JWT Secret). You'll need these in §5 and §10.

---

## 3. Generate secrets (once)

```bash
# Fernet key — encrypts stored Shopify tokens (ENCRYPTION_KEY)
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

# Shared scraper↔API HMAC secret (SCRAPER_INGEST_SECRET) — SAME value on API + workers
python -c "import secrets; print(secrets.token_urlsafe(32))"

# Cron bearer secret (TRIAL_MONITOR_SECRET) — SAME value on API + cron
python -c "import secrets; print(secrets.token_urlsafe(32))"

# Admin key for /admin/cost + /admin/scrape (ADMIN_API_KEY)
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

Store these in a password manager. Never commit them.

---

## 4. Run database migrations (before any service boots)

From a machine with the repo:

```bash
cd specter-api
python -m venv .venv && . .venv/Scripts/activate     # Windows: .venv\Scripts\activate
#                       . .venv/bin/activate          # macOS/Linux
pip install -r requirements.txt

# Use the DIRECT (5432) URL here, not the pooler.
export DATABASE_URL='postgresql+asyncpg://postgres:PASSWORD@db.PROJECT.supabase.co:5432/postgres'
alembic upgrade head
alembic current        # verify → prints the head revision (e.g. 0014)
```

> Alternative once a Railway service exists: `railway link` then
> `railway run alembic upgrade head` (injects the service's env). Always migrate
> with the **direct** connection.

**Re-run this command after every deploy that adds a migration.**

---

## 5. Deploy the API (Railway service #1)

### 5a. Create the service

1. Railway → **New Project → Deploy from GitHub repo** → pick the SPECTER repo.
2. Open the created service → **Settings**:
   - **Source → Root Directory:** `specter-api`
   - **Build:** Nixpacks (auto-detected from `requirements.txt`). No change needed.
   - **Deploy → Start Command / Healthcheck:** already provided by
     `specter-api/railway.toml`:
     ```toml
     startCommand = "uvicorn main:app --host 0.0.0.0 --port $PORT"
     healthcheckPath = "/health"
     ```

     Leave the dashboard start command blank for the API (railway.toml wins).
3. **Settings → Networking → Generate Domain.** Note it — e.g.
   `https://specter-api-production.up.railway.app`. This is your `API_URL`.

### 5b. API environment variables (Settings → Variables)

**Required to boot:**

| Var                     | Value                                                                     |
| ----------------------- | ------------------------------------------------------------------------- |
| `DATABASE_URL`        | the**pooler** (`:6543`) async URL from §2a                       |
| `UPSTASH_REDIS_URL`   | `rediss://…` from §2b                                                 |
| `SUPABASE_JWT_SECRET` | Supabase → Settings → API → JWT Secret                                 |
| `SUPABASE_URL`        | `https://PROJECT.supabase.co` (for JWKS — modern Supabase signs ES256) |

**Required for full function:**

| Var                                                                                                              | Value                                                                                                                                      |
| ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `ENCRYPTION_KEY`                                                                                               | Fernet key (§3)                                                                                                                           |
| `SCRAPER_INGEST_SECRET`                                                                                        | §3 —**must match the workers**                                                                                                     |
| `TRIAL_MONITOR_SECRET`                                                                                         | §3 —**must match the cron**                                                                                                        |
| `ADMIN_API_KEY`                                                                                                | §3                                                                                                                                        |
| `ALLOWED_ORIGINS`                                                                                              | your Vercel URL(s), comma-separated — set in §9.**In production an unset value makes the API refuse to boot** (CORS fails closed). |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET`                                      | Razorpay dashboard                                                                                                                         |
| `RAZORPAY_PLAN_*` (8 base + 5 add-on plan ids)                                                                 | Razorpay → Subscriptions → Plans (see `.env.example` for the full list)                                                                |
| `GEMINI_API_KEY`                                                                                               | Google AI Studio (AI signals; falls back to rules if unset)                                                                                |
| `RESEND_API_KEY` / `RESEND_FROM`                                                                             | Resend (emails; best-effort if unset)                                                                                                      |
| `OPS_ALERT_EMAIL`                                                                                              | recipient for the residential-spend guard alert                                                                                            |
| `SHOPIFY_API_KEY` / `SHOPIFY_API_SECRET` / `SHOPIFY_REDIRECT_URI` / `SHOPIFY_SCOPES` / `DASHBOARD_URL` | Shopify Partner app (`SHOPIFY_REDIRECT_URI` = `https://<API_URL>/merchants/shopify/callback`)                                          |
| `PROXY_DATACENTER_URLS` / `PROXY_RESIDENTIAL_URLS`                                                           | proxy gateways (comma-list).`ALLOW_DIRECT_FALLBACK=false`.                                                                               |
| `SENTRY_DSN`                                                                                                   | optional error tracking                                                                                                                    |
| `RAILWAY_ENVIRONMENT`                                                                                          | Railway sets this automatically to `production` — it's what makes CORS fail closed.                                                     |

### 5c. Deploy + verify

```bash
cd specter-api && railway up      # or let GitHub auto-deploy on push
curl -fsS https://<API_URL>/health
# → {"status":"ok","db":"ok","redis":"ok"}   (HTTP 200)
```

A `503` body names the failing dependency (`"db":"down"` or `"redis":"down"`).

---

## 6. Deploy the dispatcher (Railway service #2)

The dispatcher is a **continuous Python loop** (`run_dispatcher.py`) — it claims
due URLs every `DISPATCH_TICK_SECONDS` and enqueues one shared crawl each. Each
tick it also **self-heals** any tracked URL stuck with no schedule (`next_run_at`
NULL despite enabled trackings — e.g. legacy/seed rows), recomputing its schedule
so competitor prices always start flowing.

> **Single-service (free-plan) default.** `specter-api/railway.toml` now boots the
> dispatcher *and* the API together (`python run_dispatcher.py & uvicorn …`), so on
> the free plan you do **not** need a separate dispatcher service — section 5's API
> deploy already runs it. Confirm the API logs show `[dispatcher] started` shortly
> after uvicorn boots. Split it into its own service (below) only when you scale and
> want the control plane isolated from web traffic; if you do, clear the API
> service's dashboard **Custom Start Command** so it doesn't override `railway.toml`.

1. Railway → in the same project → **New → GitHub Repo** (same repo) → **Settings**:
   - **Root Directory:** `specter-api`
   - **Deploy → Custom Start Command:** `python run_dispatcher.py`
   - **No public domain, no healthcheck** (it's a worker, not a web server).
2. **Variables:** `DATABASE_URL` (pooler), `UPSTASH_REDIS_URL`. Optional tuning:
   `DISPATCH_TICK_SECONDS` (default 10), `DISPATCH_BATCH_LIMIT` (default 200).

> ⚠️ **railway.toml gotcha.** `specter-api/railway.toml` pins the start command to
> `uvicorn`. A service rooted at `specter-api/` may inherit it and wrongly boot the
> API. If the dispatcher's deploy logs show uvicorn instead of
> `[dispatcher] started`, override it: set the service's **Config-as-code file
> path** (Settings → Build) to a non-existent path so the dashboard Start Command
> wins, **or** remove `startCommand` from `railway.toml` and set the API's start
> command in its dashboard too. The Node workers (root `specter-api/scraper`) are
> unaffected — they never see that file.

**Verify:** deploy logs show `[dispatcher] started — tick=10s batch=200` and, once
URLs exist, periodic `[dispatcher] {'claimed':N,'dispatched':M}` lines.

---

## 7. Deploy the scraper workers (Railway services #3–#6)

Create **one service per worker role** — all root `specter-api/scraper`, Node.

### 7a. Common settings (every worker)

- **Root Directory:** `specter-api/scraper`
- **Build Command:** `npm ci`
- **Custom Start Command:** the per-role command from the table in §0.
- No public domain / healthcheck (workers).

### 7b. Playwright worker — install Chromium (critical)

The `playwright` worker renders pages, so its image **must** ship a browser.
Set its **Build Command** to:

```bash
npm ci && npx playwright install --with-deps chromium
```

> If `--with-deps` fails on Nixpacks (no apt during build), the reliable
> alternative is a Dockerfile based on `mcr.microsoft.com/playwright:v1.4x-jammy`
> for this one service. The probe/http/captcha workers don't need a browser and
> use plain `npm ci`.

### 7c. Worker environment variables (all four)

| Var                                                    | Value                                                                                                     |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `UPSTASH_REDIS_URL`                                  | **identical** to the API's                                                                          |
| `SCRAPER_INGEST_SECRET`                              | **byte-identical** to the API's — else every result is 401-rejected and **no prices ingest** |
| `SPECTER_API_URL`                                    | the API's public URL from §5a (workers POST results here)                                                |
| `PROXY_DATACENTER_URLS` / `PROXY_RESIDENTIAL_URLS` | proxy gateways;`ALLOW_DIRECT_FALLBACK=false`                                                            |
| `TWOCAPTCHA_API_KEY` *(captcha worker)*            | 2Captcha key, if using CAPTCHA solving                                                                    |

**Verify:** each worker logs `worker started` (e.g. `[http] worker started — concurrency 30`). End-to-end check: add a competitor in the dashboard (§11) and
confirm a `price_snapshot` row appears.

### 7d. Bull Board (optional ops UI)

Service root `specter-api/scraper`, start `npm run bull-board`, generate a domain,
and set `BULL_BOARD_USER` + `BULL_BOARD_PASS` (basic-auth) — never expose it open.

---

## 8. Deploy the cron jobs (Railway service #7)

Periodic jobs are triggered by hitting authenticated API endpoints (see `CRON.md`).
Create a **Railway Cron** service (or a service with scheduled commands). Env:
`SPECTER_API_URL`, `TRIAL_MONITOR_SECRET` (same as the API).

| Schedule                         | Command                                                                                                              | Why                                                |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `0 2 * * *` (daily)            | `curl -fsS -X POST "$SPECTER_API_URL/internal/run-trial-monitor" -H "Authorization: Bearer $TRIAL_MONITOR_SECRET"` | Expire trials + send day-12/14 reminders           |
| `30 2 * * *` (daily)           | `…/internal/run-retention-purge …`                                                                               | Purge snapshots past plan retention (storage cost) |
| `0 1 * * *` (daily)            | `…/internal/run-cost-flush …`                                                                                    | Roll Redis cost counters →`merchant_cost_daily` |
| `0 * * * *` (**hourly**) | `…/internal/run-proxy-guard …`                                                                                   | Residential-spend guardrail (margin alert)         |
| `15 0 * * *` (daily)           | `…/internal/run-fx-refresh …`                                                                                   | Cache live USD-base FX rates (signal normalization) |

The FX refresh is **optional**: if it never runs, the signal engine falls back to
the embedded static rate table in `services/fx.py` — competitor prices are still
normalized to each product's currency, just on slightly stale rates. Wire it so
cross-currency signals track the live market.

**Verify:** `curl -fsS -X POST …/internal/run-trial-monitor -H "Authorization: Bearer $TRIAL_MONITOR_SECRET"` → `{"status":"ok",…}`. A `401` = wrong secret; a
`500 config_error` = secret not set on the API.

---

## 9. Set the API's CORS origin (resolve the chicken-and-egg)

You can't set `ALLOWED_ORIGINS` to the Vercel URL until the frontend exists, but
the API needs it to allow browser calls. So: deploy the frontend first (§10) to
get its URL, then come back and set on the **API** service:

```
ALLOWED_ORIGINS=https://your-app.vercel.app,https://app.yourdomain.com
```

Redeploy the API. (Until set in production, the API **refuses to boot** — by design.)

---

## 10. Deploy the frontend (Vercel)

### 10a. Import + UI options

1. Vercel → **Add New → Project** → import the SPECTER repo.
2. **Configure Project:**
   - **Framework Preset:** **Next.js** (auto-detected)
   - **Root Directory:** **`specter-web`** ← must set this
   - **Build Command:** `next build` (leave default)
   - **Output Directory:** leave **default** (`.next`)
   - **Install Command:** `npm install` (default)
   - **Node.js Version (Settings → General):** 18.x or 20.x

### 10b. Environment variables (Production + Preview)

| Var                                                         | Value                                                                              |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`                                | Supabase Project URL                                                               |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`                           | Supabase anon key                                                                  |
| `NEXT_PUBLIC_API_URL`                                     | the Railway**API** URL from §5a                                             |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID`                             | Razorpay publishable key id (same as API's `RAZORPAY_KEY_ID`)                    |
| `NEXT_PUBLIC_POSTHOG_KEY`                                 | optional analytics                                                                 |
| `NEXT_PUBLIC_SENTRY_DSN`                                  | optional client error tracking                                                     |
| `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` | optional — build-time source-map upload                                           |
| `NEXT_PUBLIC_PREVIEW`                                     | **leave unset / `0`** in production (only `1` for the backend-free demo) |

### 10c. Deploy

```bash
cd specter-web && vercel --prod      # or auto-deploy on push to main
```

Then go back to **§9** and set `ALLOWED_ORIGINS` on the API to this Vercel domain.

---

## 11. Final wiring + end-to-end verification

1. **Razorpay webhook:** Razorpay → Settings → Webhooks → add
   `https://<API_URL>/billing/webhook`, secret = `RAZORPAY_WEBHOOK_SECRET`, events:
   `subscription.activated`, `subscription.charged`, `subscription.cancelled`,
   `subscription.halted`, `subscription.pending`.
2. **Shopify app:** set the allowed redirect URL to
   `https://<API_URL>/merchants/shopify/callback` (= `SHOPIFY_REDIRECT_URI`).
3. **Smoke test the whole loop:**
   ```bash
   curl -fsS https://<API_URL>/health                       # {"status":"ok",...}
   ```

   - Open the Vercel site → **sign up** → land on `/dashboard` (network calls 200 with a Bearer token).
   - **Add a competitor URL** → within a dispatch tick a probe job runs → a
     `price_snapshot` appears and the product row shows a **live** status badge.
   - Start a **$1 Razorpay test subscription** → the webhook elevates the plan.

---

## 12. Common errors & fixes

| Symptom                                                             | Cause                                                | Fix                                                                                                |
| ------------------------------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| API `/health` 503 `db:down`                                     | wrong/limited DB URL                                 | use the async pooler URL; whitelist Railway egress in Supabase if needed                           |
| API boot error `prepared statement … already exists`             | asyncpg behind pgbouncer                             | already handled (`statement_cache_size=0`); ensure you used the **transaction** pooler URL |
| API won't boot in prod, complains about `ALLOWED_ORIGINS`         | CORS fails closed in production                      | set `ALLOWED_ORIGINS` to the Vercel origin(s) (§9)                                              |
| Dashboard data all**401/blocked by CORS**                     | wrong `NEXT_PUBLIC_API_URL` or `ALLOWED_ORIGINS` | match them; redeploy the API after changing CORS                                                   |
| All scrape results**401** at ingest                           | `SCRAPER_INGEST_SECRET` mismatch                   | make it byte-identical on API**and** every worker                                            |
| Dispatcher logs show**uvicorn**, not `[dispatcher] started` | railway.toml start command inherited                 | override per §6 gotcha note                                                                       |
| Playwright worker:`Executable doesn't exist`                      | Chromium not installed                               | build command `npx playwright install --with-deps chromium` (or Playwright Docker base)          |
| `relation "…" does not exist`                                    | migrations not run                                   | `alembic upgrade head` against the **direct** DB URL (§4)                                 |
| Trials never expire / no margin alerts                              | cron not wired                                       | add the §8 schedules; verify with the curl smoke test                                             |
| `pip: ModuleNotFoundError: slowapi` locally                       | incomplete local venv                                | `pip install -r requirements.txt` (slowapi is pinned in it)                                      |

---

## 13. Per-service environment-variable reference

- **Frontend (Vercel):** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_RAZORPAY_KEY_ID`, `NEXT_PUBLIC_POSTHOG_KEY`,
  `NEXT_PUBLIC_SENTRY_DSN`, (`SENTRY_ORG/PROJECT/AUTH_TOKEN`).
- **API (Railway):** everything in `specter-api/.env.example` — core
  (`DATABASE_URL`, `UPSTASH_REDIS_URL`, `SUPABASE_JWT_SECRET`, `SUPABASE_URL`),
  secrets (`ENCRYPTION_KEY`, `SCRAPER_INGEST_SECRET`, `TRIAL_MONITOR_SECRET`,
  `ADMIN_API_KEY`), `ALLOWED_ORIGINS`, Razorpay, Shopify, Gemini, Resend, proxies,
  residential-guard (`RESIDENTIAL_MAX_SHARE`, `RESIDENTIAL_MAX_USD_PER_DAY`,
  `OPS_ALERT_EMAIL`), Sentry.
- **Dispatcher (Railway):** `DATABASE_URL`, `UPSTASH_REDIS_URL`,
  `DISPATCH_TICK_SECONDS`, `DISPATCH_BATCH_LIMIT`.
- **Workers (Railway):** `UPSTASH_REDIS_URL` (or `BROKER_REDIS_URL`/`STATE_REDIS_URL`),
  `SCRAPER_INGEST_SECRET`, `SPECTER_API_URL`, proxies, `TWOCAPTCHA_API_KEY`.
- **Cron (Railway):** `SPECTER_API_URL`, `TRIAL_MONITOR_SECRET`.

The single most common mistake: `SCRAPER_INGEST_SECRET` differing between the API
and the workers — it silently 401s every scrape result. Keep it identical.
