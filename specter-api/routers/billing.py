"""
Razorpay billing & subscriptions (Prompt 15 / PRICING.md).

Routes:
  POST   /billing/subscribe      — start a subscription for a self-serve plan
  POST   /billing/upgrade        — move to a strictly higher plan
  POST   /billing/downgrade      — immediate downgrade (pause excess SKUs, drop add-ons)
  POST   /billing/addon          — add an à-la-carte add-on (max 3, no duplicates)
  DELETE /billing/addon/{id}     — remove an add-on (cancels its Razorpay sub)
  POST   /billing/webhook        — Razorpay webhook (HMAC-verified; no auth)

Plan elevation (subscribe/upgrade) is applied by the webhook on
subscription.activated / subscription.charged — the API endpoints only kick off
the Razorpay subscription. Downgrade is applied immediately in the DB.
"""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.plan_gate import PLAN_HIERARCHY, plan_competitor_limit, plan_max_skus
from auth.supabase import get_current_merchant
from db import get_db
from models.merchant_addons import MerchantAddon
from models.merchants import Merchant
from models.skus import SKU
from services import billing
from services.retention import schedule_downgrade_deletion

router = APIRouter(prefix="/billing", tags=["billing"])


def _unix_to_dt(value: object) -> Optional[datetime]:
    """Razorpay sends period timestamps as Unix epoch seconds. Parse to an
    aware datetime; return None for missing/garbage values."""
    if value in (None, "", 0):
        return None
    try:
        return datetime.fromtimestamp(int(value), tz=timezone.utc)
    except (ValueError, TypeError, OSError):
        return None


# ── Schemas ──────────────────────────────────────────────────────────────────

class SubscribeIn(BaseModel):
    plan: str
    cadence: str = "monthly"


class DowngradeIn(BaseModel):
    plan: str


class AddonIn(BaseModel):
    addon_type: str


class SubscriptionOut(BaseModel):
    subscription_id: str
    status: Optional[str] = None
    short_url: Optional[str] = None


class AddonOut(BaseModel):
    id: uuid.UUID
    addon_type: str
    razorpay_subscription_id: Optional[str] = None


class CancelOut(BaseModel):
    cancel_at: Optional[str] = None
    status: str = "cancel_scheduled"


# ── Helpers ──────────────────────────────────────────────────────────────────

def _plan_index(plan: str) -> int:
    try:
        return PLAN_HIERARCHY.index(plan.lower())
    except ValueError:
        return -1


async def _start_subscription(
    session: AsyncSession, merchant: Merchant, plan: str, cadence: str
) -> SubscriptionOut:
    """Validate + create a Razorpay subscription; persist its id. The webhook
    elevates merchants.plan once Razorpay confirms activation/charge."""
    plan = plan.lower()
    cadence = cadence.lower()
    if not billing.is_self_serve_plan(plan):
        # Covers ECLIPSE (sales-led) and any unknown plan string.
        raise HTTPException(400, detail={"error": "plan_not_self_serve", "plan": plan})
    if cadence not in billing.CADENCES:
        raise HTTPException(400, detail={"error": "invalid_cadence", "cadence": cadence})
    plan_id = billing.plan_id_for(plan, cadence)
    if not plan_id:
        raise HTTPException(500, detail={"error": "plan_not_configured", "plan": plan, "cadence": cadence})

    sub = await billing.create_subscription(plan_id, merchant_id=str(merchant.id))
    if not sub or not sub.get("id"):
        raise HTTPException(502, detail={"error": "razorpay_error"})

    merchant.razorpay_subscription_id = sub["id"]
    await session.commit()
    return SubscriptionOut(subscription_id=sub["id"], status=sub.get("status"), short_url=sub.get("short_url"))


# ── Subscribe / upgrade ──────────────────────────────────────────────────────

@router.post("/subscribe", response_model=SubscriptionOut)
async def subscribe(
    body: SubscribeIn,
    merchant: Merchant = Depends(get_current_merchant),
    session: AsyncSession = Depends(get_db),
) -> SubscriptionOut:
    return await _start_subscription(session, merchant, body.plan, body.cadence)


