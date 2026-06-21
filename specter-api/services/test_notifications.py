import os
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://user:pass@localhost:5432/test")
os.environ.setdefault("UPSTASH_REDIS_URL", "rediss://:password@localhost:6379")

import asyncio
import uuid
from unittest.mock import AsyncMock, MagicMock

from services import notifications as notif


# ── notification_allowed — pure plan gate ───────────────────────────────────────

def test_billing_and_system_reach_every_plan():
    for plan in ("free", "recon", "cipher", "phantom", "predator", "eclipse"):
        assert notif.notification_allowed(plan, "billing") is True
        assert notif.notification_allowed(plan, "system") is True


def test_signal_and_oos_require_a_paid_plan():
    assert notif.notification_allowed("free", "signal") is False
    assert notif.notification_allowed("free", "oos") is False
    assert notif.notification_allowed("recon", "signal") is True
    assert notif.notification_allowed("eclipse", "oos") is True


def test_unknown_plan_is_denied_for_gated_types():
    assert notif.notification_allowed("garbage", "signal") is False
    # …but billing still reaches them (account-level, never gated).
    assert notif.notification_allowed("garbage", "billing") is True


# ── create_notification — gate + dedup + insert (mocked session) ────────────────

def _session(existing_dedup=False):
    session = MagicMock()
    session.add = MagicMock()
    session.flush = AsyncMock()
    # dedup existence check → scalar()
    res = MagicMock()
    res.scalar = MagicMock(return_value=(uuid.uuid4() if existing_dedup else None))
    session.execute = AsyncMock(return_value=res)
    return session


def test_create_inserts_a_row_when_allowed():
    session = _session()
    out = asyncio.run(notif.create_notification(
        session, uuid.uuid4(), type="signal", severity="info",
        title="t", body="b", link="/signals",
    ))
    assert out is not None
    session.add.assert_called_once()


def test_create_skips_when_plan_gate_denies():
    session = _session()
    out = asyncio.run(notif.create_notification(
        session, uuid.uuid4(), type="signal", severity="info",
        title="t", body="b", plan="free",   # free can't get signal notifications
    ))
    assert out is None
    session.add.assert_not_called()


def test_create_skips_duplicate_dedup_key():
    session = _session(existing_dedup=True)
    out = asyncio.run(notif.create_notification(
        session, uuid.uuid4(), type="oos", severity="warning",
        title="t", body="b", dedup_key="oos:123",
    ))
    assert out is None
    session.add.assert_not_called()


def test_create_never_raises_on_db_error():
    # A notification failure must never break the signal/scrape/billing pipeline.
    session = MagicMock()
    session.execute = AsyncMock(side_effect=RuntimeError("db down"))
    out = asyncio.run(notif.create_notification(
        session, uuid.uuid4(), type="billing", severity="success", title="t", body="b",
        dedup_key="x",
    ))
    assert out is None
