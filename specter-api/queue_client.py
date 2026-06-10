"""
Python → BullMQ bridge.

Enqueues jobs to BullMQ queues (defined in scraper/queue.ts) via Redis
using BullMQ v4-compatible key structures.

Used by specter-api routers to queue immediate probe jobs when a merchant
adds a new competitor URL (F2 AC#4: first scrape queued immediately, not
on next scheduled run).
"""
from __future__ import annotations

import json
import time

from redis import Redis

_BULL_PREFIX = "bull"

# Must match PLAN_PRIORITY in scraper/scheduler.ts
_PLAN_PRIORITY: dict[str, int] = {
    "eclipse":  20,
    "predator": 10,
    "phantom":  5,
    "cipher":   3,
    "recon":    1,
}


def _enqueue(
    redis_client: Redis,
    queue: str,
    job_name: str,
    data: dict,
    priority: int = 0,
) -> str:
    """
    Add one job to a BullMQ v4 queue via Redis.

    BullMQ v4 job structure:
      HSET bull:{queue}:{id}  name/data/opts/timestamp/delay/priority
      RPUSH bull:{queue}:wait {id}   (FIFO; processed LPOP from worker)

    Returns the assigned job ID.
    """
    prefix = _BULL_PREFIX
    job_id = str(redis_client.incr(f"{prefix}:{queue}:id"))
    ts_ms = int(time.time() * 1_000)

    redis_client.hset(
        f"{prefix}:{queue}:{job_id}",
        mapping={
            "name":      job_name,
            "data":      json.dumps(data),
            "opts":      json.dumps({
                "attempts": 3,
                "backoff":  {"type": "exponential", "delay": 60_000},
                "removeOnComplete": 100,
                "removeOnFail":     500,
            }),
            "timestamp": str(ts_ms),
            "delay":     "0",
            "priority":  str(priority),
        },
    )
    redis_client.rpush(f"{prefix}:{queue}:wait", job_id)
    return job_id


def enqueue_probe_job(
    redis_client: Redis,
    url: str,
    domain: str,
    url_path: str,
    competitor_tracking_ids: list[str],
    plan: str = "recon",
) -> str:
    """
    Enqueue a scrape:probe job immediately.
    Called when a merchant adds a new competitor URL (F2 AC#4).
    """
    return _enqueue(
        redis_client,
        queue="scrape:probe",
        job_name=f"{domain}:{url_path}",
        data={
            "url":                   url,
            "domain":                domain,
            "urlPath":               url_path,
            "competitorTrackingIds": competitor_tracking_ids,
            "plan":                  plan.lower(),
        },
        priority=_PLAN_PRIORITY.get(plan.lower(), 1),
    )


def enqueue_scrape_job(
    redis_client: Redis,
    queue: str,
    url: str,
    domain: str,
    url_path: str,
    competitor_tracking_ids: list[str],
    plan: str = "recon",
    merchant_cycle_ids: list[dict] | None = None,
) -> str:
    """Enqueue ONE shared crawl to a specific queue (probe/http/playwright).

    Used by the control-plane dispatcher: the single result fans out to every
    tracking in `competitor_tracking_ids`, and `merchant_cycle_ids` carries the
    per-merchant cycle slots so the worker's ingest advances the cycle barrier.
    """
    return _enqueue(
        redis_client,
        queue=queue,
        job_name=f"{domain}:{url_path}",
        data={
            "url":                   url,
            "domain":                domain,
            "urlPath":               url_path,
            "competitorTrackingIds": competitor_tracking_ids,
            "plan":                  plan.lower(),
            "merchantCycleIds":      merchant_cycle_ids or [],
        },
        priority=_PLAN_PRIORITY.get(plan.lower(), 1),
    )


def enqueue_playwright_job(redis_client: Redis, job: dict, plan: str = "eclipse") -> str:
    """
    Enqueue a scrape job onto the shared `scrape:playwright` queue.

    Used as the ECLIPSE dedicated-worker fallback (F10 edge case): when a
    merchant's dedicated worker is down, the job is re-queued here so a shared
    worker picks it up. `job` carries whatever the dedicated worker would have
    received (url/domain/urlPath/competitorTrackingIds/…).
    """
    domain = str(job.get("domain", "scrape"))
    url_path = str(job.get("urlPath", ""))
    return _enqueue(
        redis_client,
        queue="scrape:playwright",
        job_name=f"{domain}:{url_path}" if url_path else domain,
        data=job,
        priority=_PLAN_PRIORITY.get(plan.lower(), 1),
    )