@router.post("/upgrade", response_model=SubscriptionOut)
async def upgrade(
    body: SubscribeIn,
    merchant: Merchant = Depends(get_current_merchant),
    session: AsyncSession = Depends(get_db),
) -> SubscriptionOut:
    if _plan_index(body.plan) <= _plan_index(merchant.plan):
        raise HTTPException(400, detail={"error": "not_an_upgrade",
                                         "current_plan": merchant.plan, "target_plan": body.plan.lower()})
    return await _start_subscription(session, merchant, body.plan, body.cadence)


# ── Downgrade (immediate) ────────────────────────────────────────────────────

async def apply_downgrade(session: AsyncSession, merchant: Merchant, target: str) -> dict:
    """Apply a plan-lowering transition (used by POST /downgrade AND the
    subscription.cancelled webhook → free). Pauses SKUs above the target
    ceiling, cancels + drops every add-on, applies the plan + competitor limit,
    and schedules grace deletion when 90-day retention is lost. Commits.

    `target` must already be validated as a real, strictly-lower plan by the
    caller; this helper does no ordering checks.
    """
    # 1. Pause SKUs above the new plan's ceiling (active=false, never deleted).
    new_limit = plan_max_skus(target)  # int or None (ECLIPSE only — not a target here)
    paused = 0
    if new_limit is not None:
        stmt = (
            select(SKU)
            .where(SKU.merchant_id == merchant.id, SKU.active.is_(True))
            .order_by(SKU.created_at.asc())
        )
        active_skus = list((await session.execute(stmt)).scalars().all())
        for sku in active_skus[new_limit:]:
            sku.active = False
            paused += 1

    # 2. Cancel + delete every add-on immediately (add-ons don't carry over).
    addon_stmt = select(MerchantAddon).where(MerchantAddon.merchant_id == merchant.id)
    addons = list((await session.execute(addon_stmt)).scalars().all())
    for addon in addons:
        if addon.razorpay_subscription_id:
            await billing.cancel_subscription(addon.razorpay_subscription_id)
    await session.execute(delete(MerchantAddon).where(MerchantAddon.merchant_id == merchant.id))

    # 3. Apply the plan change + competitor ceiling immediately.
    from services.retention import RETENTION_DAYS_LONG, retention_days

    was_90d = retention_days(merchant.plan) == RETENTION_DAYS_LONG
    now_90d = retention_days(target) == RETENTION_DAYS_LONG
    merchant.plan = target
    merchant.max_competitors_per_sku = plan_competitor_limit(target)
    await session.commit()

    # 4. Losing 90-day retention: schedule a 7-day grace deletion of >30-day
    #    history. Runs AFTER commit so this merchant no longer counts as a
    #    90-day tracker (otherwise its own URLs would be excluded).
    scheduled = 0
    if was_90d and not now_90d:
        scheduled = await schedule_downgrade_deletion(session, merchant.id)

    return {
        "plan": target,
        "skus_paused": paused,
        "addons_removed": len(addons),
        "snapshots_scheduled_for_deletion": scheduled,
    }


@router.post("/downgrade")
async def downgrade(
    body: DowngradeIn,
    merchant: Merchant = Depends(get_current_merchant),
    session: AsyncSession = Depends(get_db),
) -> dict:
    target = body.plan.lower()
    if _plan_index(target) < 0:
        raise HTTPException(400, detail={"error": "invalid_plan", "plan": target})
    if _plan_index(target) >= _plan_index(merchant.plan):
        raise HTTPException(400, detail={"error": "not_a_downgrade",
                                         "current_plan": merchant.plan, "target_plan": target})
    return await apply_downgrade(session, merchant, target)


# ── Cancel at period end ─────────────────────────────────────────────────────

