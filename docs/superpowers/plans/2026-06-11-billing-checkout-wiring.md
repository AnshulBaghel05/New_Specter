# Billing & Checkout Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the existing Razorpay subscription backend to the frontend so a visitor can sign up, start a trial, check out, reach a paid plan, and self-manage their subscription (including cancel-at-period-end).

**Architecture:** Backend adds two merchant columns (renewal/cancel dates), a `POST /billing/cancel` (cancel-at-cycle-end), a `GET /billing/addons`, and a `subscription.cancelled` webhook branch that reuses the existing downgrade transition. Frontend adds pure helpers (`intent`, `checkout`), TanStack hooks, dual-CTA pricing, success/cancel routes, an intent-resume hook, and a settings billing card. Plan elevation stays webhook-authoritative; the success page polls `/merchants/me`.

**Tech Stack:** FastAPI + SQLAlchemy async + Alembic (specter-api); Next.js 14 App Router + TanStack Query + Supabase + Razorpay checkout.js (specter-web). Tests: `pytest` (backend), `vitest` (frontend pure modules only — never UI/marketing components per repo rule).

**Branch:** `billing-checkout-wiring` (already created; the design spec commit is its first commit).

---

## File Structure

**specter-api (backend):**
- `models/merchants.py` — add `subscription_current_end`, `subscription_cancel_at` columns.
- `alembic/versions/0012_subscription_periods.py` — **new** migration for the two columns.
- `supabase/migrations/0012_subscription_periods.sql` — **new** Supabase SQL mirror.
- `routers/merchants.py` — expose the two new fields on `MerchantOut`/`get_me`.
- `routers/billing.py` — extract `apply_downgrade()` + `_resolve_merchant()` helpers; add `POST /cancel`, `GET /addons`; webhook stamps `subscription_current_end` and handles `subscription.cancelled`.
- `routers/test_billing.py` — extend with cancel, addons-list, cancelled-webhook, current-end tests; fix `make_merchant`.
- `routers/test_merchants.py` — fix `make_merchant` so the new `get_me` fields are `None`.

**specter-web (frontend):**
- `lib/billing/intent.ts` (+ `lib/billing/intent.test.ts`) — **new** pure intent persistence.
- `lib/billing/checkout.ts` (+ `lib/billing/checkout.test.ts`) — **new** checkout.js loader + fallback selection.
- `lib/api.ts` — add `Merchant` fields, `Addon` type, and billing hooks.
- `hooks/use-resume-intent.ts` — **new** one-shot intent resume on authed mount.
- `app/(dashboard)/layout.tsx` — mount the resume hook.
- `app/(marketing)/pricing/page.tsx` — dual CTA per self-serve card + auth-aware intent.
- `app/(dashboard)/billing/success/page.tsx` — **new** polling success route.
- `app/(dashboard)/billing/cancel/page.tsx` — **new** cancel-return route.
- `components/dashboard/settings/billing-card.tsx` — **new** subscription management card.
- `app/(dashboard)/settings/page.tsx` — render the billing card.
- `components/dashboard/pql-upgrade-modal.tsx` — trial CTA → `useStartTrial()`.
- `.env.example` / docs — `NEXT_PUBLIC_RAZORPAY_KEY_ID`.

---

## Task 1: Add subscription-period columns to the Merchant model + migration

**Files:**
- Modify: `specter-api/models/merchants.py:17-18`
- Create: `specter-api/alembic/versions/0012_subscription_periods.py`
- Create: `specter-api/supabase/migrations/0012_subscription_periods.sql`

- [ ] **Step 1: Add the two columns to the model**

In `specter-api/models/merchants.py`, immediately after the `razorpay_subscription_id` line (line 17), add:

```python
    # Next auto-renew timestamp (Razorpay subscription `current_end`), stamped by
    # the webhook on subscription.activated/charged. Drives "Next renewal: …".
    subscription_current_end: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    # When a cancel-at-period-end was requested: the date access lapses. Set by
    # POST /billing/cancel; cleared on (re)activation. Drives "Cancels on …".
    subscription_cancel_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
```

- [ ] **Step 2: Write the Alembic migration**

Create `specter-api/alembic/versions/0012_subscription_periods.py`:

```python
"""subscription period columns — renewal + cancel-at-period-end dates

Revision ID: 0012
Revises: 0011
Create Date: 2026-06-11

Cancel-at-period-end UX (billing checkout wiring) needs to show the next renewal
date and, when a cancellation is scheduled, the date access lapses. Both are
nullable so existing rows and non-Razorpay test stubs are unaffected.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0012"
down_revision: Union[str, None] = "0011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("merchants", sa.Column("subscription_current_end", sa.DateTime(timezone=True), nullable=True))
    op.add_column("merchants", sa.Column("subscription_cancel_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("merchants", "subscription_cancel_at")
    op.drop_column("merchants", "subscription_current_end")
```

- [ ] **Step 3: Write the Supabase SQL mirror**

Create `specter-api/supabase/migrations/0012_subscription_periods.sql`:

```sql
-- Subscription period columns for cancel-at-period-end UX (billing checkout wiring).
alter table public.merchants add column if not exists subscription_current_end timestamptz;
alter table public.merchants add column if not exists subscription_cancel_at timestamptz;
```

- [ ] **Step 4: Verify the model still imports**

Run: `cd specter-api && .venv/Scripts/python.exe -c "from models.merchants import Merchant; print(Merchant.subscription_current_end, Merchant.subscription_cancel_at)"`
Expected: prints two column references, no ImportError.

- [ ] **Step 5: Commit**

```bash
git add specter-api/models/merchants.py specter-api/alembic/versions/0012_subscription_periods.py specter-api/supabase/migrations/0012_subscription_periods.sql
git commit -m "feat(billing): add subscription_current_end + subscription_cancel_at to merchants"
```

---

## Task 2: Expose the new fields on `MerchantOut` / `get_me`

**Files:**
- Modify: `specter-api/routers/merchants.py:76-89` (schema) and `:202-216` (get_me)
- Modify: `specter-api/routers/test_merchants.py:63-81` (make_merchant fixture)

- [ ] **Step 1: Update the test fixture first (it would otherwise break)**

In `specter-api/routers/test_merchants.py`, inside `make_merchant` (after the `m.razorpay_subscription_id` is set — note this fixture currently does NOT set it; add all three), add these lines just before `return m` (around line 80):

```python
    m.razorpay_subscription_id = None
    m.subscription_current_end = None
    m.subscription_cancel_at = None
```

> Why: `MagicMock(spec=Merchant)` auto-returns a truthy `MagicMock` for unset attributes. The new `get_me` calls `.isoformat()` only when the attribute is truthy, so an unset mock would produce a `MagicMock` where a `str|None` is required and fail Pydantic validation. Setting them to `None` matches a fresh merchant.

- [ ] **Step 2: Add the fields to the `MerchantOut` schema**

In `specter-api/routers/merchants.py`, in `class MerchantOut` (after `email_notifications_enabled: bool`, line 87), add:

