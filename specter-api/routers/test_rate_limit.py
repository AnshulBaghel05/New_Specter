"""Rate-limit dependency tests — blocks after the window, no-op when disabled."""
import os
import uuid

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://user:pass@localhost:5432/test")
os.environ.setdefault("UPSTASH_REDIS_URL", "rediss://:password@localhost:6379")

from fastapi import Depends, FastAPI  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from rate_limit import rate_limit_dependency  # noqa: E402


def _app(limit: str, scope: str) -> FastAPI:
    app = FastAPI()

    @app.get("/x", dependencies=[Depends(rate_limit_dependency(limit, scope))])
    def x():
        return {"ok": True}

    return app


def test_blocks_after_limit(monkeypatch):
    monkeypatch.setenv("RATE_LIMIT_ENABLED", "true")
    scope = "test_" + uuid.uuid4().hex  # unique → isolated from other tests
    c = TestClient(_app("2/minute", scope))
    assert c.get("/x").status_code == 200
    assert c.get("/x").status_code == 200
    r = c.get("/x")
    assert r.status_code == 429
    assert r.json()["detail"]["error"] == "rate_limited"


def test_disabled_does_not_block(monkeypatch):
    monkeypatch.setenv("RATE_LIMIT_ENABLED", "false")
    scope = "test_" + uuid.uuid4().hex
    c = TestClient(_app("1/minute", scope))
    # Well past the "1/minute" limit, but disabled → all allowed.
    assert c.get("/x").status_code == 200
    assert c.get("/x").status_code == 200
    assert c.get("/x").status_code == 200