@router.post("/cancel", response_model=CancelOut)
async def cancel(
    merchant: Merchant = Depends(get_current_merchant),
    session: AsyncSession = Depends(get_db),
) -> CancelOut:
    """Cancel at the end of the current billing period. The merchant keeps their
    plan until then; auto-renew stops. The actual drop to `free` happens when
    Razorpay POSTs subscription.cancelled to the webhook."""
    sub_id = merchant.razorpay_subscription_id
    if not sub_id:
        raise HTTPException(400, detail={"error": "no_active_subscription"})

    # Idempotent: if a cancellation is already scheduled, don't re-hit Razorpay.
    if merchant.subscription_cancel_at is not None:
        return CancelOut(cancel_at=merchant.subscription_cancel_at.isoformat())

    ok = await billing.cancel_subscription(sub_id, cancel_at_cycle_end=True)
    if not ok:
        raise HTTPException(502, detail={"error": "razorpay_error"})

    # Access lapses at the current period end (the next renewal we last recorded).
    merchant.subscription_cancel_at = merchant.subscription_current_end
    await session.commit()
    return CancelOut(
        cancel_at=merchant.subscription_cancel_at.isoformat() if merchant.subscription_cancel_at else None,
    )


# ── Add-ons ──────────────────────────────────────────────────────────────────

@router.post("/addon", response_model=AddonOut, status_code=status.HTTP_201_CREATED)
async def add_addon(
    body: AddonIn,
    merchant: Merchant = Depends(get_current_merchant),
    session: AsyncSession = Depends(get_db),
) -> AddonOut:
    addon_type = body.addon_type
    if addon_type not in billing.ADDONS:
        raise HTTPException(400, detail={"error": "invalid_addon", "addon_type": addon_type})
    if not billing.addon_allowed_on(addon_type, merchant.plan):
        raise HTTPException(400, detail={"error": "addon_not_available_on_plan",
                                         "addon_type": addon_type, "plan": merchant.plan})

    # Cap: max 3 active add-ons per account (checked first so the 4th is rejected).
    count = (
        await session.execute(
            select(func.count()).select_from(MerchantAddon).where(MerchantAddon.merchant_id == merchant.id)
        )
    ).scalar_one()
    if count >= billing.MAX_ADDONS:
        raise HTTPException(400, detail={"error": "addon_limit_reached"})

    # No stacking the same add-on type (PRICING.md).
    dup = (
        await session.execute(
            select(MerchantAddon).where(
                MerchantAddon.merchant_id == merchant.id,
                MerchantAddon.addon_type == addon_type,
            )
        )
    ).scalar_one_or_none()
    if dup is not None:
        raise HTTPException(409, detail={"error": "addon_already_active", "addon_type": addon_type})

    plan_id = billing.addon_plan_id(addon_type)
    if not plan_id:
        raise HTTPException(500, detail={"error": "addon_not_configured", "addon_type": addon_type})

    sub = await billing.create_subscription(plan_id, merchant_id=str(merchant.id))
    if not sub or not sub.get("id"):
        raise HTTPException(502, detail={"error": "razorpay_error"})

    row = MerchantAddon(
        merchant_id=merchant.id,
        addon_type=addon_type,
        quantity=1,
        razorpay_subscription_id=sub["id"],
    )
    session.add(row)
    await session.flush()
    await session.commit()
    return AddonOut(id=row.id, addon_type=addon_type, razorpay_subscription_id=sub["id"])


@router.delete("/addon/{addon_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def remove_addon(
    addon_id: uuid.UUID,
    merchant: Merchant = Depends(get_current_merchant),
    session: AsyncSession = Depends(get_db),
) -> Response:
    row = await session.get(MerchantAddon, addon_id)
    if row is None or row.merchant_id != merchant.id:
        raise HTTPException(404, detail={"error": "addon_not_found"})
    if row.razorpay_subscription_id:
        await billing.cancel_subscription(row.razorpay_subscription_id)
    await session.delete(row)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/addons", response_model=list[AddonOut])
