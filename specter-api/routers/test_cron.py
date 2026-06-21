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
from redis_client import get_redis
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


def test_proxy_guard_valid_token_runs_and_returns_status(client):
    from unittest.mock import MagicMock
    app.dependency_overrides[get_redis] = lambda: MagicMock()
    fake = AsyncMock(return_value={
        "day": "2026-06-16", "residential_usd": 30.0, "datacenter_usd": 70.0,
        "residential_share": 0.30, "breached": True, "reasons": ["share"], "alerted": True,
    })
    with patch("routers.cron.run_proxy_guard", new=fake):
        resp = client.post("/internal/run-proxy-guard", headers={"Authorization": f"Bearer {SECRET}"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok" and body["breached"] is True and body["alerted"] is True
    fake.assert_awaited_once()


def test_proxy_guard_wrong_token_rejected_401(client):
    from unittest.mock import MagicMock
    app.dependency_overrides[get_redis] = lambda: MagicMock()
    with patch("routers.cron.run_proxy_guard", new=AsyncMock()) as fake:
        resp = client.post("/internal/run-proxy-guard", headers={"Authorization": "Bearer nope"})
    assert resp.status_code == 401
    fake.assert_not_awaited()


def test_fx_refresh_valid_token_caches_rates(client):
    from unittest.mock import MagicMock
    app.dependency_overrides[get_redis] = lambda: MagicMock()
    with patch("routers.cron.fx.refresh_usd_rates",
               return_value={"USD": 1.0, "EUR": 0.9}) as fake:
        resp = client.post("/internal/run-fx-refresh", headers={"Authorization": f"Bearer {SECRET}"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok" and body["refreshed"] is True and body["currencies"] == 2
    fake.assert_called_once()


def test_fx_refresh_reports_failure_without_error(client):
    from unittest.mock import MagicMock
    app.dependency_overrides[get_redis] = lambda: MagicMock()
    with patch("routers.cron.fx.refresh_usd_rates", return_value=None):
        resp = client.post("/internal/run-fx-refresh", headers={"Authorization": f"Bearer {SECRET}"})
    assert resp.status_code == 200
    assert resp.json()["refreshed"] is False


def test_fx_refresh_wrong_token_rejected_401(client):
    from unittest.mock import MagicMock
    app.dependency_overrides[get_redis] = lambda: MagicMock()
    with patch("routers.cron.fx.refresh_usd_rates") as fake:
        resp = client.post("/internal/run-fx-refresh", headers={"Authorization": "Bearer nope"})
    assert resp.status_code == 401
    fake.assert_not_called()


def test_attribution_valid_token_runs_backfill(client):
    app.dependency_overrides[get_db] = override_db(AsyncMock())
    fake = AsyncMock(return_value={"candidates": 3, "attributed": 2, "skipped": 1})
    with patch("routers.cron.run_attribution_backfill", new=fake):
        resp = client.post("/internal/run-attribution", headers={"Authorization": f"Bearer {SECRET}"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok" and body["attributed"] == 2 and body["skipped"] == 1
    fake.assert_awaited_once()


def test_attribution_wrong_token_rejected_401(client):
    app.dependency_overrides[get_db] = override_db(AsyncMock())
    with patch("routers.cron.run_attribution_backfill", new=AsyncMock()) as fake:
        resp = client.post("/internal/run-attribution", headers={"Authorization": "Bearer nope"})
    assert resp.status_code == 401
    fake.assert_not_awaited()