```python
    subscription_current_end: Optional[str] = None
    subscription_cancel_at: Optional[str] = None
```

- [ ] **Step 3: Populate them in `get_me`**

In `specter-api/routers/merchants.py`, in `get_me`'s `MerchantOut(...)` (before the closing `)`, after `email_notifications_enabled=...`, line 215), add:

```python
        subscription_current_end=merchant.subscription_current_end.isoformat() if merchant.subscription_current_end else None,
        subscription_cancel_at=merchant.subscription_cancel_at.isoformat() if merchant.subscription_cancel_at else None,
```

- [ ] **Step 4: Run the merchants tests**

Run: `cd specter-api && .venv/Scripts/python.exe -m pytest routers/test_merchants.py -q`
Expected: PASS (same count as before; the `get_me` test now also serializes the two null fields).

- [ ] **Step 5: Commit**

```bash
git add specter-api/routers/merchants.py specter-api/routers/test_merchants.py
git commit -m "feat(billing): expose subscription period fields on GET /merchants/me"
```

---

## Task 3: Extract `apply_downgrade()` + `_resolve_merchant()` helpers (refactor, behavior-preserving)

**Files:**
- Modify: `specter-api/routers/billing.py:125-182` (downgrade) and `:259-289` (webhook helpers)

This refactor changes no behavior — the existing `routers/test_billing.py` downgrade + activation tests must stay green. It prepares the shared transition used by the cancelled-webhook branch (Task 5).

- [ ] **Step 1: Add a unix-timestamp helper near the top of `routers/billing.py`**

After the imports / before `# ── Schemas`, add:

```python
from datetime import datetime, timezone


def _unix_to_dt(value: object) -> Optional[datetime]:
    """Razorpay sends period timestamps as Unix epoch seconds. Parse to an
    aware datetime; return None for missing/garbage values."""
    if value in (None, "", 0):
        return None
    try:
        return datetime.fromtimestamp(int(value), tz=timezone.utc)
    except (ValueError, TypeError, OSError):
        return None
```

- [ ] **Step 2: Extract `apply_downgrade()` from the `downgrade` endpoint body**

Replace the body of the `downgrade` endpoint (the code between its signature and `return {...}`, lines ~131-182) so the function delegates to a reusable helper. The new helper goes **above** the `downgrade` endpoint:

```python
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
```

Then the `downgrade` endpoint becomes just its validation + a delegating call:

```python
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
```

> Note: the `from services.retention import ...` import that previously lived inside the endpoint now lives inside `apply_downgrade` — do not leave a duplicate in `downgrade`.

- [ ] **Step 3: Extract `_resolve_merchant()` from `_apply_activation`**

Above `_apply_activation`, add:

```python
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
```

Then rewrite `_apply_activation` to use it and to stamp `subscription_current_end` + clear `subscription_cancel_at`:

```python
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
```

- [ ] **Step 4: Run the existing billing tests (must stay green)**

Run: `cd specter-api && .venv/Scripts/python.exe -m pytest routers/test_billing.py -q`
Expected: PASS — all existing downgrade/activation/addon/subscribe tests unchanged.

- [ ] **Step 5: Commit**

```bash
git add specter-api/routers/billing.py
git commit -m "refactor(billing): extract apply_downgrade + _resolve_merchant; stamp current_end on activation"
```

---

## Task 4: `POST /billing/cancel` (cancel at period end) + `GET /billing/addons`

**Files:**
- Modify: `specter-api/routers/billing.py` (add schemas + two routes)
- Modify: `specter-api/routers/test_billing.py` (fix `make_merchant`; add tests)

- [ ] **Step 1: Fix `make_merchant` in test_billing.py**

In `specter-api/routers/test_billing.py`, in `make_merchant` (after `m.max_competitors_per_sku = 3`, line 64), add:

```python
    m.subscription_current_end = None
    m.subscription_cancel_at = None
```

- [ ] **Step 2: Write the failing cancel test**

Add to `specter-api/routers/test_billing.py` (new class):

```python
class TestCancel:
    def test_cancel_marks_period_end_and_calls_razorpay(self, client):
        """POST /billing/cancel → Razorpay cancel(cancel_at_cycle_end=True),
        stamps subscription_cancel_at from the known renewal date."""
        from datetime import datetime, timezone
        merchant = make_merchant(plan="cipher")
        merchant.razorpay_subscription_id = "sub_LIVE"
        merchant.subscription_current_end = datetime(2026, 7, 10, tzinfo=timezone.utc)
        session = AsyncMock()
        session.commit = AsyncMock()
        app.dependency_overrides[get_current_merchant] = override_merchant(merchant)
        app.dependency_overrides[get_db] = override_db(session)

        with patch("services.billing.cancel_subscription",
                   new=AsyncMock(return_value=True)) as cancel:
            resp = client.post("/billing/cancel")

        assert resp.status_code == 200
        assert resp.json()["cancel_at"] == "2026-07-10T00:00:00+00:00"
        assert merchant.subscription_cancel_at == merchant.subscription_current_end
        cancel.assert_awaited_once_with("sub_LIVE", cancel_at_cycle_end=True)
        session.commit.assert_awaited()

    def test_cancel_without_subscription_returns_400(self, client):
        merchant = make_merchant(plan="free")
        merchant.razorpay_subscription_id = None
        app.dependency_overrides[get_current_merchant] = override_merchant(merchant)
        app.dependency_overrides[get_db] = override_db(AsyncMock())
        resp = client.post("/billing/cancel")
        assert resp.status_code == 400
        assert resp.json()["detail"]["error"] == "no_active_subscription"
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd specter-api && .venv/Scripts/python.exe -m pytest routers/test_billing.py::TestCancel -q`
Expected: FAIL with 404 (route not found yet).

- [ ] **Step 4: Implement the cancel + addons-list schemas and routes**

In `specter-api/routers/billing.py`, add a schema near the others:

```python
class CancelOut(BaseModel):
    cancel_at: Optional[str] = None
    status: str = "cancel_scheduled"
```

Add the cancel route (after the `downgrade` endpoint):

```python
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

    ok = await billing.cancel_subscription(sub_id, cancel_at_cycle_end=True)
    if not ok:
        raise HTTPException(502, detail={"error": "razorpay_error"})

    # Access lapses at the current period end (the next renewal we last recorded).
    merchant.subscription_cancel_at = merchant.subscription_current_end
    await session.commit()
    return CancelOut(
        cancel_at=merchant.subscription_cancel_at.isoformat() if merchant.subscription_cancel_at else None,
    )
```

Add the addons-list route (after the existing `remove_addon`):

```python
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
```

- [ ] **Step 5: Write the failing addons-list test**

Add to `specter-api/routers/test_billing.py`:

