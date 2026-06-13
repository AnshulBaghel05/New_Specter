"""Tests for the scheduled-job trigger router (routers/cron.py).

Run: pytest routers/test_cron.py -v

Covers the Bearer-token guard (auth.cron_auth) and that a valid call delegates
to services.trial_monitor.run_trial_monitor. The trial-monitor logic itself is
tested in services/test_trial_monitor.py — here we only assert the wiring + auth.
"""
from __future__ import annotations

import base64
import os
from unittest.mock import AsyncMock, patch

# ── Env before app imports ───────────────────────────────────────────────────
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://user:pass@localhost:5432/test")
os.environ.setdefault("UPSTASH_REDIS_URL", "rediss://:password@localhost:6379")
os.environ["SUPABASE_JWT_SECRET"] = "test-supabase-jwt-secret-32-char!"
os.environ["ENCRYPTION_KEY"] = base64.urlsafe_b64encode(b"t" * 32).decode()
os.environ["TRIAL_MONITOR_SECRET"] = "cron_secret_123"

import pytest
from fastapi.testclient import TestClient

from db import get_db
from main import app

SECRET = "cron_secret_123"


def override_db(session):
    async def _gen():
        yield session
    return _gen


@pytest.fixture(autouse=True)
def clear_overrides():
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def client():
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c


def test_valid_token_runs_monitor(client):
    app.dependency_overrides[get_db] = override_db(AsyncMock())
    fake = AsyncMock(return_value={"reminders": {"two_days_left": 1, "last_day": 0}, "expired": 2})
    with patch("routers.cron.run_trial_monitor", new=fake):
        resp = client.post("/internal/run-trial-monitor", headers={"Authorization": f"Bearer {SECRET}"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["expired"] == 2
    assert body["reminders"]["two_days_left"] == 1
    fake.assert_awaited_once()


def test_wrong_token_rejected_401(client):
    app.dependency_overrides[get_db] = override_db(AsyncMock())
    with patch("routers.cron.run_trial_monitor", new=AsyncMock()) as fake:
        resp = client.post("/internal/run-trial-monitor", headers={"Authorization": "Bearer nope"})
    assert resp.status_code == 401
    assert resp.json()["detail"]["error"] == "unauthorized"
    fake.assert_not_awaited()


def test_missing_token_rejected_401(client):
    app.dependency_overrides[get_db] = override_db(AsyncMock())
    resp = client.post("/internal/run-trial-monitor")
    assert resp.status_code == 401


def test_unset_secret_is_config_error_500(client, monkeypatch):
    """An unset secret must fail closed (500), never run as an open endpoint."""
    monkeypatch.delenv("TRIAL_MONITOR_SECRET", raising=False)
    app.dependency_overrides[get_db] = override_db(AsyncMock())
    resp = client.post("/internal/run-trial-monitor", headers={"Authorization": "Bearer anything"})
    assert resp.status_code == 500
    assert resp.json()["detail"]["error"] == "config_error"
