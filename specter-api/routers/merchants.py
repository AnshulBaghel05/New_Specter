"""
Merchant profile routes and Shopify OAuth flow (F1).

Routes:
  GET   /merchants/me                — current merchant profile
  PATCH /merchants/me                — update display name / timezone
  GET   /merchants/shopify/oauth     — begin Shopify OAuth (redirects browser)
  GET   /merchants/shopify/callback  — OAuth callback; stores encrypted token; triggers SKU import
  POST  /merchants/shopify/disconnect — clear Shopify credentials

Environment variables required for Shopify OAuth:
  SHOPIFY_API_KEY       — Shopify Partner app client_id
  SHOPIFY_API_SECRET    — Shopify Partner app client_secret
  SHOPIFY_REDIRECT_URI  — e.g. https://api.specterapp.io/merchants/shopify/callback
  SHOPIFY_SCOPES        — comma-separated (default: read_products,write_products)
  ENCRYPTION_KEY        — Fernet key (URL-safe base64, 32 bytes) for encrypting access tokens
  DASHBOARD_URL         — redirect destination after OAuth (e.g. https://app.specterapp.io/dashboard)
"""
from __future__ import annotations

import hashlib
import hmac
import os
import uuid
from typing import Optional
from urllib.parse import urlencode

import httpx
from cryptography.fernet import Fernet, InvalidToken
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Response, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from datetime import datetime, timezone

from auth.plan_gate import competitor_limit_for, plan_competitor_limit
from auth.supabase import get_current_merchant
from db import get_db
from models.merchants import Merchant
from models.skus import SKU
from services.trials import trial_end_at

# ── Config ────────────────────────────────────────────────────────────────────

_SHOPIFY_API_KEY    = os.environ.get("SHOPIFY_API_KEY", "")
_SHOPIFY_API_SECRET = os.environ.get("SHOPIFY_API_SECRET", "")
_REDIRECT_URI       = os.environ.get("SHOPIFY_REDIRECT_URI", "")
_SCOPES             = os.environ.get("SHOPIFY_SCOPES", "read_products,write_products")
_DASHBOARD_URL      = os.environ.get("DASHBOARD_URL", "/dashboard")
_ENCRYPTION_KEY     = os.environ.get("ENCRYPTION_KEY", "")


def _fernet() -> Fernet:
    if not _ENCRYPTION_KEY:
        raise HTTPException(
            status_code=500,
            detail={"error": "config_error", "message": "ENCRYPTION_KEY is not configured"},
        )
    return Fernet(_ENCRYPTION_KEY.encode() if isinstance(_ENCRYPTION_KEY, str) else _ENCRYPTION_KEY)


def _encrypt(text: str) -> str:
    return _fernet().encrypt(text.encode()).decode()


def _decrypt(ciphertext: str) -> str:
    try:
        return _fernet().decrypt(ciphertext.encode()).decode()
    except InvalidToken:
        raise HTTPException(status_code=500, detail={"error": "decrypt_failed"})


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class MerchantOut(BaseModel):
    id: uuid.UUID
    plan: str
    shopify_domain: Optional[str]
    shopify_connected: bool
    shopify_reconnect_required: bool
    trial_ends_at: Optional[str]
    read_only: bool
    eclipse_interval_ms: int
    max_competitors_per_sku: Optional[int]
    auto_reprice_enabled: bool
    email_notifications_enabled: bool

    model_config = {"from_attributes": True}


class MerchantPatch(BaseModel):
    eclipse_interval_ms: Optional[int] = None
    email_notifications_enabled: Optional[bool] = None


# ── Router ────────────────────────────────────────────────────────────────────

router = APIRouter(prefix="/merchants", tags=["merchants"])


# ── Helper: Shopify HMAC validation ──────────────────────────────────────────

def _verify_shopify_hmac(params: dict[str, str], received_hmac: str) -> bool:
    """Validate Shopify's HMAC signature on OAuth callback parameters."""
    message = "&".join(
        f"{k}={v}"
        for k, v in sorted(params.items())
        if k != "hmac"
    )
    expected = hmac.new(
        _SHOPIFY_API_SECRET.encode(),
        message.encode(),
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, received_hmac)


