import asyncio
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient

from main import app
from db import get_db
from routers.scrape_health import _health_dep   # the patchable seam
from services import scrape_health


def _override_db():
    async def _gen():
        yield AsyncMock()
    return _gen


@pytest.fixture(autouse=True)
def _admin_key(monkeypatch):
    monkeypatch.setenv("ADMIN_API_KEY", "secret-admin-key")
    yield
    app.dependency_overrides.clear()


# ── Pure rate math (compute_rates) ────────────────────────────────────────────

def test_compute_rates_basic_split():
    rates = scrape_health.compute_rates({
        "stored": 80, "unchanged": 10, "failed": 5, "blocked": 3, "excluded": 2,
    })
    assert rates["total"] == 100
    # success = stored+unchanged = 90 ; parse_attempts = 90 + 5 = 95
    assert rates["parser_success_rate"] == round(90 / 95, 4)
    assert rates["crawl_success_rate"] == 0.9
    assert rates["blocked_rate"] == 0.03
    assert rates["failed_rate"] == 0.05
    assert rates["excluded_rate"] == 0.02


def test_compute_rates_empty_window_is_none_not_zero():
    rates = scrape_health.compute_rates({})
    assert rates["total"] == 0
    assert rates["parser_success_rate"] is None
    assert rates["crawl_success_rate"] is None
    assert rates["blocked_rate"] is None


def test_compute_rates_parser_rate_none_when_only_blocked():
    """Blocked/excluded never reach the parser → parser_success_rate undefined."""
    rates = scrape_health.compute_rates({"blocked": 4, "excluded": 1})
    assert rates["parser_success_rate"] is None      # no parse attempts
    assert rates["crawl_success_rate"] == 0.0        # of all outcomes, none succeeded
    assert rates["blocked_rate"] == 0.8


# ── Window assembly (per-domain, worst-first) ─────────────────────────────────

def test_scrape_health_assembles_windows_and_orders_domains():
    # (domain, status, count) rows — same shape session.execute(...).all() yields.
    rows = [
        ("good.com", "stored", 50),
        ("good.com", "failed", 1),
        ("bad.com", "blocked", 9),
        ("bad.com", "stored", 1),
    ]
    session = AsyncMock()
    session.execute = AsyncMock(return_value=MagicMock(all=MagicMock(return_value=rows)))

    out = asyncio.run(scrape_health.scrape_health(session, now=datetime(2026, 6, 15, tzinfo=timezone.utc)))

    # All three windows present.
    assert set(out.keys()) == {"24h", "7d", "30d"}
    window = out["24h"]
    assert window["total"] == 61
    # bad.com has the higher blocked+failed share → sorted first.
    assert window["domains"][0]["domain"] == "bad.com"
    assert window["domains"][1]["domain"] == "good.com"
    assert window["domains"][0]["blocked_rate"] == 0.9


# ── Endpoint auth + wiring ────────────────────────────────────────────────────

def test_health_requires_admin_key():
    with TestClient(app) as c:
        resp = c.get("/admin/scrape/health")
        assert resp.status_code == 401


def test_health_rejects_wrong_key():
    with TestClient(app) as c:
        resp = c.get("/admin/scrape/health", headers={"X-Admin-Key": "wrong"})
        assert resp.status_code == 401


def test_health_returns_windows_with_valid_key():
    app.dependency_overrides[get_db] = _override_db()
    fake_windows = {
        "24h": {"total": 10, "parser_success_rate": 0.9, "crawl_success_rate": 0.9,
                "blocked_rate": 0.1, "failed_rate": 0.0, "excluded_rate": 0.0,
                "counts": {"stored": 9, "blocked": 1}, "domains": []},
        "7d": {"total": 0, "parser_success_rate": None, "domains": []},
        "30d": {"total": 0, "parser_success_rate": None, "domains": []},
    }
    app.dependency_overrides[_health_dep] = lambda: AsyncMock(return_value=fake_windows)
    with TestClient(app) as c:
        resp = c.get("/admin/scrape/health", headers={"X-Admin-Key": "secret-admin-key"})
        assert resp.status_code == 200
        body = resp.json()
        assert "generated_at" in body
        assert body["windows"]["24h"]["crawl_success_rate"] == 0.9
        assert set(body["windows"].keys()) == {"24h", "7d", "30d"}
