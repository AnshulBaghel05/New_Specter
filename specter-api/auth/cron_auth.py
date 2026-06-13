"""Bearer-token auth for scheduled internal jobs (e.g. the daily trial monitor).

A cron caller sends `Authorization: Bearer {TRIAL_MONITOR_SECRET}`. We
constant-time compare against the configured secret. Fails closed: an unset
secret is a 500 config error (never an open endpoint), a bad/absent token is a
401. Plain bearer (not HMAC) because a cron POST has no body to sign and the
transport is HTTPS — this matches the ergonomics of a scheduler hitting a URL.
"""
from __future__ import annotations

import hmac
import os

from fastapi import Header, HTTPException


def require_cron_auth(authorization: str = Header("")) -> None:
    secret = os.environ.get("TRIAL_MONITOR_SECRET", "")
    if not secret:
        raise HTTPException(status_code=500, detail={"error": "config_error"})
    if not hmac.compare_digest(authorization, f"Bearer {secret}"):
        raise HTTPException(status_code=401, detail={"error": "unauthorized"})
