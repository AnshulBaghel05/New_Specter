"""
Tests for the trial-monitor scheduled job.

Pure reminder_due needs no I/O. The send_trial_reminders sweep is exercised with
a mocked AsyncSession and a mocked Resend sender to verify the correct template
fires on day 12 ("two_days_left") and day 14 ("last_day"). run_trial_monitor is
checked to also run the day-15 expiry sweep.

Run: pytest services/test_trial_monitor.py -v
"""
from __future__ import annotations

import asyncio
import os
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://u:p@localhost:5432/t")
os.environ.setdefault("UPSTASH_REDIS_URL", "rediss://:p@localhost:6379")

import pytest

from services import trial_monitor
from services.trial_monitor import reminder_due

NOW = datetime(2026, 6, 5, 9, 0, tzinfo=timezone.utc)


# ── reminder_due (pure) ──────────────────────────────────────────────────────

def test_reminder_due_two_days_left_on_day_12():
    assert reminder_due(NOW + timedelta(days=2), NOW) == "two_days_left"


def test_reminder_due_last_day_when_ends_today():
    assert reminder_due(NOW + timedelta(hours=5), NOW) == "last_day"  # same calendar day


def test_reminder_due_none_on_day_13():
    assert reminder_due(NOW + timedelta(days=1), NOW) is None


def test_reminder_due_none_when_no_trial():
    assert reminder_due(None, NOW) is None


# ── send_trial_reminders sweep ───────────────────────────────────────────────

def _merchant(days_to_end: float, email="m@store.com", notify=True):
    return SimpleNamespace(
        trial_ends_at=NOW + timedelta(days=days_to_end),
        notification_email=email,
        email_notifications_enabled=notify,
    )


def _session_yielding(merchants):
    session = AsyncMock()
    result = MagicMock()
    result.scalars = MagicMock(return_value=MagicMock(all=MagicMock(return_value=merchants)))
    session.execute = AsyncMock(return_value=result)
    return session


def test_send_trial_reminders_calls_correct_templates():
    """Day-12 merchant → two_days_left; day-14 merchant → last_day; day-13 → nothing."""
    day12 = _merchant(2)
    day14 = _merchant(0.2)   # ends later today
    day13 = _merchant(1)     # no reminder
    session = _session_yielding([day12, day14, day13])

    with patch("services.trial_monitor.send_trial_reminder_email",
               new=AsyncMock(return_value=True)) as send:
        sent = asyncio.run(trial_monitor.send_trial_reminders(session, now=NOW))

    kinds = sorted(call.args[1] for call in send.await_args_list)
    assert kinds == ["last_day", "two_days_left"]
    assert send.await_count == 2
    assert sent == {"two_days_left": 1, "last_day": 1}


def test_send_trial_reminders_skips_when_notifications_off():
    m = _merchant(2, notify=False)
    session = _session_yielding([m])
    with patch("services.trial_monitor.send_trial_reminder_email",
               new=AsyncMock(return_value=True)) as send:
        sent = asyncio.run(trial_monitor.send_trial_reminders(session, now=NOW))
    send.assert_not_awaited()
    assert sent == {"two_days_left": 0, "last_day": 0}


def test_send_trial_reminders_skips_when_no_email():
    m = _merchant(2, email=None)
    session = _session_yielding([m])
    with patch("services.trial_monitor.send_trial_reminder_email",
               new=AsyncMock(return_value=True)) as send:
        asyncio.run(trial_monitor.send_trial_reminders(session, now=NOW))
    send.assert_not_awaited()


# ── run_trial_monitor also runs the day-15 expiry sweep ──────────────────────

def test_run_trial_monitor_runs_reminders_and_expiry():
    session = _session_yielding([])
    with patch("services.trial_monitor.send_trial_reminder_email", new=AsyncMock(return_value=True)):
        with patch("services.trial_monitor.expire_trials", new=AsyncMock(return_value=3)) as expire:
            result = asyncio.run(trial_monitor.run_trial_monitor(session, now=NOW))
    expire.assert_awaited_once()
    assert result["expired"] == 3
    assert result["reminders"] == {"two_days_left": 0, "last_day": 0}