async def list_addons(
    merchant: Merchant = Depends(get_current_merchant),
    session: AsyncSession = Depends(get_db),
) -> list[AddonOut]:
    rows = list((
        await session.execute(
            select(MerchantAddon).where(MerchantAddon.merchant_id == merchant.id)
        )
    ).scalars().all())
    return [
        AddonOut(id=r.id, addon_type=r.addon_type, razorpay_subscription_id=r.razorpay_subscription_id)
        for r in rows
    ]


# ── Webhook (no auth — verified by HMAC signature) ───────────────────────────

async def _resolve_merchant(session: AsyncSession, entity: dict) -> Optional[Merchant]:
    """Map a Razorpay subscription entity back to a Merchant via notes.merchant_id
    (preferred) or razorpay_subscription_id (fallback)."""
    sub_id = entity.get("id")
    notes = entity.get("notes") or {}
    merchant_id = notes.get("merchant_id")

    merchant: Optional[Merchant] = None
    if merchant_id:
        try:
            merchant = await session.get(Merchant, uuid.UUID(str(merchant_id)))
        except (ValueError, TypeError):
            merchant = None
    if merchant is None and sub_id:
        merchant = (
            await session.execute(select(Merchant).where(Merchant.razorpay_subscription_id == sub_id))
        ).scalar_one_or_none()
    return merchant


async def _apply_cancellation(session: AsyncSession, entity: dict) -> None:
    """Apply a subscription.cancelled to a base-plan subscription: drop the
    merchant to free at period end (reusing the downgrade transition) and clear
    the subscription fields. Add-on cancellations are ignored here."""
    if billing.plan_from_plan_id(entity.get("plan_id")) is None:
        return  # add-on or unknown plan id — not a base-plan cancellation
    merchant = await _resolve_merchant(session, entity)
    if merchant is None or merchant.plan == "free":
        return
    # Clear the subscription fields BEFORE apply_downgrade so the plan drop and
    # the field clearing land in a single committed transaction (apply_downgrade
    # commits internally). A second commit here would split them across two
    # transactions: a crash in between would leave the merchant on free with a
    # stale razorpay_subscription_id that webhook redelivery could never clear
    # (the plan == "free" guard above would short-circuit it forever).
    merchant.razorpay_subscription_id = None
    merchant.subscription_current_end = None
    merchant.subscription_cancel_at = None
    await apply_downgrade(session, merchant, "free")


async def _apply_activation(session: AsyncSession, entity: dict) -> None:
    """Apply a subscription.activated / subscription.charged to merchants.plan."""
    plan_id = entity.get("plan_id")
    target_plan = billing.plan_from_plan_id(plan_id)
    if target_plan is None:
        # Add-on subscription or unknown plan id — no base-plan change.
        return

    merchant = await _resolve_merchant(session, entity)
    if merchant is None:
        return

    merchant.plan = target_plan
    merchant.razorpay_subscription_id = entity.get("id")
    merchant.trial_ends_at = None
    merchant.read_only = False
    merchant.max_competitors_per_sku = plan_competitor_limit(target_plan)
    merchant.subscription_current_end = _unix_to_dt(entity.get("current_end"))
    merchant.subscription_cancel_at = None  # a fresh charge clears any pending cancel
    await session.commit()


@router.post("/webhook")
async def webhook(request: Request, session: AsyncSession = Depends(get_db)) -> dict:
    raw = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")
    if not billing.verify_webhook_signature(raw, signature):
        raise HTTPException(status_code=400, detail={"error": "invalid_signature"})

    try:
        event = json.loads(raw)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail={"error": "invalid_payload"})

    etype = event.get("event")
    if etype in ("subscription.activated", "subscription.charged"):
        entity = (event.get("payload", {}).get("subscription", {}) or {}).get("entity", {}) or {}
        await _apply_activation(session, entity)
    elif etype == "subscription.cancelled":
        entity = (event.get("payload", {}).get("subscription", {}) or {}).get("entity", {}) or {}
        await _apply_cancellation(session, entity)

    return {"status": "ok", "event": etype}
