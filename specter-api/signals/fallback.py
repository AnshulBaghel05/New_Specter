"""
AI engine fallback — rule-based signal computation for CIPHER+ merchants when
Gemini is unavailable (timeout, invalid JSON, quota exhausted, rate limit).

Ops visibility:
  - Each fallback event enqueues a job to the BullMQ 'scrape:ai-errors' queue
    (ops-only; no worker consumes it; inspectable via Bull Board).
  - A sliding 24hr counter per merchant is incremented so ops can detect
    sustained degradation: redis key 'ai:fallback:count:{merchant_id}'.

BullMQ job format (v4-compatible):
  Hash  bull:{queueName}:{jobId}   — name, data, opts, timestamp
  List  bull:{queueName}:wait      — job IDs in FIFO order
"""
from __future__ import annotations

import json
import time
from typing import Optional

from redis import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from models.signals import Signal
from models.skus import SKU
from signals.dispatcher import check_and_set_dedup
from signals.rule_engine import CompetitorDataPoint, compute_signal

# Redis key prefix used by BullMQ (matches TypeScript queue.ts)
_BULL_PREFIX = "bull"
_AI_ERRORS_QUEUE = "scrape:ai-errors"

# Sliding 24hr window TTL for the fallback counter
_FALLBACK_COUNTER_TTL_S = 86_400


# ── BullMQ enqueue helper ─────────────────────────────────────────────────────

def enqueue_ai_error(
    redis_client: Redis,
    merchant_id: str,
    batch_size: int,
    error_type: str,
) -> str:
    """
    Write a job to the BullMQ 'scrape:ai-errors' queue using Redis directly.

    The queue is defined in TypeScript (Prompt 6) as ops-only — no worker
    processes it.  Jobs are visible in Bull Board for ops inspection.

    Returns the job ID assigned.
    """
    queue = _AI_ERRORS_QUEUE
    prefix = _BULL_PREFIX

    job_id = str(redis_client.incr(f"{prefix}:{queue}:id"))
    timestamp_ms = int(time.time() * 1_000)

    data = {
        "merchant_id": merchant_id,
        "batch_size": batch_size,
        "error_type": error_type,
        "timestamp": timestamp_ms,
    }

    # BullMQ v4 job hash
    redis_client.hset(f"{prefix}:{queue}:{job_id}", mapping={
        "name":      "ai-error",
        "data":      json.dumps(data),
        "opts":      json.dumps({"attempts": 1, "delay": 0}),
        "timestamp": str(timestamp_ms),
        "delay":     "0",
        "priority":  "0",
    })

    # Add to wait list (FIFO — RPUSH appends to tail; worker reads from head)
    redis_client.rpush(f"{prefix}:{queue}:wait", job_id)

    return job_id


# ── Fallback counter ──────────────────────────────────────────────────────────

def increment_fallback_counter(redis_client: Redis, merchant_id: str) -> int:
    """
    Increment the sliding 24hr fallback counter for a merchant.
    Resets the TTL on every increment so the window slides.
    Returns the new count (ops alert threshold: >50% of scrape cycles).
    """
    key = f"ai:fallback:count:{merchant_id}"
    count = int(redis_client.incr(key))
    redis_client.expire(key, _FALLBACK_COUNTER_TTL_S)
    return count


# ── Rule-engine fallback ──────────────────────────────────────────────────────

async def run_rule_fallback(
    session: AsyncSession,
    redis_client: Redis,
    merchant_id: str,
    skus_and_data: list[tuple[SKU, list[CompetitorDataPoint]]],
    error_type: str,
) -> list[Signal]:
    """
    Run rule-based engine as a transparent fallback for one batch of SKUs.

    Actions:
      1. Enqueue one entry to 'scrape:ai-errors' for ops.
      2. Increment the merchant's sliding fallback counter.
      3. Compute rule-based signal per SKU; write to DB with
         source='rule', ai_fallback=True.

    Signals marked ai_fallback=True are indistinguishable to the merchant
    on the /signals page — the fallback is transparent to them.
    """
    enqueue_ai_error(redis_client, merchant_id, len(skus_and_data), error_type)
    increment_fallback_counter(redis_client, merchant_id)

    written: list[Signal] = []
    for sku, data_points in skus_and_data:
        if not sku.current_price or sku.current_price <= 0:
            continue

        result = compute_signal(sku.current_price, data_points)
        if result is None:
            continue

        sku_id_str = str(sku.id)
        if check_and_set_dedup(redis_client, sku_id_str, result.signal_type):
            continue  # already emitted within last hour

        signal = Signal(
            sku_id=sku.id,
            type=result.signal_type,
            confidence=result.confidence,
            reasoning=result.reasoning,
            price_suggestion=None,
            source="rule",
            ai_fallback=True,
            ai_model=None,
        )
        session.add(signal)
        written.append(signal)

    return written
