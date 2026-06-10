import os
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://user:pass@localhost:5432/test")
os.environ.setdefault("UPSTASH_REDIS_URL", "rediss://:password@localhost:6379")
os.environ["SUPABASE_JWT_SECRET"] = "test-supabase-jwt-secret-32-char!"

import asyncio
from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest

import workers.eclipse_router as er
from workers.eclipse_router import route_eclipse_job

JOB = {"url": "https://shop.example/p", "domain": "shop.example", "urlPath": "/p"}


@pytest.fixture
def redis_client():
    r = MagicMock()
    r.incr = MagicMock(return_value=1)
    return r


@pytest.fixture(autouse=True)
def _eclipse_url(monkeypatch):
    monkeypatch.setenv("ECLIPSE_WORKER_URL", "https://eclipse-worker.internal/scrape")


def test_503_requeues_to_shared_playwright_queue(redis_client, monkeypatch):
    monkeypatch.setattr(er, "_post_to_worker",
                        AsyncMock(return_value=MagicMock(status_code=503)))
    fallback_email = AsyncMock(return_value=True)
    monkeypatch.setattr(er, "send_eclipse_fallback_email", fallback_email)

    result = asyncio.run(
        route_eclipse_job(JOB, redis_client=redis_client, merchant_email="m@x.io")
    )

    assert result == "fallback"
    # Re-queued onto the shared scrape:playwright BullMQ queue.
    redis_client.rpush.assert_called_once()
    queue_key = redis_client.rpush.call_args.args[0]
    assert queue_key == "bull:scrape:playwright:wait"
    fallback_email.assert_awaited_once_with("m@x.io", "shop.example")


def test_timeout_falls_back_to_shared_queue(redis_client, monkeypatch):
    monkeypatch.setattr(er, "_post_to_worker",
                        AsyncMock(side_effect=httpx.TimeoutException("slow")))
    monkeypatch.setattr(er, "send_eclipse_fallback_email", AsyncMock(return_value=True))

    result = asyncio.run(
        route_eclipse_job(JOB, redis_client=redis_client, merchant_email="m@x.io")
    )

    assert result == "fallback"
    redis_client.rpush.assert_called_once()
    assert redis_client.rpush.call_args.args[0] == "bull:scrape:playwright:wait"


def test_healthy_worker_uses_dedicated_no_requeue(redis_client, monkeypatch):
    monkeypatch.setattr(er, "_post_to_worker",
                        AsyncMock(return_value=MagicMock(status_code=200)))
    email = AsyncMock(return_value=True)
    monkeypatch.setattr(er, "send_eclipse_fallback_email", email)

    result = asyncio.run(
        route_eclipse_job(JOB, redis_client=redis_client, merchant_email="m@x.io")
    )

    assert result == "dedicated"
    redis_client.rpush.assert_not_called()
    email.assert_not_awaited()


def test_no_worker_url_falls_back(redis_client, monkeypatch):
    monkeypatch.delenv("ECLIPSE_WORKER_URL", raising=False)
    monkeypatch.setattr(er, "send_eclipse_fallback_email", AsyncMock(return_value=True))

    result = asyncio.run(route_eclipse_job(JOB, redis_client=redis_client))

    assert result == "fallback"
    redis_client.rpush.assert_called_once()
