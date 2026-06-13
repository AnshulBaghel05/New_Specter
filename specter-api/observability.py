"""Optional Sentry error tracking.

Isolated here so the rest of the app never imports `sentry_sdk` directly. Both
functions no-op cleanly when the SDK isn't installed OR `SENTRY_DSN` is unset, so
local dev, tests, and preview need no Sentry account. FastAPI/Starlette are
auto-instrumented by the SDK once `init()` runs — we don't register integrations
explicitly (keeps this version-agnostic).
"""
from __future__ import annotations

import os

try:  # SDK is optional — absence must not break import in dev/test
    import sentry_sdk
except ImportError:  # pragma: no cover - exercised only where the dep is absent
    sentry_sdk = None  # type: ignore[assignment]

_initialised = False


def init_sentry() -> bool:
    """Initialise Sentry if the SDK is present and SENTRY_DSN is set. Idempotent.
    Returns True iff Sentry was actually initialised."""
    global _initialised
    if _initialised or sentry_sdk is None:
        return False
    dsn = os.environ.get("SENTRY_DSN")
    if not dsn:
        return False
    sentry_sdk.init(
        dsn=dsn,
        environment=os.environ.get("SENTRY_ENVIRONMENT")
        or os.environ.get("RAILWAY_ENVIRONMENT", "production"),
        # Errors are always captured; tracing is opt-in (default off — cost).
        traces_sample_rate=float(os.environ.get("SENTRY_TRACES_SAMPLE_RATE", "0.0")),
        send_default_pii=False,
    )
    _initialised = True
    return True


def set_merchant_scope(merchant_id: str) -> None:
    """Tag the current request's Sentry scope with the merchant id so errors are
    attributable. Safe no-op when Sentry is unavailable/uninitialised."""
    if sentry_sdk is None:
        return
    try:
        sentry_sdk.set_tag("merchant_id", merchant_id)
    except Exception:  # noqa: BLE001 — observability must never break the request
        pass