```python
class TestListAddons:
    def test_list_returns_merchant_addons(self, client):
        import uuid as _uuid
        merchant = make_merchant(plan="cipher")
        row = MagicMock(spec=MerchantAddon)
        row.id = _uuid.uuid4()
        row.addon_type = "sku_50"
        row.razorpay_subscription_id = "sub_addon_x"
        result = MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[row]))))
        session = AsyncMock()
        session.execute = AsyncMock(return_value=result)
        app.dependency_overrides[get_current_merchant] = override_merchant(merchant)
        app.dependency_overrides[get_db] = override_db(session)

        resp = client.get("/billing/addons")
        assert resp.status_code == 200
        body = resp.json()
        assert len(body) == 1
        assert body[0]["addon_type"] == "sku_50"
        assert body[0]["razorpay_subscription_id"] == "sub_addon_x"
```

- [ ] **Step 6: Run the new tests**

Run: `cd specter-api && .venv/Scripts/python.exe -m pytest routers/test_billing.py::TestCancel routers/test_billing.py::TestListAddons -q`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add specter-api/routers/billing.py specter-api/routers/test_billing.py
git commit -m "feat(billing): POST /billing/cancel (period-end) + GET /billing/addons"
```

---

## Task 5: Webhook handles `subscription.cancelled` → drop to free at period end

**Files:**
- Modify: `specter-api/routers/billing.py` (webhook event dispatch + handler)
- Modify: `specter-api/routers/test_billing.py` (add cancelled-webhook + current_end tests)

- [ ] **Step 1: Write the failing cancelled-webhook test**

Add to `specter-api/routers/test_billing.py`, inside `class TestWebhookEndpoint` (reuse its `_post` helper):

```python
    def test_cancelled_drops_plan_to_free(self, client):
        """subscription.cancelled for a base plan → merchant falls to free."""
        merchant = make_merchant(plan="cipher")
        merchant.razorpay_subscription_id = "sub_LIVE"
        # apply_downgrade does 3 executes: select SKUs, select add-ons, delete add-ons.
        empty = MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[]))))
        session = AsyncMock()
        session.get = AsyncMock(return_value=merchant)
        session.execute = AsyncMock(side_effect=[empty, empty, MagicMock()])
        session.commit = AsyncMock()

        body = {
            "event": "subscription.cancelled",
            "payload": {"subscription": {"entity": {
                "id": "sub_LIVE",
                "plan_id": "plan_cipher_monthly",
                "notes": {"merchant_id": str(merchant.id)},
            }}},
        }
        resp = self._post(client, body, session=session)

        assert resp.status_code == 200
        assert merchant.plan == "free"
        assert merchant.razorpay_subscription_id is None
        assert merchant.subscription_cancel_at is None
        assert merchant.subscription_current_end is None

    def test_cancelled_for_addon_plan_id_is_ignored(self, client):
        """An add-on subscription.cancelled must NOT change the base plan."""
        merchant = make_merchant(plan="cipher")
        session = AsyncMock()
        session.get = AsyncMock(return_value=merchant)
        session.commit = AsyncMock()
        body = {
            "event": "subscription.cancelled",
            "payload": {"subscription": {"entity": {
                "id": "sub_addon", "plan_id": "plan_addon_50",
                "notes": {"merchant_id": str(merchant.id)},
            }}},
        }
        resp = self._post(client, body, session=session)
        assert resp.status_code == 200
        assert merchant.plan == "cipher"  # unchanged

    def test_activation_stamps_current_end(self, client):
        merchant = make_merchant(plan="free")
        session = AsyncMock()
        session.get = AsyncMock(return_value=merchant)
        session.commit = AsyncMock()
        body = {
            "event": "subscription.activated",
            "payload": {"subscription": {"entity": {
                "id": "sub_A", "plan_id": "plan_recon_monthly",
                "current_end": 1783036800,  # 2026-07-13T00:00:00Z
                "notes": {"merchant_id": str(merchant.id)},
            }}},
        }
        resp = self._post(client, body, session=session)
        assert resp.status_code == 200
        assert merchant.subscription_current_end is not None
        assert merchant.subscription_current_end.year == 2026
```

- [ ] **Step 2: Run to verify the cancelled tests fail**

Run: `cd specter-api && .venv/Scripts/python.exe -m pytest "routers/test_billing.py::TestWebhookEndpoint::test_cancelled_drops_plan_to_free" -q`
Expected: FAIL — `subscription.cancelled` is not handled, so `merchant.plan` stays `cipher`.

- [ ] **Step 3: Add the cancelled handler**

In `specter-api/routers/billing.py`, add a handler above the `webhook` endpoint:

```python
async def _apply_cancellation(session: AsyncSession, entity: dict) -> None:
    """Apply a subscription.cancelled to a base-plan subscription: drop the
    merchant to free at period end (reusing the downgrade transition) and clear
    the subscription fields. Add-on cancellations are ignored here."""
    if billing.plan_from_plan_id(entity.get("plan_id")) is None:
        return  # add-on or unknown plan id — not a base-plan cancellation
    merchant = await _resolve_merchant(session, entity)
    if merchant is None or merchant.plan == "free":
        return
    await apply_downgrade(session, merchant, "free")
    merchant.razorpay_subscription_id = None
    merchant.subscription_current_end = None
    merchant.subscription_cancel_at = None
    await session.commit()
```

- [ ] **Step 4: Dispatch the new event in the webhook**

In the `webhook` endpoint, extend the event dispatch:

```python
    etype = event.get("event")
    if etype in ("subscription.activated", "subscription.charged"):
        entity = (event.get("payload", {}).get("subscription", {}) or {}).get("entity", {}) or {}
        await _apply_activation(session, entity)
    elif etype == "subscription.cancelled":
        entity = (event.get("payload", {}).get("subscription", {}) or {}).get("entity", {}) or {}
        await _apply_cancellation(session, entity)

    return {"status": "ok", "event": etype}
```

- [ ] **Step 5: Run the full billing suite**

Run: `cd specter-api && .venv/Scripts/python.exe -m pytest routers/test_billing.py -q`
Expected: PASS (all old + new tests).

- [ ] **Step 6: Run the whole backend suite (no regressions)**

Run: `cd specter-api && .venv/Scripts/python.exe -m pytest -q`
Expected: PASS — full suite green.

- [ ] **Step 7: Commit**

```bash
git add specter-api/routers/billing.py specter-api/routers/test_billing.py
git commit -m "feat(billing): webhook subscription.cancelled drops to free at period end"
```

---

## Task 6: Frontend pure helper — billing intent persistence

**Files:**
- Create: `specter-web/lib/billing/intent.ts`
- Test: `specter-web/lib/billing/intent.test.ts`

- [ ] **Step 1: Write the failing test**

Create `specter-web/lib/billing/intent.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { saveIntent, readIntent, clearIntent, isFresh, type BillingIntent } from './intent'

const store: Record<string, string> = {}
beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k]
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v },
    removeItem: (k: string) => { delete store[k] },
  })
})

