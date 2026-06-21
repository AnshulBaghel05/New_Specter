"""
Gemini 1.5 Pro AI signal engine — F11 implementation.

Flow per merchant batch:
  1. Sort SKUs by ID → chunk into ≤50 sub-batches.
  2. Per sub-batch:
     a. Compute snapshot hash for each SKU.
     b. Cache check — return cached signal for hits, skip Gemini call for those SKUs.
     c. For cache-miss SKUs: build prompt, call Gemini with 10s timeout + 1 retry.
     d. Validate response; clamp price_suggestion; cap confidence.
     e. Write signals to DB (source='ai', ai_model='gemini-1.5-pro').
     f. Cache successful responses.
  3. On any Gemini failure: rule-based fallback for affected SKUs,
     logged to scrape:ai-errors, fallback counter incremented.

429 handling:
  - Rate limit (non-quota): log to ops, fallback current batch.
    Prices will naturally be re-scraped next cycle — no explicit delayed retry.
  - Quota exhausted (RESOURCE_EXHAUSTED): set ai:quota-exhausted flag (24hr),
    fallback all CIPHER+ until quota resets.
"""
from __future__ import annotations

import asyncio
import json
import os
import statistics
import time
import warnings
from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

# Suppress google-generativeai FutureWarning — we're aware it's deprecated
with warnings.catch_warnings():
    warnings.simplefilter("ignore", FutureWarning)
    import google.generativeai as genai
    from google.api_core.exceptions import ResourceExhausted

from redis import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.price_snapshots import PriceSnapshot
from models.signals import Signal
from models.skus import SKU
from signals.cache import (
    CachedSignal,
    compute_snapshot_hash,
    get_cached,
    set_cached,
)
from services.cost_ledger import record_ai_cost
from signals.dispatcher import check_and_set_dedup
from signals.fallback import run_rule_fallback
from signals.rule_engine import (
    CONFIDENCE_LOW_INSTOCK_CAP,
    CompetitorDataPoint,
    SignalResult,
    compute_signal,
)

# ── Constants ─────────────────────────────────────────────────────────────────

MODEL_NAME         = "gemini-1.5-pro"
BATCH_SIZE         = 50
GEMINI_TIMEOUT_S   = 10.0
GEMINI_RETRY_DELAY = 3.0

_SYSTEM_PROMPT = (
    "You are a pricing intelligence engine for e-commerce merchants. "
    "Analyze competitor price data and return structured JSON signals. "
    "Do not include explanation outside the JSON. Return valid JSON only."
)

_VALID_SIGNALS = {"RAISE", "LOWER", "HOLD"}

# Redis key for quota-exhausted flag (cleared at midnight UTC by TTL)
_QUOTA_EXHAUSTED_KEY = "ai:quota-exhausted"

# ── Gemini model singleton ────────────────────────────────────────────────────

_model: Optional[genai.GenerativeModel] = None  # type: ignore[name-defined]


def _get_model() -> genai.GenerativeModel:  # type: ignore[name-defined]
    global _model
    if _model is None:
        api_key = os.environ.get("GEMINI_API_KEY", "")
        if not api_key:
            raise EnvironmentError("GEMINI_API_KEY environment variable is not set")
        genai.configure(api_key=api_key)  # type: ignore[attr-defined]
        _model = genai.GenerativeModel(  # type: ignore[attr-defined]
            model_name=MODEL_NAME,
            system_instruction=_SYSTEM_PROMPT,
        )
    return _model


def reset_model_singleton() -> None:
    """Test helper — forces re-initialisation of the Gemini model."""
    global _model
    _model = None


# ── Public entry point ────────────────────────────────────────────────────────

async def process_merchant_batch(
    session: AsyncSession,
    redis_client: Redis,
    merchant_id: str,
    plan: str,
    eclipse_interval_s: int,
    skus_and_data: list[tuple[SKU, list[CompetitorDataPoint]]],
) -> list[Signal]:
    """
    Process a list of (SKU, competitor_data) pairs for a CIPHER+ merchant.

    Sorts by SKU ID for deterministic batching then processes sequentially
    (NOT parallel — avoids rate-limit bursts per F11 spec).
    """
    # Hard stop if quota is exhausted globally for this day.
    if redis_client.exists(_QUOTA_EXHAUSTED_KEY):
        return await run_rule_fallback(
            session, redis_client, merchant_id, skus_and_data,
            error_type="quota_exhausted",
        )

    sorted_batch = sorted(skus_and_data, key=lambda x: str(x[0].id))
    all_signals: list[Signal] = []

    for i in range(0, len(sorted_batch), BATCH_SIZE):
        sub_batch = sorted_batch[i : i + BATCH_SIZE]
        signals = await _process_sub_batch(
            session, redis_client, merchant_id, plan, eclipse_interval_s, sub_batch
        )
        all_signals.extend(signals)

    return all_signals


