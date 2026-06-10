"""
ECLIPSE dedicated-worker routing (F10).

ECLIPSE merchants get a dedicated scrape worker (ECLIPSE_WORKER_URL). When it is
healthy we hand the job to it directly; when it is down (HTTP 503, a 5xx, or a
timeout) we re-queue the job onto the shared `scrape:playwright` BullMQ queue so
the scrape still runs, and email the merchant within 15 min of the failure
(send_eclipse_fallback_email).

Split so the policy is testable without a live worker or Redis:
  route_eclipse_job(job, *, redis_client, merchant_email, now) — async entrypoint
returns "dedicated" when the dedicated worker accepted the job, "fallback" when
we re-queued onto shared capacity.
"""
from __future__ import annotations

import logging
import os

import httpx

from queue_client import enqueue_playwright_job
from services.email import send_eclipse_fallback_email

logger = logging.getLogger("specter.eclipse")

_DEDICATED_TIMEOUT_S = 15.0


async def _post_to_worker(url: str, job: dict) -> httpx.Response:
    async with httpx.AsyncClient(timeout=_DEDICATED_TIMEOUT_S) as client:
        return await client.post(url, json=job)


async def route_eclipse_job(
    job: dict,
    *,
    redis_client,
    merchant_email: str | None = None,
) -> str:
    """Route one ECLIPSE scrape job to its dedicated worker, falling back to the
    shared `scrape:playwright` queue on failure.

    Returns "dedicated" if the dedicated worker accepted the job, else "fallback".
    """
    worker_url = os.environ.get("ECLIPSE_WORKER_URL", "")
    if worker_url:
        try:
            resp = await _post_to_worker(worker_url, job)
        except (httpx.TimeoutException, httpx.HTTPError) as err:
            logger.warning("ECLIPSE dedicated worker unreachable (%s) — falling back", err)
        else:
            # 503 (unavailable) falls back; any other non-error status is accepted.
            if resp.status_code != 503 and resp.status_code < 500:
                return "dedicated"
            logger.warning(
                "ECLIPSE dedicated worker returned %s — falling back to shared capacity",
                resp.status_code,
            )
    else:
        logger.warning("ECLIPSE_WORKER_URL not set — routing job to shared capacity")

    # Fallback: re-queue on shared workers + notify the merchant (F10: within 15 min).
    enqueue_playwright_job(redis_client, job)
    if merchant_email:
        await send_eclipse_fallback_email(merchant_email, job.get("domain"))
    return "fallback"
