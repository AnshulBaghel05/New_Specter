"""
Tests for the trial lifecycle service.

Pure predicate (is_trial_expired) needs no I/O. The expire_trials sweep is
exercised with a mocked AsyncSession to verify it downgrades expired trial
merchants to 'free' (NOT read-only) and leaves paid / non-expired ones alone.

Run: pytest services/test_trials.py -v
"""
from __future__ import annotations

import asyncio
import os
import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://u:p@localhost:5432/t")
os.environ.setdefault("UPSTASH_REDIS_URL", "rediss://:p@localhost:6379")

import pytest

from services import trials
from services.trials import TRIAL_DAYS, is_trial_expired, trial_end_at


NOW = datetime(2026, 6, 4, 12, 0, tzinfo=timezone.utc)


def _m(**kw):
    base = dict(plan="recon", razorpay_subscription_id=None,
               trial_ends_at=NOW - timedelta(days=1))
    base.update(kw)
    return SimpleNamespace(**base)


# ── trial_end_at ───────────────────────────────────────────────────────────────

def test_trial_end_at_is_14_days_out():
    assert TRIAL_DAYS == 14
    assert trial_end_at(NOW) == NOW + timedelta(days=14)


# ── is_trial_expired predicate ──────────────────────────────────────────────────

def test_expired_when_recon_trial_in_past_and_no_subscription():
    assert is_trial_expired(_m(trial_ends_at=NOW - timedelta(seconds=1)), NOW) is True


def test_not_expired_when_trial_in_future():
    assert is_trial_expired(_m(trial_ends_at=NOW + timedelta(days=3)), NOW) is False


def test_not_expired_when_paid_subscription_present():
    # A paying RECON customer (has a subscription) is never "trial-expired".
    assert is_trial_expired(_m(razorpay_subscription_id="sub_123"), NOW) is False


def test_not_expired_when_no_trial_ends_at():
    assert is_trial_expired(_m(trial_ends_at=None), NOW) is False


def test_not_expired_for_free_plan():
    assert is_trial_expired(_m(plan="free", trial_ends_at=None), NOW) is False


def test_not_expired_for_higher_paid_plan():
    assert is_trial_expired(_m(plan="cipher", trial_ends_at=None), NOW) is False


# ── expire_trials sweep ──────────────────────────────────────────────────────────

def test_expire_trials_downgrades_to_free_not_read_only():
    expired = _m(plan="recon", trial_ends_at=NOW - timedelta(days=1), read_only=False)
    session = AsyncMock()
    result = MagicMock()
    result.scalars = MagicMock(return_value=MagicMock(all=MagicMock(return_value=[expired])))
    session.execute = AsyncMock(return_value=result)
    session.commit = AsyncMock()

    count = asyncio.run(trials.expire_trials(session, now=NOW))

    assert count == 1
    assert expired.plan == "free"
    assert expired.trial_ends_at is None
    assert expired.read_only is False     # no lockout — free is a usable floor
    session.commit.assert_awaited_once()


def test_expire_trials_returns_zero_when_none_expired():
    session = AsyncMock()
    result = MagicMock()
    result.scalars = MagicMock(return_value=MagicMock(all=MagicMock(return_value=[])))
    session.execute = AsyncMock(return_value=result)
    session.commit = AsyncMock()

    count = asyncio.run(trials.expire_trials(session, now=NOW))

    assert count == 0
