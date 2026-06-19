import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from observability import init_sentry
from rate_limit import limiter
from routers import merchants, skus, competitors, signals, alerts, repricing, attribution, products, calculations, billing, internal, cost, cron, health, scrape_health

# Initialise error tracking before the app is built so import-time/startup errors
# are captured. No-ops without sentry-sdk + SENTRY_DSN (see observability.py).
init_sentry()

app = FastAPI(title="specter-api", version="0.2.0")

# CORS: restrict to the frontend origin(s) in production via ALLOWED_ORIGINS
# (comma-separated). Defaults to "*" for local dev when unset. Credentials are
# only enabled when origins are explicitly restricted — the browser rejects
# `Access-Control-Allow-Origin: *` together with credentials, and the frontend
# authenticates with a Bearer JWT (not cookies), so "*" needs none.
def parse_allowed_origins(raw: str | None) -> list[str]:
    """Parse the ALLOWED_ORIGINS env value into a CORS origins list.
    Comma-separated origins → that list; empty/unset → ["*"] (open, dev default).

    Trailing slashes are stripped: a browser's `Origin` header is the bare scheme
    + host (+ port) with NO path, so an allowlist entry of
    `https://app.vercel.app/` would never match `https://app.vercel.app` and the
    CORSMiddleware would emit no Access-Control-Allow-Origin header — silently
    breaking every cross-origin call. Normalising here makes the env value
    slash-insensitive."""
    origins = [o.strip().rstrip("/") for o in (raw or "").split(",")]
    origins = [o for o in origins if o]
    return origins or ["*"]


def is_production_env(environment: str | None) -> bool:
    """True when running in a deployed (non-local) environment. Railway sets
    RAILWAY_ENVIRONMENT on every deploy; local dev and the test suite leave it
    unset. Used to decide whether an open CORS policy must fail closed."""
    env = (environment or "").strip().lower()
    return env not in ("", "development", "dev", "local", "test")


def resolve_cors_origins(raw: str | None, environment: str | None) -> list[str]:
    """Allowed CORS origins, failing CLOSED in production. A deployed service with
    ALLOWED_ORIGINS unset would otherwise serve `*` — letting any website call the
    API in a logged-in user's browser context. Rather than silently ship that, we
    refuse to boot so the misconfiguration is caught at deploy time, not in prod."""
    origins = parse_allowed_origins(raw)
    if origins == ["*"] and is_production_env(environment):
        raise RuntimeError(
            "ALLOWED_ORIGINS must be set in production (refusing to serve an open "
            "CORS policy). Set it to your frontend origin(s), e.g. "
            "ALLOWED_ORIGINS=https://app.specterapp.io"
        )
    return origins


_allow_origins = resolve_cors_origins(
    os.environ.get("ALLOWED_ORIGINS"), os.environ.get("RAILWAY_ENVIRONMENT")
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allow_origins,
    allow_credentials=_allow_origins != ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rate limiting (slowapi). A generous default ceiling guards every route; routers
# tighten sensitive endpoints (e.g. competitors POST, billing webhook) with their
# own @limiter.limit decorators. No-op when RATE_LIMIT_ENABLED is false.
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

app.include_router(merchants.router)
app.include_router(skus.router)
app.include_router(competitors.router)
app.include_router(signals.router)
app.include_router(alerts.router)
app.include_router(repricing.router)
app.include_router(attribution.router)
app.include_router(products.router)
app.include_router(calculations.router)
app.include_router(billing.router)
app.include_router(internal.router)
app.include_router(cost.router)
app.include_router(scrape_health.router)
app.include_router(cron.router)
app.include_router(health.router)
