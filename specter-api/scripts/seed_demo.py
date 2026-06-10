"""Seed a confirmed demo login + a fully-populated dashboard.

Creates (idempotently) a confirmed Supabase auth user, a merchant on a chosen
plan, and rich demo data (SKUs, competitors, competitor price snapshots, signals,
OOS alerts, price changes) so the dashboard renders populated for RECON / CIPHER
/ PHANTOM instead of empty states.

Usage:
  .venv/Scripts/python.exe scripts/seed_demo.py [plan]
     plan = recon | cipher | phantom   (default: cipher)

Login afterwards with:  demo@specterapp.io  /  SpecterDemo2026!
"""
from __future__ import annotations

import asyncio
import os
import sys
import uuid
from datetime import datetime, timedelta, timezone

import asyncpg

# Read the connection string from the environment (never hard-code the password).
# DATABASE_URL is the SQLAlchemy form (postgresql+asyncpg://…); asyncpg.connect
# wants the bare postgresql:// scheme, so strip the +asyncpg driver tag.
_RAW_DB = os.environ.get("DATABASE_URL", "")
if not _RAW_DB:
    sys.exit("DATABASE_URL is not set — export it (see .env) before seeding.")
DB = _RAW_DB.replace("postgresql+asyncpg://", "postgresql://", 1)
EMAIL = "demo@specterapp.io"
PASSWORD = "SpecterDemo2026!"
PLAN = (sys.argv[1] if len(sys.argv) > 1 else "cipher").lower()

now = datetime.now(tz=timezone.utc)


