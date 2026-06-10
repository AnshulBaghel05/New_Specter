"""HMAC auth for scraper→API internal ingest. The scraper signs
`{timestamp}.{raw_body}` with SCRAPER_INGEST_SECRET; we recompute and
constant-time compare, rejecting anything older than MAX_SKEW_SECONDS."""
from __future__ import annotations
import hashlib, hmac, os, time

from fastapi import Header, HTTPException, Request

MAX_SKEW_SECONDS = 300


def verify_ingest_signature(body: bytes, timestamp: str, signature: str, secret: str | None = None) -> bool:
    secret = secret if secret is not None else os.environ.get("SCRAPER_INGEST_SECRET", "")
    if not secret or not signature or not timestamp:
        return False
    try:
        if abs(int(time.time()) - int(timestamp)) > MAX_SKEW_SECONDS:
            return False
    except (ValueError, TypeError):
        return False
    expected = hmac.new(secret.encode(), timestamp.encode() + b"." + body, hashlib.sha256).hexdigest()
    try:
        return hmac.compare_digest(expected, signature)
    except TypeError:
        return False


async def require_ingest_auth(
    request: Request,
    x_specter_timestamp: str = Header(""),
    x_specter_signature: str = Header(""),
) -> None:
    if not os.environ.get("SCRAPER_INGEST_SECRET"):
        raise HTTPException(status_code=500, detail={"error": "config_error"})
    raw = await request.body()
    if not verify_ingest_signature(raw, x_specter_timestamp, x_specter_signature):
        raise HTTPException(status_code=401, detail={"error": "invalid_ingest_signature"})
