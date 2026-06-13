import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from observability import init_sentry
from routers import merchants, skus, competitors, signals, alerts, repricing, attribution, products, calculations, billing, internal, cost, cron, health

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
    Comma-separated origins → that list; empty/unset → ["*"] (open, dev default)."""
    origins = [o.strip() for o in (raw or "").split(",") if o.strip()]
    return origins or ["*"]


_allow_origins = parse_allowed_origins(os.environ.get("ALLOWED_ORIGINS"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allow_origins,
    allow_credentials=_allow_origins != ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

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
app.include_router(cron.router)
app.include_router(health.router)