# ── Background: SKU import from Shopify ──────────────────────────────────────

async def _import_shopify_skus(
    merchant_id: uuid.UUID,
    shop: str,
    access_token: str,
) -> None:
    """
    Fetch products from Shopify Admin API and upsert into skus table.
    Runs as a FastAPI background task after OAuth callback.
    """
    from db import AsyncSessionLocal

    async with AsyncSessionLocal() as session:
        page_info: Optional[str] = None
        imported = 0

        async with httpx.AsyncClient(timeout=30.0) as client:
            while True:
                params: dict = {"limit": 250, "fields": "id,title,handle,variants"}
                if page_info:
                    params["page_info"] = page_info

                resp = await client.get(
                    f"https://{shop}/admin/api/2024-01/products.json",
                    params=params,
                    headers={"X-Shopify-Access-Token": access_token},
                )

                # Detect token expiry — mark for reconnect (F1 AC#6)
                if resp.status_code == 401:
                    async with AsyncSessionLocal() as mark_session:
                        merchant = await mark_session.get(Merchant, merchant_id)
                        if merchant:
                            merchant.shopify_reconnect_required = True
                            await mark_session.commit()
                    return

                if not resp.ok:
                    break

                products = resp.json().get("products", [])
                for product in products:
                    for variant in product.get("variants", []):
                        # Upsert by shopify_variant_id
                        from sqlalchemy import select
                        stmt = select(SKU).where(
                            SKU.merchant_id == merchant_id,
                            SKU.shopify_variant_id == str(variant["id"]),
                        )
                        existing = (await session.execute(stmt)).scalar_one_or_none()

                        if existing is None:
                            sku = SKU(
                                merchant_id=merchant_id,
                                title=f"{product['title']} — {variant.get('title', '')}".strip(" — "),
                                handle=product.get("handle"),
                                current_price=variant.get("price"),
                                shopify_variant_id=str(variant["id"]),
                            )
                            session.add(sku)
                            imported += 1
                        else:
                            # Refresh price from Shopify
                            existing.current_price = variant.get("price")

                # Pagination
                link_header = resp.headers.get("Link", "")
                if 'rel="next"' in link_header:
                    import re
                    m = re.search(r'page_info=([^&>]+).*rel="next"', link_header)
                    page_info = m.group(1) if m else None
                else:
                    break

                if page_info is None:
                    break

        await session.commit()


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/me", response_model=MerchantOut)
async def get_me(merchant: Merchant = Depends(get_current_merchant)) -> MerchantOut:
    return MerchantOut(
        id=merchant.id,
        plan=merchant.plan,
        shopify_domain=merchant.shopify_domain,
        shopify_connected=bool(merchant.shopify_access_token),
        shopify_reconnect_required=merchant.shopify_reconnect_required,
        trial_ends_at=merchant.trial_ends_at.isoformat() if merchant.trial_ends_at else None,
        read_only=merchant.read_only,
        eclipse_interval_ms=merchant.eclipse_interval_ms,
        max_competitors_per_sku=competitor_limit_for(merchant.plan, merchant.max_competitors_per_sku),
        auto_reprice_enabled=merchant.auto_reprice_enabled,
        email_notifications_enabled=merchant.email_notifications_enabled,
    )


@router.patch("/me", response_model=MerchantOut)
async def patch_me(
    body: MerchantPatch,
    merchant: Merchant = Depends(get_current_merchant),
    session: AsyncSession = Depends(get_db),
) -> MerchantOut:
    if body.eclipse_interval_ms is not None:
        if body.eclipse_interval_ms < 300_000 or body.eclipse_interval_ms > 900_000:
            raise HTTPException(400, detail={"error": "invalid_interval",
                                             "message": "Eclipse interval must be 5–15 minutes"})
        merchant.eclipse_interval_ms = body.eclipse_interval_ms
    if body.email_notifications_enabled is not None:
        merchant.email_notifications_enabled = body.email_notifications_enabled

    await session.commit()
    return await get_me(merchant)