describe('billing intent', () => {
  it('round-trips a saved intent', () => {
    saveIntent({ action: 'buy', plan: 'cipher', cadence: 'monthly' })
    const got = readIntent()
    expect(got?.action).toBe('buy')
    expect(got?.plan).toBe('cipher')
    expect(got?.cadence).toBe('monthly')
    expect(typeof got?.ts).toBe('number')
  })

  it('returns null when nothing is stored', () => {
    expect(readIntent()).toBeNull()
  })

  it('returns null for corrupt JSON', () => {
    store['specter.billing_intent'] = '{not json'
    expect(readIntent()).toBeNull()
  })

  it('clearIntent removes the stored value', () => {
    saveIntent({ action: 'trial', plan: 'recon', cadence: 'monthly' })
    clearIntent()
    expect(readIntent()).toBeNull()
  })

  it('isFresh is true within the TTL and false beyond it', () => {
    const recent: BillingIntent = { action: 'buy', plan: 'recon', cadence: 'monthly', ts: Date.now() }
    const stale: BillingIntent = { action: 'buy', plan: 'recon', cadence: 'monthly', ts: Date.now() - 2 * 60 * 60 * 1000 }
    expect(isFresh(recent)).toBe(true)
    expect(isFresh(stale)).toBe(false)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd specter-web && node node_modules/vitest/vitest.mjs run lib/billing/intent.test.ts`
Expected: FAIL — module `./intent` does not exist.

- [ ] **Step 3: Implement the module**

Create `specter-web/lib/billing/intent.ts`:

```ts
/**
 * Billing intent preservation.
 *
 * A logged-out visitor who clicks "Buy" / "Start trial" on /pricing must not
 * lose that choice through the Supabase email-confirm round-trip. We stash a
 * tiny intent in localStorage, send them to /sign-up, and resume it ONCE on the
 * first authenticated dashboard load (see hooks/use-resume-intent.ts).
 *
 * Pure module — no React, no network — so it is unit-testable in isolation.
 */
export type BillingAction = 'trial' | 'buy'
export type BillingCadence = 'monthly' | 'annual'

export interface BillingIntent {
  action: BillingAction
  plan: string
  cadence: BillingCadence
  ts: number
}

const KEY = 'specter.billing_intent'
const TTL_MS = 60 * 60 * 1000 // 1 hour — a stale intent must never auto-charge

export function saveIntent(intent: Omit<BillingIntent, 'ts'>): void {
  if (typeof localStorage === 'undefined') return
  const withTs: BillingIntent = { ...intent, ts: Date.now() }
  try {
    localStorage.setItem(KEY, JSON.stringify(withTs))
  } catch {
    /* storage full / disabled — intent is best-effort */
  }
}

export function readIntent(): BillingIntent | null {
  if (typeof localStorage === 'undefined') return null
  const raw = localStorage.getItem(KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as BillingIntent
    if (parsed && (parsed.action === 'trial' || parsed.action === 'buy') && typeof parsed.ts === 'number') {
      return parsed
    }
    return null
  } catch {
    return null
  }
}

export function clearIntent(): void {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(KEY)
}

export function isFresh(intent: BillingIntent, now: number = Date.now()): boolean {
  return now - intent.ts <= TTL_MS
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd specter-web && node node_modules/vitest/vitest.mjs run lib/billing/intent.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add specter-web/lib/billing/intent.ts specter-web/lib/billing/intent.test.ts
git commit -m "feat(billing): pure billing-intent persistence helper"
```

---

## Task 7: Frontend pure helper — checkout.js loader + fallback selection

**Files:**
- Create: `specter-web/lib/billing/checkout.ts`
- Test: `specter-web/lib/billing/checkout.test.ts`

The testable core is the *decision*: given (key present?, script loaded?), do we open the embedded modal or the hosted `short_url`? The DOM/script side effects are thin and mocked.

- [ ] **Step 1: Write the failing test**

Create `specter-web/lib/billing/checkout.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { chooseCheckoutMode } from './checkout'

describe('chooseCheckoutMode', () => {
  it('uses embedded when key present and script loaded', () => {
    expect(chooseCheckoutMode({ keyId: 'rzp_test', scriptLoaded: true, shortUrl: 'https://x' }))
      .toBe('embedded')
  })
  it('falls back to hosted when key missing', () => {
    expect(chooseCheckoutMode({ keyId: '', scriptLoaded: true, shortUrl: 'https://x' }))
      .toBe('hosted')
  })
  it('falls back to hosted when script failed to load', () => {
    expect(chooseCheckoutMode({ keyId: 'rzp_test', scriptLoaded: false, shortUrl: 'https://x' }))
      .toBe('hosted')
  })
  it('returns none when neither embedded is possible nor a short_url exists', () => {
    expect(chooseCheckoutMode({ keyId: '', scriptLoaded: false, shortUrl: null }))
      .toBe('none')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd specter-web && node node_modules/vitest/vitest.mjs run lib/billing/checkout.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the module**

Create `specter-web/lib/billing/checkout.ts`:

```ts
'use client'

/**
 * Razorpay checkout launcher: embedded checkout.js modal with a hosted
 * short_url fallback. The pure decision (`chooseCheckoutMode`) is unit-tested;
 * the side-effecting loader/opener are thin wrappers around the SDK.
 */
const RAZORPAY_KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? ''
const SCRIPT_SRC = 'https://checkout.razorpay.com/v1/checkout.js'

export type CheckoutMode = 'embedded' | 'hosted' | 'none'

export function chooseCheckoutMode(opts: {
  keyId: string
  scriptLoaded: boolean
  shortUrl: string | null
}): CheckoutMode {
  if (opts.keyId && opts.scriptLoaded) return 'embedded'
  if (opts.shortUrl) return 'hosted'
  return 'none'
}

/** Inject checkout.js once; resolves true on load, false on error/timeout. */
export function loadCheckoutScript(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false)
  const w = window as unknown as { Razorpay?: unknown }
  if (w.Razorpay) return Promise.resolve(true)
  return new Promise((resolve) => {
    const existing = document.querySelector(`script[src="${SCRIPT_SRC}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve(true))
      existing.addEventListener('error', () => resolve(false))
      return
    }
    const s = document.createElement('script')
    s.src = SCRIPT_SRC
    s.async = true
    s.onload = () => resolve(true)
    s.onerror = () => resolve(false)
    document.body.appendChild(s)
  })
}

export interface OpenCheckoutArgs {
  subscriptionId: string
  shortUrl: string | null
  onDismiss?: () => void
}

/**
 * Open the best available checkout for a created subscription. Returns the mode
 * actually used. Both embedded success and hosted redirect land on
 * /dashboard/billing/success (embedded via callback_url; hosted is the page).
 */
export async function openCheckout(args: OpenCheckoutArgs): Promise<CheckoutMode> {
  const scriptLoaded = RAZORPAY_KEY_ID ? await loadCheckoutScript() : false
  const mode = chooseCheckoutMode({
    keyId: RAZORPAY_KEY_ID,
    scriptLoaded,
    shortUrl: args.shortUrl,
  })

  if (mode === 'embedded') {
    const w = window as unknown as { Razorpay: new (o: unknown) => { open: () => void } }
    const rzp = new w.Razorpay({
      key: RAZORPAY_KEY_ID,
      subscription_id: args.subscriptionId,
      callback_url: `${window.location.origin}/dashboard/billing/success`,
      redirect: true,
      modal: { ondismiss: args.onDismiss },
    })
    rzp.open()
  } else if (mode === 'hosted' && args.shortUrl) {
    window.location.href = args.shortUrl
  }
  return mode
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd specter-web && node node_modules/vitest/vitest.mjs run lib/billing/checkout.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add specter-web/lib/billing/checkout.ts specter-web/lib/billing/checkout.test.ts
git commit -m "feat(billing): checkout.js loader + embedded/hosted fallback selection"
```

---

## Task 8: Frontend API hooks (trial, subscribe, upgrade, downgrade, cancel, addons)

**Files:**
- Modify: `specter-web/lib/api.ts` (Merchant type + Addon type + hooks)

No unit tests (these are thin TanStack wrappers over `apiFetch`, matching the repo's untested hook convention). Correctness is enforced by `tsc`.

- [ ] **Step 1: Extend the `Merchant` interface**

In `specter-web/lib/api.ts`, in `interface Merchant` (after `email_notifications_enabled: boolean`, line 50), add:

```ts
  subscription_current_end: string | null
  subscription_cancel_at: string | null
```

- [ ] **Step 2: Add the `Addon` type + subscription types**

After the `Merchant` interface block, add:

```ts
export interface Addon {
  id: string
  addon_type: string
  razorpay_subscription_id: string | null
}

export interface SubscriptionResponse {
  subscription_id: string
  status: string | null
  short_url: string | null
}

export interface CancelResponse {
  cancel_at: string | null
  status: string
}

export type SelfServePlan = 'recon' | 'cipher' | 'phantom'
export type BillingCadence = 'monthly' | 'annual'
```

- [ ] **Step 3: Update the preview merchant fixture to include the new fields**

In `specter-web/lib/preview-data.ts`, in `previewMerchant` (after `email_notifications_enabled: true,`, line 64), add:

```ts
  subscription_current_end: null,
  subscription_cancel_at: null,
```

- [ ] **Step 4: Add the billing query key + hooks**

In `specter-web/lib/api.ts`, add to `queryKeys` (after `products: ['products'] as const,`):

```ts
  addons: ['billing', 'addons'] as const,
```

Then add a new section after the MERCHANT HOOKS block:

```ts
// ════════════════════════════════════════════════════════════════════════════
// BILLING HOOKS
// ════════════════════════════════════════════════════════════════════════════

export function useStartTrial(): UseMutationResult<Merchant, ApiError, void> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      PREVIEW
        ? Promise.resolve<Merchant>({ ...previewMerchant, plan: 'recon' })
        : apiFetch<Merchant>('/merchants/start-trial', { method: 'POST' }),
    onSuccess: (data) => qc.setQueryData(queryKeys.merchant, data),
  })
}

export function useSubscribe(): UseMutationResult<
  SubscriptionResponse,
  ApiError,
  { plan: SelfServePlan; cadence: BillingCadence }
> {
  return useMutation({
    mutationFn: (body) =>
      PREVIEW
        ? Promise.resolve<SubscriptionResponse>({ subscription_id: 'sub_preview', status: 'created', short_url: null })
        : apiFetch<SubscriptionResponse>('/billing/subscribe', { method: 'POST', body: JSON.stringify(body) }),
  })
}

export function useUpgrade(): UseMutationResult<
  SubscriptionResponse,
  ApiError,
  { plan: SelfServePlan; cadence: BillingCadence }
> {
  return useMutation({
    mutationFn: (body) =>
      PREVIEW
        ? Promise.resolve<SubscriptionResponse>({ subscription_id: 'sub_preview', status: 'created', short_url: null })
        : apiFetch<SubscriptionResponse>('/billing/upgrade', { method: 'POST', body: JSON.stringify(body) }),
  })
}

export function useDowngrade(): UseMutationResult<unknown, ApiError, { plan: string }> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body) =>
      PREVIEW
        ? Promise.resolve({ plan: body.plan })
        : apiFetch<unknown>('/billing/downgrade', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.merchant }),
  })
}

