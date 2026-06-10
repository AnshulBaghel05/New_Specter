# auth/test_internal_auth.py
import os, time, hmac, hashlib, json
import pytest
os.environ.setdefault("SCRAPER_INGEST_SECRET", "test-ingest-secret")
from auth.internal_auth import verify_ingest_signature, require_ingest_auth
from fastapi import HTTPException

def _sig(body: bytes, ts: str, secret="test-ingest-secret") -> str:
    return hmac.new(secret.encode(), ts.encode() + b"." + body, hashlib.sha256).hexdigest()

def test_valid_signature_passes():
    body = json.dumps({"a": 1}).encode()
    ts = str(int(time.time()))
    assert verify_ingest_signature(body, ts, _sig(body, ts)) is True

def test_tampered_body_fails():
    ts = str(int(time.time()))
    assert verify_ingest_signature(b'{"a":2}', ts, _sig(b'{"a":1}', ts)) is False

def test_stale_timestamp_fails():
    body = b"{}"
    ts = str(int(time.time()) - 600)  # 10 min old
    assert verify_ingest_signature(body, ts, _sig(body, ts)) is False

def test_missing_signature_fails():
    assert verify_ingest_signature(b"{}", str(int(time.time())), "") is False


def test_missing_secret_fails():
    assert verify_ingest_signature(b"{}", str(int(time.time())), "any-sig", secret="") is False


def test_wrong_secret_fails():
    ts = str(int(time.time()))
    body = b"{}"
    assert verify_ingest_signature(body, ts, _sig(body, ts, secret="other-secret")) is False


def test_missing_env_secret_raises_500(monkeypatch):
    """require_ingest_auth must 500 when SCRAPER_INGEST_SECRET is missing (ops misconfiguration)."""
    monkeypatch.delenv("SCRAPER_INGEST_SECRET", raising=False)
    with pytest.raises(HTTPException) as exc_info:
        import asyncio
        from unittest.mock import AsyncMock, MagicMock
        request = MagicMock()
        request.body = AsyncMock(return_value=b"{}")
        asyncio.run(require_ingest_auth(request, x_specter_timestamp="", x_specter_signature=""))
    assert exc_info.value.status_code == 500
    assert exc_info.value.detail == {"error": "config_error"}