@router.post("/start-trial", response_model=MerchantOut)
async def start_trial(
    merchant: Merchant = Depends(get_current_merchant),
    session: AsyncSession = Depends(get_db),
) -> MerchantOut:
    """Opt a FREE merchant into a 14-day RECON trial.

    Only valid from the FREE plan — a merchant already on a trial or a paid
    plan gets 409. When the trial lapses, services.trials.expire_trials() falls
    the account back to FREE (no read-only lockout).
    """
    if merchant.plan != "free":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error": "trial_not_available",
                    "message": "A trial can only be started from the free plan"},
        )
    merchant.plan = "recon"
    merchant.trial_ends_at = trial_end_at(datetime.now(timezone.utc))
    merchant.max_competitors_per_sku = plan_competitor_limit("recon")
    await session.commit()
    return await get_me(merchant)


@router.get("/shopify/oauth")
async def shopify_oauth_begin(
    shop: str = Query(..., description="Shopify store domain, e.g. mystore.myshopify.com"),
    merchant: Merchant = Depends(get_current_merchant),
) -> RedirectResponse:
    """Redirect merchant browser to Shopify OAuth consent screen."""
    if not _SHOPIFY_API_KEY or not _REDIRECT_URI:
        raise HTTPException(500, detail={"error": "config_error",
                                         "message": "Shopify OAuth is not configured"})

    nonce = uuid.uuid4().hex
    params = {
        "client_id":    _SHOPIFY_API_KEY,
        "scope":        _SCOPES,
        "redirect_uri": _REDIRECT_URI,
        "state":        nonce,
    }
    url = f"https://{shop}/admin/oauth/authorize?{urlencode(params)}"
    return RedirectResponse(url, status_code=status.HTTP_302_FOUND)


@router.get("/shopify/callback")
async def shopify_oauth_callback(
    code: str = Query(...),
    shop: str = Query(...),
    hmac_value: str = Query(..., alias="hmac"),
    state: Optional[str] = Query(None),
    merchant: Merchant = Depends(get_current_merchant),
    session: AsyncSession = Depends(get_db),
    background_tasks: BackgroundTasks = BackgroundTasks(),
) -> RedirectResponse:
    """
    Exchange OAuth code for access token, store encrypted, trigger SKU import.
    Returns a redirect to the dashboard (F1 AC#3).
    """
    # Validate HMAC
    all_params = {k: v for k, v in {
        "code": code, "shop": shop, "hmac": hmac_value, **({"state": state} if state else {})
    }.items()}
    if _SHOPIFY_API_SECRET and not _verify_shopify_hmac(all_params, hmac_value):
        raise HTTPException(400, detail={"error": "invalid_hmac",
                                         "message": "Shopify HMAC validation failed"})

    # Exchange code for access token
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            f"https://{shop}/admin/oauth/access_token",
            json={
                "client_id":     _SHOPIFY_API_KEY,
                "client_secret": _SHOPIFY_API_SECRET,
                "code":          code,
            },
        )
    if not resp.ok:
        raise HTTPException(400, detail={"error": "token_exchange_failed",
                                         "message": resp.text})

    access_token: str = resp.json()["access_token"]

    # Store encrypted token and shop domain
    merchant.shopify_domain = shop
    merchant.shopify_access_token = _encrypt(access_token)
    merchant.shopify_reconnect_required = False
    await session.commit()

    # Trigger SKU import in background (F1 AC#4)
    background_tasks.add_task(
        _import_shopify_skus,
        merchant.id,
        shop,
        access_token,
    )

    return RedirectResponse(_DASHBOARD_URL, status_code=status.HTTP_302_FOUND)


@router.post("/shopify/disconnect", status_code=status.HTTP_204_NO_CONTENT,
             response_class=Response)
async def shopify_disconnect(
    merchant: Merchant = Depends(get_current_merchant),
    session: AsyncSession = Depends(get_db),
) -> Response:
    """Clear Shopify credentials (merchant manually disconnects)."""
    merchant.shopify_domain = None
    merchant.shopify_access_token = None
    merchant.shopify_reconnect_required = False
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
