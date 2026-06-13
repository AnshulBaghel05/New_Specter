from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from observability import init_sentry
from routers import merchants, skus, competitors, signals, alerts, repricing, attribution, products, calculations, billing, internal, cost, cron, health

# Initialise error tracking before the app is built so import-time/startup errors
# are captured. No-ops without sentry-sdk + SENTRY_DSN (see observability.py).
init_sentry()

app = FastAPI(title="specter-api", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # locked down per-env via ALLOWED_ORIGINS
    allow_credentials=True,
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
