"""SSRF hardening: _check_url_reachable must NOT follow redirects.

It runs from the API process with direct network access, so following a redirect
would let a public host 3xx us into internal infrastructure (cloud metadata,
loopback, private ranges). A 3xx is treated as 'reachable' without being followed.
"""
from __future__ import annotations

import asyncio
import os
from unittest.mock import AsyncMock, MagicMock, patch

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://user:pass@localhost:5432/test")
os.environ.setdefault("UPSTASH_REDIS_URL", "rediss://:password@localhost:6379")

import httpx

from routers.competitors import _check_url_reachable


def _patched_client(*, status_code: int | None = None, raises: Exception | None = None):
    """Patch httpx.AsyncClient so we can inspect kwargs and stub the HEAD response.
    Returns (patcher, captured_kwargs, head_mock)."""
    captured: dict = {}
    head = AsyncMock()
    if raises is not None:
        head.side_effect = raises
    else:
        resp = MagicMock()
        resp.status_code = status_code
        head.return_value = resp

    class _FakeClient:
        def __init__(self, **kwargs):
            captured.update(kwargs)

        async def __aenter__(self):
            inner = MagicMock()
            inner.head = head
            return inner

        async def __aexit__(self, *a):
            return False

    return patch("httpx.AsyncClient", _FakeClient), captured, head


def test_does_not_follow_redirects():
    patcher, captured, _ = _patched_client(status_code=301)
    with patcher:
        result = asyncio.run(_check_url_reachable("https://shop.example.com/p"))
    assert captured.get("follow_redirects") is False   # the SSRF-hardening guarantee
    assert result is True                                # 3xx = reachable, not followed


def test_2xx_is_reachable():
    patcher, _, _ = _patched_client(status_code=200)
    with patcher:
        assert asyncio.run(_check_url_reachable("https://shop.example.com/p")) is True


def test_5xx_is_unreachable():
    patcher, _, _ = _patched_client(status_code=503)
    with patcher:
        assert asyncio.run(_check_url_reachable("https://shop.example.com/p")) is False


def test_connection_error_is_unreachable():
    patcher, _, _ = _patched_client(raises=httpx.ConnectError("refused"))
    with patcher:
        assert asyncio.run(_check_url_reachable("https://shop.example.com/p")) is False
