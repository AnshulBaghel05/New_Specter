"""Admin auth for internal cost/margin reporting (Audit #4). A static
ADMIN_API_KEY (env) is sent as the X-Admin-Key header and constant-time
compared. This is deliberately separate from the scraper HMAC ingest auth
and from the per-merchant JWT — the margin endpoint is operator-only."""
from __future__ import annotations

import hmac
import os

from fastapi import Header, HTTPException


async def require_admin(x_admin_key: str = Header("")) -> None:
    expected = os.environ.get("ADMIN_API_KEY", "")
    if not expected:
        # Fail closed: never serve cost data when no key is configured.
        raise HTTPException(status_code=500, detail={"error": "admin_key_not_configured"})
    if not hmac.compare_digest(x_admin_key, expected):
        raise HTTPException(status_code=401, detail={"error": "invalid_admin_key"})
