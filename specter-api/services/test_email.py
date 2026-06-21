import os
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://user:pass@localhost:5432/test")
os.environ.setdefault("UPSTASH_REDIS_URL", "rediss://:password@localhost:6379")
os.environ["RESEND_API_KEY"] = "re_test_key"

import asyncio
from unittest.mock import patch

import pytest

import services.email as email


@pytest.fixture(autouse=True)
def _api_key(monkeypatch):
    # The module captures RESEND_API_KEY at import; pin it per-test so suite-wide
    # import order can't leave it empty. The missing-key test overrides to "".
    monkeypatch.setattr(email, "_RESEND_API_KEY", "re_test_key")


# ── A fake httpx.AsyncClient capturing what got posted ──────────────────────────

class _FakeResp:
    def __init__(self, status=200, text="ok"):
        self.status_code = status
        self.text = text


class _FakeClient:
    """Records every POST; returns a queued sequence of responses."""
    posted: list[dict] = []
    responses: list = []

    def __init__(self, *a, **k): ...
    async def __aenter__(self): return self
    async def __aexit__(self, *a): return False

    async def post(self, url, headers=None, json=None):
        _FakeClient.posted.append({"url": url, "headers": headers or {}, "json": json or {}})
        return _FakeClient.responses.pop(0) if _FakeClient.responses else _FakeResp()


def _reset(responses=None):
    _FakeClient.posted = []
    _FakeClient.responses = list(responses or [])


def _run_send(template, to, data):
    with patch.object(email.httpx, "AsyncClient", _FakeClient):
        return asyncio.run(email.send_email(template, to, data))


# ── send_email — central registry dispatch ─────────────────────────────────────

def test_send_email_dispatches_known_template_and_posts():
    _reset([_FakeResp(200)])
    ok = _run_send("signal_alert", "u@x.com",
                   {"sku_title": "Blue Widget", "signal_type": "RAISE"})
    assert ok is True
    assert len(_FakeClient.posted) == 1
    body = _FakeClient.posted[0]["json"]
    assert body["to"] == ["u@x.com"]
    assert "RAISE" in body["subject"]
    assert "Blue Widget" in body["html"]


def test_unknown_template_is_a_safe_noop():
    _reset([_FakeResp(200)])
    ok = _run_send("does_not_exist", "u@x.com", {})
    assert ok is False
    assert _FakeClient.posted == []          # nothing sent


# ── List-Unsubscribe only on alert templates, never transactional ───────────────

def test_alert_template_carries_list_unsubscribe_header():
    _reset([_FakeResp(200)])
    _run_send("oos_alert", "u@x.com", {"competitor_name": "rival.com", "sku_title": "X"})
    headers = _FakeClient.posted[0]["json"].get("headers", {})
    assert "List-Unsubscribe" in headers
    assert "List-Unsubscribe-Post" in headers


def test_signal_alert_includes_stock_transitions():
    # The product-signal alert covers price moves AND stock in/out.
    for st, needle in [("RAISE", "RAISE"), ("LOWER", "LOWER"),
                       ("OOS", "out of stock"), ("RESTOCK", "back in stock")]:
        _reset([_FakeResp(200)])
        ok = _run_send("signal_alert", "u@x.com", {"sku_title": "Widget", "signal_type": st})
        assert ok is True, st
        assert needle.lower() in _FakeClient.posted[0]["json"]["html"].lower(), st


# ── Reliability: retry on transient 5xx, never raise on bad key ─────────────────

def test_retries_on_5xx_then_succeeds():
    _reset([_FakeResp(503, "upstream"), _FakeResp(200)])
    ok = _run_send("signal_alert", "u@x.com", {"sku_title": "W", "signal_type": "RAISE"})
    assert ok is True
    assert len(_FakeClient.posted) == 2          # one retry


def test_missing_api_key_returns_false_without_crashing(monkeypatch):
    monkeypatch.setattr(email, "_RESEND_API_KEY", "")
    _reset([_FakeResp(200)])
    ok = _run_send("signal_alert", "u@x.com", {"sku_title": "W", "signal_type": "RAISE"})
    assert ok is False
    assert _FakeClient.posted == []              # never attempted


def test_4xx_does_not_retry():
    _reset([_FakeResp(422, "bad"), _FakeResp(200)])
    ok = _run_send("signal_alert", "u@x.com", {"sku_title": "W", "signal_type": "RAISE"})
    assert ok is False
    assert len(_FakeClient.posted) == 1          # 4xx is terminal — no retry


# ── Back-compat: the existing named senders still work via the registry ─────────

def test_legacy_oos_sender_still_sends():
    _reset([_FakeResp(200)])
    with patch.object(email.httpx, "AsyncClient", _FakeClient):
        ok = asyncio.run(email.send_oos_alert_email("u@x.com", "rival.com", "Blue Widget"))
    assert ok is True
    assert "rival.com" in _FakeClient.posted[0]["json"]["html"]