# ── Sub-batch processing ──────────────────────────────────────────────────────

async def _process_sub_batch(
    session: AsyncSession,
    redis_client: Redis,
    merchant_id: str,
    plan: str,
    eclipse_interval_s: int,
    batch: list[tuple[SKU, list[CompetitorDataPoint]]],
) -> list[Signal]:
    """
    Process one ≤50 SKU sub-batch:
    1. Check cache for each SKU.
    2. Call Gemini for cache-miss SKUs.
    3. Fall back to rule engine on any Gemini failure.
    """
    cache_hits: list[tuple[SKU, CachedSignal]] = []
    misses: list[tuple[SKU, list[CompetitorDataPoint], str]] = []  # (sku, data, hash)

    for sku, data_points in batch:
        competitor_list = _build_competitor_list(data_points)
        snap_hash = compute_snapshot_hash(competitor_list)
        cached = get_cached(redis_client, str(sku.id), snap_hash)
        if cached is not None:
            cache_hits.append((sku, cached))
        else:
            misses.append((sku, data_points, snap_hash))

    signals: list[Signal] = []

    # Write signals for cache hits (source='ai' — cached AI is still AI)
    for sku, cached in cache_hits:
        sig = await _write_signal_from_cached(session, redis_client, sku, cached)
        if sig:
            signals.append(sig)

    # For cache misses: call Gemini
    if misses:
        miss_skus_data = [(sku, data) for sku, data, _ in misses]
        miss_hashes = {str(sku.id): snap_hash for sku, _, snap_hash in misses}

        ai_results = await _call_gemini_batch(
            session, redis_client, merchant_id, miss_skus_data
        )

        if ai_results is None:
            # Complete failure — run rule fallback for all miss SKUs
            fb = await run_rule_fallback(
                session, redis_client, merchant_id,
                [(sku, data) for sku, data, _ in misses],
                error_type="gemini_failure",
            )
            signals.extend(fb)
        else:
            # Partial or full success — write AI signals, fallback for missing
            returned_ids = {r["sku_id"] for r in ai_results}
            missing_skus = [
                (sku, data)
                for sku, data, _ in misses
                if str(sku.id) not in returned_ids
            ]

            for ai_resp in ai_results:
                sku_entry = next(
                    (s for s, _, _ in misses if str(s.id) == ai_resp["sku_id"]), None
                )
                if sku_entry is None:
                    continue
                data_pts = next(
                    (d for s, d, _ in misses if str(s.id) == ai_resp["sku_id"]), []
                )
                snap_hash = miss_hashes.get(str(sku_entry.id), "")

                sig = await _write_ai_signal(
                    session, redis_client, redis_client,
                    sku_entry, ai_resp, data_pts,
                    snap_hash, plan, eclipse_interval_s,
                )
                if sig:
                    signals.append(sig)

            if missing_skus:
                fb = await run_rule_fallback(
                    session, redis_client, merchant_id,
                    missing_skus,
                    error_type="partial_batch",
                )
                signals.extend(fb)

    return signals


# ── Gemini call with timeout + retry ─────────────────────────────────────────