async def main() -> None:
    c = await asyncpg.connect(DB)

    # ── 1. Confirmed auth user (idempotent upsert) ────────────────────────────
    await c.execute("create extension if not exists pgcrypto")
    user_id = await c.fetchval("select id from auth.users where email=$1", EMAIL)
    if user_id is None:
        user_id = uuid.uuid4()
        await c.execute(
            """
            insert into auth.users (
              instance_id, id, aud, role, email, encrypted_password,
              email_confirmed_at, created_at, updated_at,
              raw_app_meta_data, raw_user_meta_data,
              confirmation_token, recovery_token, email_change_token_new, email_change
            ) values (
              '00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated',
              $2, crypt($3, gen_salt('bf')), now(), now(), now(),
              '{"provider":"email","providers":["email"]}', '{}', '', '', '', ''
            )
            """,
            user_id, EMAIL, PASSWORD,
        )
        print(f"created confirmed auth user {EMAIL}")
    else:
        await c.execute(
            "update auth.users set encrypted_password=crypt($2, gen_salt('bf')), "
            "email_confirmed_at=coalesce(email_confirmed_at, now()), updated_at=now() "
            "where id=$1",
            user_id, PASSWORD,
        )
        print(f"reset password + confirmed existing user {EMAIL}")

    # ── 2. Merchant on the chosen plan (idempotent) ───────────────────────────
    merchant_id = await c.fetchval(
        "select id from merchants where supabase_user_id=$1", str(user_id)
    )
    trial_ends = now + timedelta(days=14)
    if merchant_id is None:
        merchant_id = uuid.uuid4()
        await c.execute(
            """insert into merchants (id, created_at, supabase_user_id, plan, trial_ends_at,
                 read_only, eclipse_interval_ms, auto_reprice_enabled,
                 email_notifications_enabled, notification_email)
               values ($1, now(), $2, $3, $4, false, 300000, true, true, $5)""",
            merchant_id, str(user_id), PLAN, trial_ends, EMAIL,
        )
    else:
        await c.execute(
            "update merchants set plan=$2, trial_ends_at=$3, read_only=false, "
            "auto_reprice_enabled=true, email_notifications_enabled=true where id=$1",
            merchant_id, PLAN, trial_ends,
        )
    print(f"merchant {str(merchant_id)[:8]} on plan={PLAN}")

    # ── 3. Wipe prior demo child data for a clean reseed ──────────────────────
    sku_ids = [r["id"] for r in await c.fetch("select id from skus where merchant_id=$1", merchant_id)]
    if sku_ids:
        await c.execute("delete from price_changes where sku_id = any($1::uuid[])", sku_ids)
        await c.execute("delete from signals where sku_id = any($1::uuid[])", sku_ids)
        await c.execute("delete from oos_alerts where sku_id = any($1::uuid[])", sku_ids)
    trk_ids = [r["id"] for r in await c.fetch("select id from competitor_trackings where merchant_id=$1", merchant_id)]
    cu_ids = [r["competitor_url_id"] for r in await c.fetch("select competitor_url_id from competitor_trackings where merchant_id=$1", merchant_id)]
    await c.execute("delete from competitor_trackings where merchant_id=$1", merchant_id)
    if cu_ids:
        await c.execute("delete from price_snapshots where competitor_url_id = any($1::uuid[])", cu_ids)
    await c.execute("delete from skus where merchant_id=$1", merchant_id)

    # ── 4. SKUs ───────────────────────────────────────────────────────────────
    products = [
        ("Aurora Wireless Earbuds", "aurora-earbuds", 79.00, 65.00, 95.00),
        ("Nimbus Yoga Mat", "nimbus-yoga-mat", 42.00, 34.00, 55.00),
        ("Vertex Steel Water Bottle", "vertex-bottle", 28.00, 22.00, 36.00),
        ("Halcyon Linen Sheet Set", "halcyon-sheets", 119.00, 99.00, 149.00),
        ("Pulse Smart Scale", "pulse-scale", 54.00, 45.00, 69.00),
        ("Cedar Desk Organizer", "cedar-organizer", 33.00, 27.00, 44.00),
    ]
    skus: list[tuple[uuid.UUID, str, float]] = []
    for title, handle, price, floor, ceil in products:
        sid = uuid.uuid4()
        await c.execute(
            """insert into skus (id, created_at, merchant_id, title, handle, current_price,
                 floor_price, ceiling_price, active, auto_reprice_enabled)
               values ($1, now(), $2, $3, $4, $5, $6, $7, true, $8)""",
            sid, merchant_id, title, handle, price, floor, ceil, PLAN in ("cipher", "phantom"),
        )
        skus.append((sid, title, price))

    # ── 5. Competitor URLs + trackings + snapshots ────────────────────────────
    comp_domains = ["rivalshop.com", "pricebeat.io", "marketmover.co"]
    for sid, title, price in skus:
        for i, dom in enumerate(comp_domains[: 2 + (hash(title) % 2)]):
            cu_id = uuid.uuid4()
            path = f"/products/{title.lower().split()[0]}"
            await c.execute(
                """insert into competitor_urls (id, created_at, domain, url_path, last_scraped_at,
                     robots_blocked, currency)
                   values ($1, now(), $2, $3, now(), false, 'USD')""",
                cu_id, dom, path,
            )
            await c.execute(
                """insert into competitor_trackings (id, created_at, own_product_id,
                     competitor_url_id, merchant_id, enabled, silenced_oos)
                   values ($1, now(), $2, $3, $4, true, false)""",
                uuid.uuid4(), sid, cu_id, merchant_id,
            )
            # A few historical snapshots so "latest price" + spread exist.
            in_stock = not (i == 1 and "Pulse" in title)  # one OOS competitor
            comp_price = round(price * (0.9 + 0.07 * i), 2)
            for h in (6, 3, 0):
                await c.execute(
                    """insert into price_snapshots (id, created_at, competitor_url_id, price,
                         currency, in_stock, scraped_at, needs_review)
                       values ($1, now(), $2, $3, 'USD', $4, $5, false)""",
                    uuid.uuid4(), cu_id, comp_price + h * 0.5, in_stock,
                    now - timedelta(hours=h),
                )

    # ── 6. Signals (RAISE / LOWER / HOLD) ─────────────────────────────────────
    sig_specs = [
        ("RAISE", 0.88, "All in-stock competitors are priced above you — room to lift.", "ai"),
        ("LOWER", 0.81, "Two rivals undercut you by >8%; a small cut defends share.", "ai"),
        ("HOLD", 0.74, "You're already the best-priced in-stock option.", "rule"),
        ("RAISE", 0.69, "Nearest competitor went out of stock — capture demand.", "ai"),
        ("LOWER", 0.77, "Price gap widening against the market median.", "rule"),
    ]
    for idx, (sid, title, price) in enumerate(skus[:5]):
        stype, conf, reason, source = sig_specs[idx]
        suggestion = round(price * (1.06 if stype == "RAISE" else 0.95), 2) if stype != "HOLD" else None
        await c.execute(
            """insert into signals (id, created_at, sku_id, type, confidence, reasoning,
                 price_suggestion, source, ai_fallback, ai_model)
               values ($1, $2, $3, $4, $5, $6, $7, $8, false, $9)""",
            uuid.uuid4(), now - timedelta(hours=idx * 2), sid, stype, conf, reason,
            suggestion, source, "gemini-2.0" if source == "ai" else None,
        )

    # ── 7. OOS alerts (one active, one resolved) ──────────────────────────────
    pulse = next((s for s in skus if "Pulse" in s[1]), skus[0])
    trk = await c.fetchval(
        "select id from competitor_trackings where own_product_id=$1 limit 1", pulse[0]
    )
    if trk:
        await c.execute(
            """insert into oos_alerts (id, created_at, sku_id, detected_at, competitor_tracking_id)
               values ($1, now(), $2, $3, $4)""",
            uuid.uuid4(), pulse[0], now - timedelta(hours=5), trk,
        )

    # ── 8. Price changes (auto-reprice history → change log + attribution) ─────
    if PLAN in ("cipher", "phantom"):
        for idx, (sid, title, price) in enumerate(skus[:4]):
            old = price
            new = round(price * (1.05 if idx % 2 == 0 else 0.96), 2)
            await c.execute(
                """insert into price_changes (id, created_at, sku_id, signal_id, old_price,
                     new_price, source, revenue_delta)
                   values ($1, $2, $3, null, $4, $5, 'auto', $6)""",
                uuid.uuid4(), now - timedelta(days=idx, hours=3), sid, old, new,
                round((new - old) * 12, 2),
            )

    await c.close()
    print(f"\nSEEDED: 6 SKUs, competitors+snapshots, 5 signals, 1 OOS alert, "
          f"{'4 price changes' if PLAN in ('cipher','phantom') else 'no price changes (recon)'}")
    print(f"LOGIN:  {EMAIL}  /  {PASSWORD}   (plan={PLAN})")


asyncio.run(main())
