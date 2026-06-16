# Scheduled jobs (cron)

specter-api has no in-process scheduler — periodic jobs are triggered by an
external scheduler calling an authenticated endpoint. This keeps the web dyno
stateless and lets the platform own retries/observability.

## Trial monitor (required for trials to expire)

**Endpoint:** `POST /internal/run-trial-monitor`
**Auth:** `Authorization: Bearer ${TRIAL_MONITOR_SECRET}`
**Cadence:** daily (calendar-day gated, so the exact time isn't critical; pick a
low-traffic hour, e.g. 02:00 UTC).

Each run:
1. Sends day-12 ("2 days left") and day-14 ("last day") trial reminder emails.
2. Downgrades every lapsed RECON trial back to `free` (no read-only lockout).

It is idempotent — re-running, or an overlapping run, is safe.

**Without this scheduled, trials never expire** (trial users keep RECON
indefinitely) **and the conversion reminder emails never send.**

### Railway cron setup

1. Set `TRIAL_MONITOR_SECRET` to a strong random value on **both** the API
   service and the cron service (same value).
2. Add a cron service (Railway → New → Cron) pointed at this repo, with:
   - **Schedule:** `0 2 * * *` (daily at 02:00 UTC)
   - **Command:**
     ```bash
     curl -fsS -X POST "$SPECTER_API_URL/internal/run-trial-monitor" \
       -H "Authorization: Bearer $TRIAL_MONITOR_SECRET"
     ```
   - Env on the cron service: `SPECTER_API_URL` (e.g. `https://specter-api.railway.app`)
     and `TRIAL_MONITOR_SECRET`.

`-f` makes curl exit non-zero on an HTTP error so a failed run shows up as a
failed cron execution.

### Verify manually

```bash
curl -fsS -X POST "$SPECTER_API_URL/internal/run-trial-monitor" \
  -H "Authorization: Bearer $TRIAL_MONITOR_SECRET"
# → {"status":"ok","reminders":{"two_days_left":N,"last_day":N},"expired":N}
```

A `401` means the bearer token doesn't match `TRIAL_MONITOR_SECRET`; a `500
config_error` means the secret isn't set on the API service.

## Retention purge (required to cap storage cost)

**Endpoint:** `POST /internal/run-retention-purge`
**Auth:** `Authorization: Bearer ${TRIAL_MONITOR_SECRET}` (same cron secret)
**Cadence:** daily (idempotent — only purges rows already past their cutoff).

Deletes `price_snapshots` past their effective plan retention (30 days, or 90 for
PREDATOR/ECLIPSE), plus any rows whose downgrade-grace `delete_at` has elapsed.

**Without this scheduled, old snapshots accumulate indefinitely** — the retention
*logic* never runs, so storage (and cost) grows without bound.

```bash
curl -fsS -X POST "$SPECTER_API_URL/internal/run-retention-purge" \
  -H "Authorization: Bearer $TRIAL_MONITOR_SECRET"
# → {"status":"ok","rows_deleted":N}
```

## Cost flush (daily billing rollup)

**Endpoint:** `POST /internal/run-cost-flush`
**Auth:** `Authorization: Bearer ${TRIAL_MONITOR_SECRET}` (same cron secret)
**Cadence:** daily, after midnight UTC. Flushes YESTERDAY by default (pass
`?day=YYYY-MM-DD` to flush a specific day). Idempotent — upserts, never double-adds.

Rolls the day's best-effort Redis cost counters into the durable
`merchant_cost_daily` table (the billing source of truth).

```bash
curl -fsS -X POST "$SPECTER_API_URL/internal/run-cost-flush" \
  -H "Authorization: Bearer $TRIAL_MONITOR_SECRET"
# → {"status":"ok","day":"2026-06-14","rows_upserted":N}
```

> One Railway cron service can drive all three jobs — add a line per job to its
> command (or three schedules). They share `TRIAL_MONITOR_SECRET`. The standalone
> `run_retention_purge.py` / `run_cost_flush.py` scripts remain available for
> running a job directly on a worker without going through HTTP.
