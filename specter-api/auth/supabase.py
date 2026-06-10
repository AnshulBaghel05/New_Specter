"""
Supabase JWT validation — FastAPI dependency.

Reads `Authorization: Bearer {token}`, validates the JWT, extracts the Supabase
user ID from `sub`, and returns the Merchant row.

Modern Supabase projects sign access tokens with **asymmetric keys (ES256/RS256)**
and publish the public keys at `{SUPABASE_URL}/auth/v1/.well-known/jwks.json`.
We validate those against the JWKS (selected by the token's `kid`). Legacy
projects (and our own test/minted tokens) use **HS256** with the shared
`SUPABASE_JWT_SECRET`; that path is kept as a fallback. Without supporting the
asymmetric path, every real Supabase login is rejected and the dashboard cannot
load any data.

On first sign-in the merchant row is auto-created with plan='free' (the freemium
floor) so the frontend never needs a separate "create account" call. Upgrading
to a trial (plan='recon' + trial_ends_at) is an explicit opt-in via
POST /merchants/start-trial.

Environment variables:
  SUPABASE_URL         — project URL, e.g. https://abc.supabase.co (for JWKS).
  SUPABASE_JWT_SECRET  — legacy HS256 secret (Project Settings → API → JWT secret).
"""
from __future__ import annotations

import os
from typing import Optional

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_db
from models.merchants import Merchant

_bearer = HTTPBearer(auto_error=False)

_JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET", "")
_SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
_JWKS_URL = f"{_SUPABASE_URL}/auth/v1/.well-known/jwks.json" if _SUPABASE_URL else ""
_AUDIENCE = "authenticated"   # Supabase always sets aud = "authenticated"
_ASYMMETRIC_ALGS = ("ES256", "RS256")

# kid -> JWK dict. Populated lazily; refreshed when an unknown kid appears
# (handles key rotation without a restart).
_jwks_cache: dict[str, dict] = {}

_401 = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail={"error": "invalid_token", "message": "Missing or invalid Authorization header"},
    headers={"WWW-Authenticate": "Bearer"},
)


async def _get_jwk(kid: str) -> Optional[dict]:
    """Return the JWK for `kid`, fetching (and caching) the project JWKS on a miss."""
    if kid in _jwks_cache:
        return _jwks_cache[kid]
    if not _JWKS_URL:
        return None
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(_JWKS_URL)
            resp.raise_for_status()
            for key in resp.json().get("keys", []):
                if key.get("kid"):
                    _jwks_cache[key["kid"]] = key
    except (httpx.HTTPError, ValueError):
        return None
    return _jwks_cache.get(kid)


async def _decode_token(token: str) -> dict:
    """Validate a Supabase access token (asymmetric via JWKS, or legacy HS256)."""
    try:
        header = jwt.get_unverified_header(token)
    except JWTError:
        raise _401

    alg = header.get("alg")

    if alg in _ASYMMETRIC_ALGS:
        jwk = await _get_jwk(header.get("kid", ""))
        if jwk is None:
            raise _401
        try:
            return jwt.decode(token, jwk, algorithms=[alg], audience=_AUDIENCE)
        except JWTError:
            raise _401

    if alg == "HS256":
        if not _JWT_SECRET:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail={"error": "config_error", "message": "SUPABASE_JWT_SECRET is not configured"},
            )
        try:
            return jwt.decode(token, _JWT_SECRET, algorithms=["HS256"], audience=_AUDIENCE)
        except JWTError:
            raise _401

    raise _401


async def get_current_merchant(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    session: AsyncSession = Depends(get_db),
) -> Merchant:
    """
    FastAPI dependency.  Validates the Supabase JWT and returns the Merchant row.
    Raises HTTP 401 on any auth failure.
    """
    if credentials is None:
        raise _401

    payload = await _decode_token(credentials.credentials)

    supabase_user_id: Optional[str] = payload.get("sub")
    if not supabase_user_id:
        raise _401

    # Supabase access tokens carry the user's email; persist it so background
    # pipelines (OOS detector) can send F5 emails without a JWT in context.
    email: Optional[str] = payload.get("email")

    stmt = select(Merchant).where(Merchant.supabase_user_id == supabase_user_id)
    result = await session.execute(stmt)
    merchant: Optional[Merchant] = result.scalar_one_or_none()

    if merchant is None:
        # First sign-in — auto-create a FREE merchant stub (freemium floor).
        # Trial (recon + trial_ends_at) is an explicit opt-in, not the default.
        merchant = Merchant(
            supabase_user_id=supabase_user_id,
            plan="free",
            notification_email=email,
        )
        session.add(merchant)
        await session.flush()  # assigns merchant.id without committing
    elif email and merchant.notification_email != email:
        # Keep the stored recipient in sync if the user changed their email.
        merchant.notification_email = email

    if merchant.read_only:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "error": "account_suspended",
                "message": "Trial expired — subscribe to continue",
            },
        )

    return merchant