export function useCancelSubscription(): UseMutationResult<CancelResponse, ApiError, void> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      PREVIEW
        ? Promise.resolve<CancelResponse>({ cancel_at: null, status: 'cancel_scheduled' })
        : apiFetch<CancelResponse>('/billing/cancel', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.merchant }),
  })
}

export function useAddons(): UseQueryResult<Addon[], ApiError> {
  return useQuery({
    queryKey: queryKeys.addons,
    queryFn: () => (PREVIEW ? Promise.resolve<Addon[]>([]) : apiFetch<Addon[]>('/billing/addons')),
    retry: false,
  })
}

export function useRemoveAddon(): UseMutationResult<void, ApiError, string> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (addonId) =>
      PREVIEW
        ? Promise.resolve(undefined as void)
        : apiFetch<void>(`/billing/addon/${addonId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.addons }),
  })
}
```

- [ ] **Step 5: Typecheck**

Run: `cd specter-web && node node_modules/typescript/bin/tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add specter-web/lib/api.ts specter-web/lib/preview-data.ts
git commit -m "feat(billing): TanStack hooks for trial/subscribe/upgrade/downgrade/cancel/addons"
```

---

## Task 9: Intent-resume hook + mount in dashboard layout

**Files:**
- Create: `specter-web/hooks/use-resume-intent.ts`
- Modify: `specter-web/app/(dashboard)/layout.tsx`

- [ ] **Step 1: Implement the resume hook**

Create `specter-web/hooks/use-resume-intent.ts`:

```ts
'use client'

/**
 * One-shot billing-intent resume. On the first authenticated dashboard mount,
 * if a fresh intent exists (saved on /pricing before the signup round-trip), we
 * act on it exactly once and clear it:
 *   - trial → start the RECON trial, then route to the dashboard
 *   - buy   → create the subscription and open checkout
 * Stale or absent intents are ignored (and cleared if stale).
 */
import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { readIntent, clearIntent, isFresh } from '@/lib/billing/intent'
import { useStartTrial, useSubscribe, type SelfServePlan, type BillingCadence } from '@/lib/api'
import { openCheckout } from '@/lib/billing/checkout'
import { toast, formatApiError } from '@/lib/toast'

export function useResumeIntent(): void {
  const ran = useRef(false)
  const router = useRouter()
  const startTrial = useStartTrial()
  const subscribe = useSubscribe()

  useEffect(() => {
    if (ran.current) return
    const intent = readIntent()
    if (!intent) return
    ran.current = true
    clearIntent()
    if (!isFresh(intent)) return

    void (async () => {
      try {
        if (intent.action === 'trial') {
          await startTrial.mutateAsync()
          toast.success('Your 14-day RECON trial is active.')
          router.push('/dashboard')
        } else {
          const sub = await subscribe.mutateAsync({
            plan: intent.plan as SelfServePlan,
            cadence: intent.cadence as BillingCadence,
          })
          await openCheckout({ subscriptionId: sub.subscription_id, shortUrl: sub.short_url })
        }
      } catch (err) {
        toast.error(formatApiError(err))
      }
    })()
    // run-once; mutations are stable refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
```

- [ ] **Step 2: Mount it in the dashboard layout**

In `specter-web/app/(dashboard)/layout.tsx`, add the import and call the hook inside the layout component body (it renders nothing; it just runs the effect). Add near the top of the component:

```tsx
import { useResumeIntent } from '@/hooks/use-resume-intent'
```

and as the first line inside the component function body:

```tsx
  useResumeIntent()
```

> If `layout.tsx` is currently a Server Component (no `'use client'`), do NOT convert it. Instead create a tiny client component `components/dashboard/resume-intent.tsx` that calls `useResumeIntent()` and returns `null`, and render `<ResumeIntent />` inside the layout. Check the first line of `layout.tsx`: if it starts with `'use client'`, use the hook directly; otherwise use the `<ResumeIntent />` component.

For the component variant, create `specter-web/components/dashboard/resume-intent.tsx`:

```tsx
'use client'
import { useResumeIntent } from '@/hooks/use-resume-intent'

export default function ResumeIntent() {
  useResumeIntent()
  return null
}
```

- [ ] **Step 3: Typecheck**

Run: `cd specter-web && node node_modules/typescript/bin/tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add specter-web/hooks/use-resume-intent.ts "specter-web/app/(dashboard)/layout.tsx" specter-web/components/dashboard/resume-intent.tsx
git commit -m "feat(billing): resume saved billing intent once after signup"
```

---

## Task 10: Pricing page — dual CTA (trial + buy) with auth-aware intent

**Files:**
- Modify: `specter-web/app/(marketing)/pricing/page.tsx`

Self-serve cards (RECON/CIPHER/PHANTOM) get two actions: **Start 14-day trial** and **Buy {plan}**. PREDATOR/ECLIPSE keep the single contact button. Logged-out clicks persist intent and route to `/sign-up`; logged-in clicks act immediately.

- [ ] **Step 1: Add the imports and an auth + action helper**

In `specter-web/app/(marketing)/pricing/page.tsx`, add imports at the top:

```tsx
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { saveIntent } from '@/lib/billing/intent'
import { useStartTrial, useSubscribe, type SelfServePlan } from '@/lib/api'
import { openCheckout } from '@/lib/billing/checkout'
import { toast, formatApiError } from '@/lib/toast'
```

- [ ] **Step 2: Add an action hook used by the page**

Inside `PricingPage` (before `return`), add:

```tsx
  const router = useRouter()
  const startTrial = useStartTrial()
  const subscribe = useSubscribe()

  async function isLoggedIn(): Promise<boolean> {
    const { data } = await createClient().auth.getSession()
    return !!data.session
  }

  async function handleTrial(plan: SelfServePlan) {
    if (!(await isLoggedIn())) {
      saveIntent({ action: 'trial', plan, cadence: annual ? 'annual' : 'monthly' })
      router.push('/sign-up')
      return
    }
    try {
      await startTrial.mutateAsync()
      toast.success('Your 14-day RECON trial is active.')
      router.push('/dashboard')
    } catch (err) {
      toast.error(formatApiError(err))
    }
  }

  async function handleBuy(plan: SelfServePlan) {
    const cadence = annual ? 'annual' : 'monthly'
    if (!(await isLoggedIn())) {
      saveIntent({ action: 'buy', plan, cadence })
      router.push('/sign-up')
      return
    }
    try {
      const sub = await subscribe.mutateAsync({ plan, cadence })
      await openCheckout({ subscriptionId: sub.subscription_id, shortUrl: sub.short_url })
    } catch (err) {
      toast.error(formatApiError(err))
    }
  }
```

- [ ] **Step 3: Thread the handlers into `TierCard`**

Change the `TierCard` props and its CTA block. Update the component signature:

```tsx
function TierCard({
  tier,
  annual,
  onContact,
  onTrial,
  onBuy,
}: {
  tier: Tier
  annual: boolean
  onContact: (plan: 'PREDATOR' | 'ECLIPSE') => void
  onTrial: (plan: SelfServePlan) => void
  onBuy: (plan: SelfServePlan) => void
}) {
```

Replace the CTA block (the `{tier.contact ? (...) : (...)}` at the end of `TierCard`) with:

```tsx
      {/* CTA — contact tiers open the lead modal; self-serve get dual actions. */}
      {tier.contact ? (
        <button type="button" onClick={() => onContact(tier.contact!)} className={ctaClasses}>
          {tier.cta}
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => onTrial(tier.name.toLowerCase() as SelfServePlan)}
            className={ctaClasses}
          >
            Start 14-day trial
          </button>
          <button
            type="button"
            onClick={() => onBuy(tier.name.toLowerCase() as SelfServePlan)}
            className="btn-ripple block w-full text-center py-2.5 rounded-lg text-sm font-semibold border border-primary/40 text-primary hover:bg-primary/10 transition-all duration-250"
          >
            Buy {tier.name}
          </button>
        </div>
      )}
```

- [ ] **Step 4: Pass the handlers where `TierCard` is rendered**

In `PricingPage`, update the map:

```tsx
              {TIERS.map((tier) => (
                <TierCard key={tier.name} tier={tier} annual={annual} onContact={setContactPlan} onTrial={handleTrial} onBuy={handleBuy} />
              ))}
```

- [ ] **Step 5: Typecheck + lint the file**

Run: `cd specter-web && node node_modules/typescript/bin/tsc --noEmit`
Expected: no errors.
Run: `cd specter-web && npx next lint --file "app/(marketing)/pricing/page.tsx"`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add "specter-web/app/(marketing)/pricing/page.tsx"
git commit -m "feat(billing): dual trial/buy CTAs on pricing with auth-aware intent"
```

---

## Task 11: Billing success + cancel return routes

**Files:**
- Create: `specter-web/app/(dashboard)/billing/success/page.tsx`
- Create: `specter-web/app/(dashboard)/billing/cancel/page.tsx`

- [ ] **Step 1: Implement the success (polling) page**

Create `specter-web/app/(dashboard)/billing/success/page.tsx`:

```tsx
'use client'

/**
 * Checkout return route. Plan elevation is webhook-driven, so completing
 * checkout does NOT mean the plan is live yet — we poll /merchants/me until the
 * plan leaves `free` (or a short timeout), then route to the dashboard.
 */
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { useMerchant, queryKeys } from '@/lib/api'
import { toast } from '@/lib/toast'

const MAX_POLLS = 15
const INTERVAL_MS = 2000

export default function BillingSuccessPage() {
  const router = useRouter()
  const qc = useQueryClient()
  const { data: merchant } = useMerchant()
  const [finalizing, setFinalizing] = useState(true)
  const polls = useRef(0)

  useEffect(() => {
    const id = setInterval(() => {
      polls.current += 1
      void qc.invalidateQueries({ queryKey: queryKeys.merchant })
      if (polls.current >= MAX_POLLS) {
        clearInterval(id)
        setFinalizing(false)
      }
    }, INTERVAL_MS)
    return () => clearInterval(id)
  }, [qc])

  useEffect(() => {
    if (merchant && merchant.plan !== 'free') {
      toast.success(`You're on ${merchant.plan.toUpperCase()}.`)
      router.replace('/dashboard')
    }
  }, [merchant, router])

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      {finalizing ? (
        <>
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
          <h1 className="font-display text-xl font-bold text-text">Finalizing your plan…</h1>
          <p className="font-body text-sm text-muted max-w-sm">
            Payment received. We&apos;re activating your subscription — this usually takes a few seconds.
          </p>
        </>
      ) : (
        <>
          <CheckCircle2 className="h-8 w-8 text-primary" aria-hidden="true" />
          <h1 className="font-display text-xl font-bold text-text">Payment received</h1>
          <p className="font-body text-sm text-muted max-w-sm">
            Your plan is being activated. Refresh in a minute or head to your dashboard.
          </p>
          <a href="/dashboard" className="gradient-primary-cta btn-ripple px-5 py-2.5 rounded-xl font-semibold text-sm">
            Go to dashboard
          </a>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Implement the cancel (no-charge) page**

Create `specter-web/app/(dashboard)/billing/cancel/page.tsx`:

```tsx
'use client'

/** Checkout-abandoned return route. No charge was made. */
import { XCircle } from 'lucide-react'

export default function BillingCancelPage() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <XCircle className="h-8 w-8 text-muted" aria-hidden="true" />
      <h1 className="font-display text-xl font-bold text-text">Checkout cancelled</h1>
      <p className="font-body text-sm text-muted max-w-sm">
        No charge was made. You can pick a plan whenever you&apos;re ready.
      </p>
      <a href="/pricing" className="gradient-primary-cta btn-ripple px-5 py-2.5 rounded-xl font-semibold text-sm">
        Back to pricing
      </a>
    </div>
  )
}
```

- [ ] **Step 3: Typecheck + build (these are new routes)**

Run: `cd specter-web && node node_modules/typescript/bin/tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "specter-web/app/(dashboard)/billing/success/page.tsx" "specter-web/app/(dashboard)/billing/cancel/page.tsx"
git commit -m "feat(billing): checkout success (polling) + cancel return routes"
```

---

## Task 12: Settings billing card — plan, renewal/cancel date, manage, add-ons

**Files:**
- Create: `specter-web/components/dashboard/settings/billing-card.tsx`
- Modify: `specter-web/app/(dashboard)/settings/page.tsx`

- [ ] **Step 1: Implement the billing card**

Create `specter-web/components/dashboard/settings/billing-card.tsx`:

```tsx
'use client'

/**
 * Self-serve subscription management for paid self-serve plans
 * (RECON/CIPHER/PHANTOM). Shows the next renewal date or a scheduled cancel
 * date, lets the user upgrade/downgrade among self-serve plans, cancel at
 * period end, and remove add-ons. PREDATOR/ECLIPSE are sales-led — this card
 * routes them to contact instead.
 */
import { useState } from 'react'
import {
  useUpgrade,
  useDowngrade,
  useCancelSubscription,
  useAddons,
  useRemoveAddon,
  type Merchant,
  type SelfServePlan,
} from '@/lib/api'
import { openCheckout } from '@/lib/billing/checkout'
import { toast, formatApiError } from '@/lib/toast'
import SettingsCard from './settings-card'

const SELF_SERVE: SelfServePlan[] = ['recon', 'cipher', 'phantom']
const ORDER = ['free', 'recon', 'cipher', 'phantom', 'predator', 'eclipse']

function fmtDate(iso: string | null): string | null {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return null
  }
}

export default function BillingCard({ merchant }: { merchant: Merchant }) {
  const upgrade = useUpgrade()
  const downgrade = useDowngrade()
  const cancel = useCancelSubscription()
  const { data: addons } = useAddons()
  const removeAddon = useRemoveAddon()
  const [confirmCancel, setConfirmCancel] = useState(false)

  const plan = merchant.plan
  const renewal = fmtDate(merchant.subscription_current_end)
  const cancelAt = fmtDate(merchant.subscription_cancel_at)
  const idx = ORDER.indexOf(plan)

  async function changePlan(target: SelfServePlan) {
    const targetIdx = ORDER.indexOf(target)
    try {
      if (targetIdx > idx) {
        const sub = await upgrade.mutateAsync({ plan: target, cadence: 'monthly' })
        await openCheckout({ subscriptionId: sub.subscription_id, shortUrl: sub.short_url })
      } else {
        await downgrade.mutateAsync({ plan: target })
        toast.success(`Downgraded to ${target.toUpperCase()}.`)
      }
    } catch (err) {
      toast.error(formatApiError(err))
    }
  }

  async function doCancel() {
    try {
      const res = await cancel.mutateAsync()
      const when = fmtDate(res.cancel_at)
      toast.success(when ? `Cancellation scheduled for ${when}.` : 'Cancellation scheduled for the end of your billing period.')
      setConfirmCancel(false)
    } catch (err) {
      toast.error(formatApiError(err))
    }
  }

  return (
    <SettingsCard title="Billing">
      <div className="flex flex-col gap-4">
        <div>
          {cancelAt ? (
            <p className="font-body text-sm text-amber-400">
              Cancels on {cancelAt} — you retain {plan.toUpperCase()} access until then.
            </p>
          ) : renewal ? (
            <p className="font-body text-sm text-muted">Next renewal: {renewal}</p>
          ) : (
            <p className="font-body text-sm text-muted">No active subscription billing date on file.</p>
          )}
        </div>

        {/* Change plan among self-serve tiers */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-body text-xs text-muted">Change plan:</span>
          {SELF_SERVE.filter((p) => p !== plan).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => changePlan(p)}
              className="border border-border text-muted hover:text-text hover:border-primary/40 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
            >
              {ORDER.indexOf(p) > idx ? 'Upgrade to' : 'Downgrade to'} {p.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Add-ons */}
        {addons && addons.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="font-body text-xs text-muted">Add-ons</span>
            {addons.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 border border-border rounded-lg px-3 py-2">
                <span className="font-mono text-xs text-text">{a.addon_type}</span>
                <button
                  type="button"
                  onClick={() => removeAddon.mutate(a.id)}
                  className="font-body text-xs text-rose-300 hover:underline"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Cancel at period end */}
        {!cancelAt && merchant.subscription_current_end !== null && (
          confirmCancel ? (
            <div className="flex items-center gap-3">
              <button type="button" onClick={doCancel} className="font-body text-sm text-rose-300 hover:underline">
                Confirm cancellation
              </button>
              <button type="button" onClick={() => setConfirmCancel(false)} className="font-body text-sm text-muted hover:text-text">
                Keep my plan
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmCancel(true)}
              className="self-start font-body text-sm text-muted hover:text-rose-300 transition-colors"
            >
              Cancel subscription
            </button>
          )
        )}
      </div>
    </SettingsCard>
  )
}
```

- [ ] **Step 2: Render the card in Settings (paid self-serve plans only)**

In `specter-web/app/(dashboard)/settings/page.tsx`, add the import:

```tsx
import BillingCard from '@/components/dashboard/settings/billing-card'
```

and render it right after `<PlanCard ... />` (inside the `<>` block):

```tsx
          {['recon', 'cipher', 'phantom'].includes(merchant.plan) && <BillingCard merchant={merchant} />}
```

- [ ] **Step 3: Typecheck + lint**

Run: `cd specter-web && node node_modules/typescript/bin/tsc --noEmit`
Expected: no errors.
Run: `cd specter-web && npx next lint --file specter-web/components/dashboard/settings/billing-card.tsx`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add specter-web/components/dashboard/settings/billing-card.tsx "specter-web/app/(dashboard)/settings/page.tsx"
git commit -m "feat(billing): self-serve subscription management card in settings"
```

---

## Task 13: Wire the PQL modal's trial CTA to `useStartTrial`

**Files:**
- Modify: `specter-web/components/dashboard/pql-upgrade-modal.tsx`

The modal currently links to `/pricing`. For a logged-in free user it should start the trial directly.

- [ ] **Step 1: Swap the trial Link for a start-trial button**

In `specter-web/components/dashboard/pql-upgrade-modal.tsx`, add imports:

```tsx
import { useRouter } from 'next/navigation'
import { useStartTrial } from '@/lib/api'
import { toast, formatApiError } from '@/lib/toast'
```

Inside the component (after `const [open, setOpen] = useState(false)`), add:

```tsx
  const router = useRouter()
  const startTrial = useStartTrial()

  async function activateTrial() {
    trackLockedValueCardCTA(SURFACE, 'recon')
    try {
      await startTrial.mutateAsync()
      toast.success('Your 14-day RECON trial is active.')
      close()
      router.push('/dashboard')
    } catch (err) {
      toast.error(formatApiError(err))
    }
  }
```

Replace the `<Link href="/pricing" ...>Start a 14-day RECON trial<...></Link>` block with:

```tsx
                <button
                  type="button"
                  onClick={activateTrial}
                  disabled={startTrial.isPending}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl gradient-primary-cta btn-ripple font-semibold text-sm transition-all duration-200 disabled:opacity-60"
                >
                  Start a 14-day RECON trial
                  <ArrowRight size={15} aria-hidden="true" />
                </button>
```

Remove the now-unused `import Link from 'next/link'` if no other `Link` remains in the file.

- [ ] **Step 2: Typecheck**

Run: `cd specter-web && node node_modules/typescript/bin/tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add specter-web/components/dashboard/pql-upgrade-modal.tsx
git commit -m "feat(billing): PQL modal starts the RECON trial in-app"
```

---

## Task 14: Config + docs + full verification

**Files:**
- Modify: `specter-web/.env.example` (create if absent)
- Modify: `CLAUDE.md` (env section)

- [ ] **Step 1: Document the publishable key**

If `specter-web/.env.example` exists, add a line; otherwise create it mirroring the env block in `CLAUDE.md` plus:

```
NEXT_PUBLIC_RAZORPAY_KEY_ID=
```

In `CLAUDE.md`, under "Environment Variables (.env.local)", add `NEXT_PUBLIC_RAZORPAY_KEY_ID=` to the list and a one-line note: "Razorpay publishable key (`RAZORPAY_KEY_ID`) for embedded checkout; webhook `subscription.cancelled` must be registered alongside `activated`/`charged`."

- [ ] **Step 2: Run the full frontend test suite**

Run: `cd specter-web && node node_modules/vitest/vitest.mjs run`
Expected: PASS — prior tests plus the 9 new billing-helper tests (intent 5 + checkout 4).

- [ ] **Step 3: Run the full backend test suite**

Run: `cd specter-api && .venv/Scripts/python.exe -m pytest -q`
Expected: PASS — full suite green including the new billing tests.

- [ ] **Step 4: Production build (frontend)**

Run: `cd specter-web && npm run build`
Expected: build succeeds; the new `/dashboard/billing/success` and `/dashboard/billing/cancel` routes appear in the route list.

- [ ] **Step 5: Commit**

```bash
git add specter-web/.env.example CLAUDE.md
git commit -m "docs(billing): document NEXT_PUBLIC_RAZORPAY_KEY_ID + webhook events"
```

---

## Manual end-to-end verification (the path that matters)

With Razorpay test keys configured on both services and the webhook registered:

1. Logged out → `/pricing` → **Buy CIPHER** → redirected to `/sign-up`; confirm email → land on dashboard → intent resumes → checkout opens → pay (test card) → `/dashboard/billing/success` polls → toast "You're on CIPHER" → dashboard shows CIPHER.
2. Logged out → **Start 14-day trial** → sign-up → resume → trial active (RECON) banner; no card.
3. Settings → Billing → **Upgrade to PHANTOM** → checkout → webhook elevates.
4. Settings → Billing → **Downgrade to RECON** → immediate; SKUs above ceiling paused.
5. Settings → Billing → **Cancel subscription** → "Cancels on {date}", access retained; simulate `subscription.cancelled` webhook → plan drops to free.
6. Add an add-on (existing flow) → it lists in Billing → **Remove** → gone.

---

## Self-Review notes (spec coverage)

- Spec §Goals 1 (Pricing CTA → checkout) → Task 10. Goal 2 (Trial CTA) → Tasks 10, 13. Goal 3 (Upgrade modal) → Tasks 12, 13. Goal 4 (success/cancel routes) → Task 11. Goal 5 (management incl. cancel-at-period-end) → Tasks 4, 12. Goal 6 (publishable key) → Tasks 7, 14. Goal 7 (webhook verification + cancelled handler) → Tasks 3, 5.
- Spec §Decision 5 (cancel-at-period-end): backend Tasks 1–5 (columns, POST /cancel, cancelled webhook, shared `apply_downgrade`); UI Task 12.
- Spec §Components table: every backend + frontend file in the spec maps to a task above.
- Non-goal honored: PREDATOR/ECLIPSE stay contact-sales (Task 10 leaves their `contact` branch untouched; Task 12 self-serve list is RECON/CIPHER/PHANTOM only).
- Type consistency: `SelfServePlan`/`BillingCadence`/`Addon`/`SubscriptionResponse`/`CancelResponse` are defined in Task 8 and consumed identically in Tasks 9, 10, 12; `apply_downgrade`/`_resolve_merchant`/`_unix_to_dt` defined in Task 3 and reused in Tasks 4–5.