async def _call_gemini_batch(
    session: AsyncSession,
    redis_client: Redis,
    merchant_id: str,
    skus_and_data: list[tuple[SKU, list[CompetitorDataPoint]]],
) -> Optional[list[dict]]:
    """
    Call Gemini with a 10s timeout.  On timeout: wait 3s and retry once.
    Returns validated list of response objects, or None on complete failure.
    """
    prompt = _build_prompt(skus_and_data)
    gen_config = genai.GenerationConfig(  # type: ignore[attr-defined]
        response_mime_type="application/json",
        temperature=0.2,
        max_output_tokens=4096,
    )

    for attempt in range(2):
        if attempt == 1:
            await asyncio.sleep(GEMINI_RETRY_DELAY)

        try:
            response = await asyncio.wait_for(
                asyncio.to_thread(
                    _get_model().generate_content,
                    prompt,
                    generation_config=gen_config,
                ),
                timeout=GEMINI_TIMEOUT_S,
            )
            await _record_ai_usage(session, redis_client, merchant_id, response)
            return _validate_response(response.text, skus_and_data)

        except asyncio.TimeoutError:
            if attempt == 0:
                continue  # retry once
            # Second timeout — return None (caller runs fallback)
            return None

        except ResourceExhausted as e:
            if "quota" in str(e).lower() or "RESOURCE_EXHAUSTED" in str(e):
                # Daily quota exhausted — set flag until midnight UTC
                now_utc = datetime.now(tz=timezone.utc)
                midnight = (now_utc + timedelta(days=1)).replace(
                    hour=0, minute=0, second=0, microsecond=0
                )
                ttl = int((midnight - now_utc).total_seconds())
                redis_client.setex(_QUOTA_EXHAUSTED_KEY, max(ttl, 60), "1")
                # Ops rate-limited metric
                minute_bucket = int(time.time() // 60)
                redis_client.incr(f"ai:rate-limited:{minute_bucket}")
            else:
                # Per-minute rate limit
                minute_bucket = int(time.time() // 60)
                redis_client.incr(f"ai:rate-limited:{minute_bucket}")
            return None

        except Exception:
            return None

    return None


async def _record_ai_usage(
    session: AsyncSession, redis_client: Redis, merchant_id: str, response
) -> None:
    """Best-effort: accrue this Gemini call's token cost to the merchant (Audit #4).
    AI cost is per-merchant — the batch belongs to one merchant, so there is no
    shared-crawl split. Never raises into the signal path."""
    try:
        usage = getattr(response, "usage_metadata", None)
        if usage is None:
            return
        in_tok = int(getattr(usage, "prompt_token_count", 0) or 0)
        out_tok = int(getattr(usage, "candidates_token_count", 0) or 0)
        await record_ai_cost(session, redis_client, merchant_id, MODEL_NAME, in_tok, out_tok)
    except Exception:
        pass


# ── Prompt construction ───────────────────────────────────────────────────────

def _build_prompt(skus_and_data: list[tuple[SKU, list[CompetitorDataPoint]]]) -> str:
    sku_array = [_build_sku_entry(sku, data_points) for sku, data_points in skus_and_data]
    return (
        "All prices for a SKU (merchant_price and every competitor price) are already "
        "in that SKU's own currency, given in its `currency` field — compare them "
        "directly and never convert.\n"
        "Analyze each SKU and return a JSON array with one object per SKU.\n\n"
        f"SKUs:\n{json.dumps(sku_array, indent=2)}\n\n"
        "Return JSON only. Schema per SKU: "
        '{"sku_id": string, "signal": "RAISE"|"LOWER"|"HOLD", '
        '"confidence": float (0.0-1.0), "price_suggestion": number|null, '
        '"reasoning": string (max 120 characters)}'
    )


def _build_sku_entry(sku: SKU, data_points: list[CompetitorDataPoint]) -> dict:
    competitors = []
    for dp in data_points:
        entry: dict = {
            "domain":    dp.domain or dp.tracking_id,
            "price":     float(dp.price),
            "in_stock":  dp.in_stock,
        }
        if dp.scraped_at is not None:
            entry["scraped_at"] = dp.scraped_at.isoformat()
        competitors.append(entry)

    sku_entry: dict = {
        "sku_id":         str(sku.id),
        "title":          sku.title,
        "currency":       (sku.currency or "USD"),
        "merchant_price": float(sku.current_price),
        "competitors":    competitors,
    }

    if sku.floor_price is not None:
        sku_entry["floor_price"] = float(sku.floor_price)
    if sku.ceiling_price is not None:
        sku_entry["ceiling_price"] = float(sku.ceiling_price)

    return sku_entry


def _build_competitor_list(data_points: list[CompetitorDataPoint]) -> list[dict]:
    """Build the competitor list used for snapshot hash computation (no scraped_at)."""
    return [
        {
            "domain":   dp.domain or dp.tracking_id,
            "price":    float(dp.price),
            "in_stock": dp.in_stock,
        }
        for dp in data_points
    ]


# ── Response validation ───────────────────────────────────────────────────────

def _validate_response(
    raw_text: str,
    skus_and_data: list[tuple[SKU, list[CompetitorDataPoint]]],
) -> Optional[list[dict]]:
    """
    Validate Gemini's JSON response against F11 AC#1-5.
    Returns validated list of response dicts, or None on parse failure.
    Missing/invalid SKUs are excluded (caller runs rule fallback for them).
    """
    try:
        # Strip markdown code fences if Gemini wraps output despite the mime type
        text = raw_text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
        responses = json.loads(text)
        if not isinstance(responses, list):
            return None
    except (json.JSONDecodeError, ValueError):
        return None

    sku_map = {str(sku.id): (sku, dp) for sku, dp in skus_and_data}
    validated: list[dict] = []

    for item in responses:
        if not isinstance(item, dict):
            continue

        sku_id = str(item.get("sku_id", ""))
        if sku_id not in sku_map:
            continue

        signal = item.get("signal")
        if signal not in _VALID_SIGNALS:
            continue

        confidence = item.get("confidence")
        if not isinstance(confidence, (int, float)) or not (0.0 <= float(confidence) <= 1.0):
            continue

        reasoning = item.get("reasoning", "")
        if not isinstance(reasoning, str) or not reasoning.strip():
            continue

        sku, data_points = sku_map[sku_id]

        # Clamp price_suggestion to [floor_price, ceiling_price]
        raw_price_suggestion = item.get("price_suggestion")
        price_suggestion: Optional[float] = None
        if raw_price_suggestion is not None:
            try:
                ps = float(raw_price_suggestion)
                if sku.floor_price is not None:
                    ps = max(ps, float(sku.floor_price))
                if sku.ceiling_price is not None:
                    ps = min(ps, float(sku.ceiling_price))
                price_suggestion = ps
            except (TypeError, ValueError):
                price_suggestion = None

        # Cap confidence at 0.6 when fewer than 2 in-stock competitors (mirrors F4)
        instock_count = sum(1 for dp in data_points if dp.in_stock)
        if instock_count < 2:
            confidence = min(float(confidence), float(CONFIDENCE_LOW_INSTOCK_CAP))

        validated.append({
            "sku_id":           sku_id,
            "signal":           signal,
            "confidence":       confidence,
            "price_suggestion": price_suggestion,
            "reasoning":        reasoning[:120],
        })

    return validated if validated else None


# ── Signal write helpers ──────────────────────────────────────────────────────

async def _write_ai_signal(
    session: AsyncSession,
    redis_client: Redis,
    _unused: Redis,          # kept for uniform signature; same as redis_client
    sku: SKU,
    ai_resp: dict,
    data_points: list[CompetitorDataPoint],
    snap_hash: str,
    plan: str,
    eclipse_interval_s: int,
) -> Optional[Signal]:
    """Write an AI signal to DB and update the cache."""
    sku_id_str = str(sku.id)
    signal_type = ai_resp["signal"]

    if check_and_set_dedup(redis_client, sku_id_str, signal_type):
        return None

    price_suggestion: Optional[Decimal] = None
    if ai_resp.get("price_suggestion") is not None:
        price_suggestion = Decimal(str(ai_resp["price_suggestion"])).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )

    confidence = Decimal(str(ai_resp["confidence"])).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )

    signal = Signal(
        sku_id=sku.id,
        type=signal_type,
        confidence=confidence,
        reasoning=ai_resp["reasoning"],
        price_suggestion=price_suggestion,
        source="ai",
        ai_fallback=False,
        ai_model=MODEL_NAME,
    )
    session.add(signal)

    # Cache for next cycle
    set_cached(
        redis_client, sku_id_str, snap_hash,
        CachedSignal(
            signal=signal_type,
            confidence=float(ai_resp["confidence"]),
            price_suggestion=ai_resp.get("price_suggestion"),
            reasoning=ai_resp["reasoning"],
        ),
        plan=plan,
        eclipse_interval_s=eclipse_interval_s,
    )

    return signal


async def _write_signal_from_cached(
    session: AsyncSession,
    redis_client: Redis,
    sku: SKU,
    cached: CachedSignal,
) -> Optional[Signal]:
    """Write a cached AI signal to DB (no Gemini call needed)."""
    sku_id_str = str(sku.id)
    signal_type = cached["signal"]

    if check_and_set_dedup(redis_client, sku_id_str, signal_type):
        return None

    price_suggestion: Optional[Decimal] = None
    if cached.get("price_suggestion") is not None:
        price_suggestion = Decimal(str(cached["price_suggestion"])).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )

    confidence = Decimal(str(cached["confidence"])).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )

    signal = Signal(
        sku_id=sku.id,
        type=signal_type,
        confidence=confidence,
        reasoning=cached["reasoning"],
        price_suggestion=price_suggestion,
        source="ai",
        ai_fallback=False,
        ai_model=MODEL_NAME,
    )
    session.add(signal)
    return signal
