import os
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://user:pass@localhost:5432/test")
os.environ.setdefault("UPSTASH_REDIS_URL", "rediss://:password@localhost:6379")
os.environ["SUPABASE_JWT_SECRET"] = "test-supabase-jwt-secret-32-char!"

import asyncio
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from services.retention import (
    RETENTION_DAYS_LONG,
    RETENTION_DAYS_SHORT,
    purge_expired_snapshots,
    retention_cutoff,
    retention_days,
    schedule_downgrade_deletion,
)


# ── Pure policy ──────────────────────────────────────────────────────────────

@pytest.mark.parametrize("plan", ["predator", "eclipse", "PREDATOR", "Eclipse"])
def test_retention_days_long_for_90d_plans(plan):
    assert retention_days(plan) == RETENTION_DAYS_LONG == 90


@pytest.mark.parametrize("plan", ["free", "recon", "cipher", "phantom"])
def test_retention_days_short_for_other_plans(plan):
    assert retention_days(plan) == RETENTION_DAYS_SHORT == 30


def test_retention_cutoff_subtracts_retention_window():
    now = datetime(2026, 6, 5, tzinfo=timezone.utc)
    assert retention_cutoff("cipher", now) == now - timedelta(days=30)
    assert retention_cutoff("predator", now) == now - timedelta(days=90)


# ── Effectful sweeps ─────────────────────────────────────────────────────────

def test_purge_expired_snapshots_sums_rowcounts_and_commits():
    session = AsyncMock()
    # Three delete passes (grace, hard-cap, 30–90 band).
    session.execute = AsyncMock(side_effect=[
        MagicMock(rowcount=2),
        MagicMock(rowcount=5),
        MagicMock(rowcount=3),
    ])
    deleted = asyncio.run(
        purge_expired_snapshots(session, now=datetime(2026, 6, 5, tzinfo=timezone.utc))
    )
    assert deleted == 10
    assert session.execute.await_count == 3
    session.commit.assert_awaited_once()


def test_purge_handles_none_rowcount():
    session = AsyncMock()
    session.execute = AsyncMock(side_effect=[
        MagicMock(rowcount=None),
        MagicMock(rowcount=4),
        MagicMock(rowcount=None),
    ])
    deleted = asyncio.run(purge_expired_snapshots(session))
    assert deleted == 4


def test_schedule_downgrade_deletion_returns_rowcount_and_commits():
    session = AsyncMock()
    session.execute = AsyncMock(return_value=MagicMock(rowcount=7))
    scheduled = asyncio.run(schedule_downgrade_deletion(session, uuid.uuid4()))
    assert scheduled == 7
    session.execute.assert_awaited_once()
    session.commit.assert_awaited_once()
