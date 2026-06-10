# SPECTER API & Scraper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy `specter-api` — FastAPI backend with all REST routes, BullMQ + Playwright scraper workers, Python signal engine, OOS alert system, auto-reprice service, Razorpay billing webhooks, and Shopify OAuth on Railway.

**Architecture:** Two processes in one Railway service: (1) FastAPI app serving REST API, (2) Node.js BullMQ workers running Playwright scrapers. Shared Supabase PostgreSQL database. Upstash Redis for job queues. Signal engine and attribution run as Python background tasks triggered by database inserts via triggers or polling.

**Tech Stack:** Python 3.11, FastAPI, SQLAlchemy 2.0, Alembic, Pydantic v2, python-jose (Clerk JWT), Razorpay Python SDK, httpx (Shopify API). Node.js 20, Playwright, BullMQ, Bright Data proxy, 2captcha, robots-parser.

---

## File Structure

```
specter-api/
├── api/
│   ├── main.py                    # FastAPI app, CORS, lifespan
│   ├── dependencies.py            # Clerk JWT auth dependency
│   ├── database.py                # SQLAlchemy engine + session
│   ├── models/
│   │   ├── __init__.py
│   │   ├── merchant.py
│   │   ├── sku.py
│   │   ├── competitor.py
│   │   ├── signal.py
│   │   └── alert.py
│   ├── schemas/
│   │   ├── merchant.py
│   │   ├── sku.py
│   │   ├── signal.py
│   │   ├── competitor.py
│   │   └── billing.py
│   ├── routers/
│   │   ├── merchants.py           # /merchants/*
│   │   ├── skus.py                # /skus/*
│   │   ├── competitors.py         # /competitors/*
│   │   ├── signals.py             # /signals/*
│   │   ├── repricing.py           # /repricing/*  (SNIPER+)
│   │   ├── alerts.py              # /alerts/*
│   │   ├── attribution.py         # /attribution/* (PREDATOR+)
│   │   └── billing.py             # /billing/webhook
│   └── services/
│       ├── signal_engine.py       # RAISE/LOWER/HOLD logic
│       ├── attribution.py         # revenue_delta calculation
│       ├── shopify.py             # OAuth + Admin API
│       └── razorpay_service.py    # Subscription management
├── scraper/                       # Node.js 20
│   ├── src/
│   │   ├── queue.ts               # BullMQ queue + job types
│   │   ├── worker.ts              # Playwright worker entrypoint
│   │   ├── scheduler.ts           # Schedules jobs by plan tier
│   │   ├── parser.ts              # Generic price/stock extractor
│   │   ├── proxy.ts               # Bright Data session manager
│   │   ├── captcha.ts             # 2captcha integration
│   │   └── domains/
│   │       ├── amazon.ts
│   │       ├── walmart.ts
│   │       └── generic.ts
│   ├── package.json
│   └── tsconfig.json
├── migrations/                    # Alembic
│   ├── env.py
│   └── versions/
├── tests/
│   ├── test_signal_engine.py
│   ├── test_attribution.py
│   └── conftest.py
├── alembic.ini
├── requirements.txt
├── Procfile                       # Railway: two processes
└── .env.example
```

---

### Task 1: Scaffold specter-api

**Files:**
- Create: `requirements.txt`, `.env.example`, `api/main.py`, `api/database.py`, `Procfile`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p specter-api/{api/{models,schemas,routers,services},scraper/src/domains,migrations/versions,tests}
cd specter-api
```

- [ ] **Step 2: Create requirements.txt**

```
fastapi==0.111.0
uvicorn[standard]==0.30.0
sqlalchemy==2.0.30
alembic==1.13.1
pydantic==2.7.1
pydantic-settings==2.2.1
python-jose[cryptography]==3.3.0
httpx==0.27.0
python-multipart==0.0.9
razorpay==1.4.1
resend==2.0.0
supabase==2.4.2
redis==5.0.4
celery==5.4.0
pytest==8.2.0
pytest-asyncio==0.23.6
httpx==0.27.0
```

```bash
pip install -r requirements.txt
```

- [ ] **Step 3: Create .env.example**

```bash
cat > .env.example << 'EOF'
DATABASE_URL=postgresql+asyncpg://postgres:password@db.xxx.supabase.co:5432/postgres
REDIS_URL=rediss://default:xxx@xxx.upstash.io:6379
CLERK_PEM_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
SHOPIFY_API_KEY=xxx
SHOPIFY_API_SECRET=xxx
SHOPIFY_APP_URL=https://specter-api.railway.app
RAZORPAY_KEY_ID=rzp_live_xxx
RAZORPAY_KEY_SECRET=xxx
RAZORPAY_WEBHOOK_SECRET=xxx
RAZORPAY_PLAN_SCOUT=plan_xxx
RAZORPAY_PLAN_SNIPER=plan_xxx
RAZORPAY_PLAN_PREDATOR=plan_xxx
RESEND_API_KEY=re_xxx
BRIGHT_DATA_HOST=brd.superproxy.io
BRIGHT_DATA_PORT=22225
BRIGHT_DATA_USERNAME=brd-customer-xxx
BRIGHT_DATA_PASSWORD=xxx
TWOCAPTCHA_API_KEY=xxx
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=xxx
FRONTEND_URL=https://specter-web.vercel.app
EOF
cp .env.example .env
```

- [ ] **Step 4: Create api/database.py**

```python
# api/database.py
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
import os

DATABASE_URL = os.environ["DATABASE_URL"]

engine = create_async_engine(DATABASE_URL, echo=False, pool_pre_ping=True)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)

class Base(DeclarativeBase):
    pass

async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session
```

- [ ] **Step 5: Create api/main.py**

```python
# api/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from api.routers import merchants, skus, competitors, signals, repricing, alerts, attribution, billing
import os

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield

app = FastAPI(title="SPECTER API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("FRONTEND_URL", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(merchants.router, prefix="/merchants", tags=["merchants"])
app.include_router(skus.router, prefix="/skus", tags=["skus"])
app.include_router(competitors.router, prefix="/competitors", tags=["competitors"])
app.include_router(signals.router, prefix="/signals", tags=["signals"])
app.include_router(repricing.router, prefix="/repricing", tags=["repricing"])
app.include_router(alerts.router, prefix="/alerts", tags=["alerts"])
app.include_router(attribution.router, prefix="/attribution", tags=["attribution"])
app.include_router(billing.router, prefix="/billing", tags=["billing"])

@app.get("/health")
async def health():
    return {"status": "ok"}
```

- [ ] **Step 6: Create Procfile for Railway**

```
web: uvicorn api.main:app --host 0.0.0.0 --port $PORT
scraper: node scraper/dist/worker.js
```

- [ ] **Step 7: Commit**

```bash
git init
git add .
git commit -m "chore: scaffold specter-api with FastAPI + project structure"
```

---

### Task 2: Database Models + Alembic Migrations

**Files:**
- Create: all files in `api/models/`, `alembic.ini`, `migrations/env.py`

- [ ] **Step 1: Create api/models/merchant.py**

```python
# api/models/merchant.py
from sqlalchemy import String, Enum, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from api.database import Base
import enum

class Plan(str, enum.Enum):
    TRIAL = "TRIAL"
    SCOUT = "SCOUT"
    SNIPER = "SNIPER"
    PREDATOR = "PREDATOR"
    APEX = "APEX"

class Merchant(Base):
    __tablename__ = "merchants"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    clerk_user_id: Mapped[str] = mapped_column(String, unique=True, index=True)
    plan: Mapped[Plan] = mapped_column(Enum(Plan), default=Plan.TRIAL)
    shopify_domain: Mapped[str | None] = mapped_column(String, nullable=True)
    shopify_access_token: Mapped[str | None] = mapped_column(String, nullable=True)
    woo_api_key: Mapped[str | None] = mapped_column(String, nullable=True)
    woo_api_secret: Mapped[str | None] = mapped_column(String, nullable=True)
    woo_store_url: Mapped[str | None] = mapped_column(String, nullable=True)
    razorpay_subscription_id: Mapped[str | None] = mapped_column(String, nullable=True)
    razorpay_customer_id: Mapped[str | None] = mapped_column(String, nullable=True)
    trial_ends_at: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())

    skus: Mapped[list["SKU"]] = relationship("SKU", back_populates="merchant")
```

- [ ] **Step 2: Create remaining models**

```python
# api/models/sku.py
from sqlalchemy import String, Numeric, ForeignKey, func, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from api.database import Base

class SKU(Base):
    __tablename__ = "skus"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    merchant_id: Mapped[str] = mapped_column(ForeignKey("merchants.id"), index=True)
    title: Mapped[str] = mapped_column(String)
    handle: Mapped[str | None] = mapped_column(String, nullable=True)
    current_price: Mapped[float] = mapped_column(Numeric(10, 2))
    floor_price: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    ceiling_price: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    shopify_variant_id: Mapped[str | None] = mapped_column(String, nullable=True)
    auto_reprice_enabled: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())

    merchant: Mapped["Merchant"] = relationship("Merchant", back_populates="skus")
    competitor_urls: Mapped[list["CompetitorURL"]] = relationship("CompetitorURL", back_populates="sku")
    signals: Mapped[list["Signal"]] = relationship("Signal", back_populates="sku")
```

```python
# api/models/competitor.py
from sqlalchemy import String, ForeignKey, Boolean, func, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from api.database import Base

class CompetitorURL(Base):
    __tablename__ = "competitor_urls"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    sku_id: Mapped[str] = mapped_column(ForeignKey("skus.id"), index=True)
    url: Mapped[str] = mapped_column(String)
    domain: Mapped[str] = mapped_column(String, index=True)
    url_path: Mapped[str] = mapped_column(String)
    last_scraped_at: Mapped[str | None] = mapped_column(String, nullable=True)
    scrape_interval_minutes: Mapped[int] = mapped_column(default=360)
    robots_blocked: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String, default="active")
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())

    sku: Mapped["SKU"] = relationship("SKU", back_populates="competitor_urls")
    price_snapshots: Mapped[list["PriceSnapshot"]] = relationship("PriceSnapshot", back_populates="competitor_url")

class PriceSnapshot(Base):
    __tablename__ = "price_snapshots"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    competitor_url_id: Mapped[str] = mapped_column(ForeignKey("competitor_urls.id"), index=True)
    price: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    in_stock: Mapped[bool] = mapped_column(Boolean, default=True)
    currency: Mapped[str] = mapped_column(String, default="USD")
    raw_storage_key: Mapped[str | None] = mapped_column(String, nullable=True)
    scraped_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())

    competitor_url: Mapped["CompetitorURL"] = relationship("CompetitorURL", back_populates="price_snapshots")
```

```python
# api/models/signal.py
from sqlalchemy import String, ForeignKey, Numeric, Text, Enum, func, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from api.database import Base
import enum

class SignalType(str, enum.Enum):
    RAISE = "RAISE"
    LOWER = "LOWER"
    HOLD = "HOLD"

class Signal(Base):
    __tablename__ = "signals"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    sku_id: Mapped[str] = mapped_column(ForeignKey("skus.id"), index=True)
    type: Mapped[SignalType] = mapped_column(Enum(SignalType))
    confidence: Mapped[float] = mapped_column(Numeric(4, 2))
    reasoning: Mapped[str] = mapped_column(Text)
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())

    sku: Mapped["SKU"] = relationship("SKU", back_populates="signals")

class PriceChange(Base):
    __tablename__ = "price_changes"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    sku_id: Mapped[str] = mapped_column(ForeignKey("skus.id"), index=True)
    signal_id: Mapped[str | None] = mapped_column(ForeignKey("signals.id"), nullable=True)
    old_price: Mapped[float] = mapped_column(Numeric(10, 2))
    new_price: Mapped[float] = mapped_column(Numeric(10, 2))
    source: Mapped[str] = mapped_column(String)  # 'manual' | 'auto'
    revenue_delta: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())
```

```python
# api/models/alert.py
from sqlalchemy import String, ForeignKey, func, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from api.database import Base

class OOSAlert(Base):
    __tablename__ = "oos_alerts"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    competitor_url_id: Mapped[str] = mapped_column(ForeignKey("competitor_urls.id"), index=True)
    sku_id: Mapped[str] = mapped_column(ForeignKey("skus.id"), index=True)
    detected_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())
    resolved_at: Mapped[str | None] = mapped_column(String, nullable=True)
    notified_at: Mapped[str | None] = mapped_column(String, nullable=True)
    silenced: Mapped[bool] = mapped_column(default=False)
```

```python
# api/models/__init__.py
from api.models.merchant import Merchant, Plan
from api.models.sku import SKU
from api.models.competitor import CompetitorURL, PriceSnapshot
from api.models.signal import Signal, SignalType, PriceChange
from api.models.alert import OOSAlert
```

- [ ] **Step 3: Set up Alembic and create initial migration**

```bash
alembic init migrations

# Edit migrations/env.py — replace the target_metadata line:
# from api.models import *  (add this import)
# from api.database import Base
# target_metadata = Base.metadata

alembic revision --autogenerate -m "initial schema"
alembic upgrade head
```

- [ ] **Step 4: Commit**

```bash
git add api/models/ migrations/ alembic.ini requirements.txt api/database.py api/main.py Procfile .env.example
git commit -m "feat: database models and initial Alembic migration"
```

---

### Task 3: Auth Middleware (Clerk JWT)

**Files:**
- Create: `api/dependencies.py`

- [ ] **Step 1: Write failing test**

```python
# tests/test_auth.py
import pytest
from httpx import AsyncClient
from api.main import app

@pytest.mark.asyncio
async def test_protected_route_without_token_returns_401():
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/signals")
    assert response.status_code == 401

@pytest.mark.asyncio
async def test_protected_route_with_invalid_token_returns_401():
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/signals", headers={"Authorization": "Bearer invalid.jwt.token"})
    assert response.status_code == 401
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
pytest tests/test_auth.py -v
# Expected: FAIL — routes don't exist yet
```

- [ ] **Step 3: Implement api/dependencies.py**

```python
# api/dependencies.py
from fastapi import HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
import os
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from api.database import get_db
from api.models.merchant import Merchant

security = HTTPBearer()
CLERK_PEM_PUBLIC_KEY = os.environ["CLERK_PEM_PUBLIC_KEY"].replace("\\n", "\n")

def verify_clerk_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, CLERK_PEM_PUBLIC_KEY, algorithms=["RS256"])
        return payload
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

async def get_current_merchant(
    payload: dict = Depends(verify_clerk_token),
    db: AsyncSession = Depends(get_db),
) -> Merchant:
    clerk_user_id = payload.get("sub")
    if not clerk_user_id:
        raise HTTPException(status_code=401, detail="Invalid token claims")
    result = await db.execute(select(Merchant).where(Merchant.clerk_user_id == clerk_user_id))
    merchant = result.scalar_one_or_none()
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found. Complete onboarding first.")
    return merchant

def require_plan(min_plan: str):
    PLAN_ORDER = ["TRIAL", "SCOUT", "SNIPER", "PREDATOR", "APEX"]
    async def check_plan(merchant: Merchant = Depends(get_current_merchant)):
        if PLAN_ORDER.index(merchant.plan.value) < PLAN_ORDER.index(min_plan):
            raise HTTPException(
                status_code=403,
                detail=f"This feature requires {min_plan} plan or above"
            )
        return merchant
    return check_plan
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
pytest tests/test_auth.py -v
```

- [ ] **Step 5: Commit**

```bash
git add api/dependencies.py tests/test_auth.py
git commit -m "feat: Clerk JWT auth middleware with plan gating"
```

---

### Task 4: Merchants + Shopify OAuth Routers

**Files:**
- Create: `api/routers/merchants.py`, `api/services/shopify.py`, `api/schemas/merchant.py`

- [ ] **Step 1: Create schemas**

```python
# api/schemas/merchant.py
from pydantic import BaseModel
from api.models.merchant import Plan

class MerchantOut(BaseModel):
    id: str
    plan: Plan
    shopify_domain: str | None
    trial_ends_at: str | None

    model_config = {"from_attributes": True}

class MerchantCreate(BaseModel):
    clerk_user_id: str
```

- [ ] **Step 2: Create Shopify service**

```python
# api/services/shopify.py
import httpx
import os
import hmac
import hashlib
from urllib.parse import urlencode

SHOPIFY_API_KEY = os.environ["SHOPIFY_API_KEY"]
SHOPIFY_API_SECRET = os.environ["SHOPIFY_API_SECRET"]
SHOPIFY_APP_URL = os.environ["SHOPIFY_APP_URL"]
SHOPIFY_SCOPES = "read_products,write_products,read_orders"

def get_oauth_url(shop: str, state: str) -> str:
    params = {
        "client_id": SHOPIFY_API_KEY,
        "scope": SHOPIFY_SCOPES,
        "redirect_uri": f"{SHOPIFY_APP_URL}/merchants/shopify/callback",
        "state": state,
    }
    return f"https://{shop}/admin/oauth/authorize?{urlencode(params)}"

async def exchange_code_for_token(shop: str, code: str) -> str:
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"https://{shop}/admin/oauth/access_token",
            json={"client_id": SHOPIFY_API_KEY, "client_secret": SHOPIFY_API_SECRET, "code": code},
        )
        resp.raise_for_status()
        return resp.json()["access_token"]

async def fetch_shopify_products(shop: str, access_token: str) -> list[dict]:
    headers = {"X-Shopify-Access-Token": access_token}
    products = []
    url = f"https://{shop}/admin/api/2024-01/products.json?limit=250"
    async with httpx.AsyncClient() as client:
        while url:
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            products.extend(data.get("products", []))
            # Handle pagination via Link header
            link_header = resp.headers.get("Link", "")
            url = None
            if 'rel="next"' in link_header:
                for part in link_header.split(","):
                    if 'rel="next"' in part:
                        url = part.split(";")[0].strip().strip("<>")
    return products

async def update_shopify_price(shop: str, access_token: str, variant_id: str, price: float) -> bool:
    headers = {"X-Shopify-Access-Token": access_token, "Content-Type": "application/json"}
    async with httpx.AsyncClient() as client:
        resp = await client.put(
            f"https://{shop}/admin/api/2024-01/variants/{variant_id}.json",
            headers=headers,
            json={"variant": {"id": variant_id, "price": str(price)}},
        )
        return resp.status_code == 200
```

- [ ] **Step 3: Create merchants router**

```python
# api/routers/merchants.py
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import uuid
import secrets
from api.database import get_db
from api.dependencies import verify_clerk_token, get_current_merchant
from api.models.merchant import Merchant
from api.models.sku import SKU
from api.schemas.merchant import MerchantOut
from api.services.shopify import get_oauth_url, exchange_code_for_token, fetch_shopify_products

router = APIRouter()

@router.post("/", response_model=MerchantOut)
async def create_merchant(
    payload: dict = Depends(verify_clerk_token),
    db: AsyncSession = Depends(get_db),
):
    clerk_user_id = payload["sub"]
    existing = await db.execute(select(Merchant).where(Merchant.clerk_user_id == clerk_user_id))
    if existing.scalar_one_or_none():
        raise HTTPException(400, "Merchant already exists")
    from datetime import datetime, timedelta
    trial_ends = (datetime.utcnow() + timedelta(days=14)).isoformat()
    merchant = Merchant(id=str(uuid.uuid4()), clerk_user_id=clerk_user_id, trial_ends_at=trial_ends)
    db.add(merchant)
    await db.commit()
    await db.refresh(merchant)
    return merchant

@router.get("/me", response_model=MerchantOut)
async def get_me(merchant: Merchant = Depends(get_current_merchant)):
    return merchant

@router.get("/shopify/oauth-start")
async def shopify_oauth_start(
    shop: str = Query(...),
    merchant: Merchant = Depends(get_current_merchant),
):
    state = secrets.token_urlsafe(16)
    # In production: store state in Redis with TTL for CSRF protection
    return RedirectResponse(get_oauth_url(shop, state))

@router.get("/shopify/callback")
async def shopify_oauth_callback(
    shop: str = Query(...),
    code: str = Query(...),
    state: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    access_token = await exchange_code_for_token(shop, code)
    result = await db.execute(select(Merchant).where(Merchant.shopify_domain == shop))
    merchant = result.scalar_one_or_none()
    if not merchant:
        raise HTTPException(404, "Merchant not found")
    merchant.shopify_access_token = access_token
    merchant.shopify_domain = shop
    await db.commit()

    # Import SKUs in background
    products = await fetch_shopify_products(shop, access_token)
    for product in products:
        for variant in product.get("variants", []):
            existing_sku = await db.execute(
                select(SKU).where(SKU.shopify_variant_id == str(variant["id"]))
            )
            if not existing_sku.scalar_one_or_none():
                sku = SKU(
                    id=str(uuid.uuid4()),
                    merchant_id=merchant.id,
                    title=f"{product['title']} - {variant.get('title', 'Default')}",
                    handle=product.get("handle"),
                    current_price=float(variant.get("price", 0)),
                    shopify_variant_id=str(variant["id"]),
                )
                db.add(sku)
    await db.commit()
    return RedirectResponse(f"{os.environ.get('FRONTEND_URL', 'http://localhost:3000')}/settings?shopify=connected")
```

- [ ] **Step 4: Commit**

```bash
git add api/routers/merchants.py api/services/shopify.py api/schemas/
git commit -m "feat: merchants router + Shopify OAuth flow + SKU import"
```

---

### Task 5: Core API Routers (SKUs, Competitors, Signals, Alerts)

**Files:**
- Create: `api/routers/skus.py`, `competitors.py`, `signals.py`, `alerts.py`

- [ ] **Step 1: Create skus.py**

```python
# api/routers/skus.py
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from api.database import get_db
from api.dependencies import get_current_merchant
from api.models.merchant import Merchant
from api.models.sku import SKU
from pydantic import BaseModel

router = APIRouter()

class SKUOut(BaseModel):
    id: str
    title: str
    current_price: float
    floor_price: float | None
    ceiling_price: float | None
    auto_reprice_enabled: bool
    model_config = {"from_attributes": True}

class SKUUpdate(BaseModel):
    floor_price: float | None = None
    ceiling_price: float | None = None
    auto_reprice_enabled: bool | None = None

@router.get("/", response_model=list[SKUOut])
async def list_skus(merchant: Merchant = Depends(get_current_merchant), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SKU).where(SKU.merchant_id == merchant.id))
    return result.scalars().all()

@router.patch("/{sku_id}", response_model=SKUOut)
async def update_sku(
    sku_id: str,
    data: SKUUpdate,
    merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(SKU).where(SKU.id == sku_id, SKU.merchant_id == merchant.id))
    sku = result.scalar_one_or_none()
    if not sku:
        from fastapi import HTTPException
        raise HTTPException(404, "SKU not found")
    if data.floor_price is not None:
        sku.floor_price = data.floor_price
    if data.ceiling_price is not None:
        sku.ceiling_price = data.ceiling_price
    if data.auto_reprice_enabled is not None:
        sku.auto_reprice_enabled = data.auto_reprice_enabled
    await db.commit()
    await db.refresh(sku)
    return sku
```

- [ ] **Step 2: Create competitors.py**

```python
# api/routers/competitors.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from urllib.parse import urlparse
import uuid
from api.database import get_db
from api.dependencies import get_current_merchant
from api.models.merchant import Merchant, Plan
from api.models.competitor import CompetitorURL
from pydantic import BaseModel, HttpUrl

router = APIRouter()

SKU_LIMITS = {Plan.TRIAL: 10, Plan.SCOUT: 50, Plan.SNIPER: 200, Plan.PREDATOR: 500, Plan.APEX: 99999}
REFRESH_INTERVALS = {Plan.TRIAL: 360, Plan.SCOUT: 360, Plan.SNIPER: 60, Plan.PREDATOR: 15, Plan.APEX: 5}

class CompetitorCreate(BaseModel):
    url: str
    sku_id: str

class CompetitorOut(BaseModel):
    id: str
    url: str
    domain: str
    sku_id: str
    status: str
    last_scraped_at: str | None
    model_config = {"from_attributes": True}

@router.get("/", response_model=list[CompetitorOut])
async def list_competitors(merchant: Merchant = Depends(get_current_merchant), db: AsyncSession = Depends(get_db)):
    # Join with skus to filter by merchant
    from api.models.sku import SKU
    result = await db.execute(
        select(CompetitorURL).join(SKU).where(SKU.merchant_id == merchant.id)
    )
    return result.scalars().all()

@router.post("/", response_model=CompetitorOut)
async def add_competitor(
    data: CompetitorCreate,
    merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
):
    from api.models.sku import SKU
    # Verify SKU belongs to merchant
    sku_result = await db.execute(select(SKU).where(SKU.id == data.sku_id, SKU.merchant_id == merchant.id))
    if not sku_result.scalar_one_or_none():
        raise HTTPException(404, "SKU not found")

    parsed = urlparse(data.url)
    domain = parsed.netloc.replace("www.", "")
    url_path = parsed.path

    competitor = CompetitorURL(
        id=str(uuid.uuid4()),
        sku_id=data.sku_id,
        url=data.url,
        domain=domain,
        url_path=url_path,
        scrape_interval_minutes=REFRESH_INTERVALS[merchant.plan],
    )
    db.add(competitor)
    await db.commit()
    await db.refresh(competitor)

    # Queue immediate first scrape (fire and forget)
    # This calls the BullMQ queue via Redis directly
    import json, redis.asyncio as aioredis, os
    r = await aioredis.from_url(os.environ["REDIS_URL"])
    job_data = json.dumps({"url": data.url, "domain": domain, "urlPath": url_path, "competitorUrlIds": [competitor.id]})
    await r.lpush("bull:scrape:wait", job_data)
    await r.aclose()

    return competitor

@router.delete("/{competitor_id}", status_code=204)
async def delete_competitor(
    competitor_id: str,
    merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
):
    from api.models.sku import SKU
    result = await db.execute(
        select(CompetitorURL).join(SKU).where(CompetitorURL.id == competitor_id, SKU.merchant_id == merchant.id)
    )
    competitor = result.scalar_one_or_none()
    if not competitor:
        raise HTTPException(404, "Competitor URL not found")
    competitor.status = "deleted"
    await db.commit()
```

- [ ] **Step 3: Create signals.py**

```python
# api/routers/signals.py
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from api.database import get_db
from api.dependencies import get_current_merchant
from api.models.merchant import Merchant
from api.models.signal import Signal
from api.models.sku import SKU
from pydantic import BaseModel

router = APIRouter()

class SignalOut(BaseModel):
    id: str
    sku_id: str
    sku_title: str
    type: str
    confidence: float
    reasoning: str
    created_at: str
    model_config = {"from_attributes": True}

@router.get("/")
async def list_signals(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    signal_type: str | None = Query(None),
    merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(Signal, SKU.title.label("sku_title"))
        .join(SKU)
        .where(SKU.merchant_id == merchant.id)
        .order_by(desc(Signal.created_at))
    )
    if signal_type:
        query = query.where(Signal.type == signal_type)
    offset = (page - 1) * limit
    result = await db.execute(query.offset(offset).limit(limit))
    rows = result.all()

    signals = []
    for signal, sku_title in rows:
        signals.append({
            "id": signal.id,
            "sku_id": signal.sku_id,
            "sku_title": sku_title,
            "type": signal.type.value,
            "confidence": float(signal.confidence),
            "reasoning": signal.reasoning,
            "created_at": signal.created_at.isoformat(),
        })

    count_result = await db.execute(
        select(Signal).join(SKU).where(SKU.merchant_id == merchant.id)
    )
    total = len(count_result.all())

    return {"signals": signals, "total": total, "page": page}
```

- [ ] **Step 4: Create alerts.py**

```python
# api/routers/alerts.py
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from api.database import get_db
from api.dependencies import get_current_merchant
from api.models.merchant import Merchant
from api.models.alert import OOSAlert
from api.models.sku import SKU
from api.models.competitor import CompetitorURL

router = APIRouter()

@router.get("/")
async def list_alerts(merchant: Merchant = Depends(get_current_merchant), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(OOSAlert, SKU.title.label("sku_title"), CompetitorURL.url.label("competitor_url"))
        .join(SKU)
        .join(CompetitorURL)
        .where(SKU.merchant_id == merchant.id)
        .where(OOSAlert.silenced == False)
        .order_by(desc(OOSAlert.detected_at))
        .limit(50)
    )
    rows = result.all()
    return [
        {
            "id": alert.id,
            "sku_title": sku_title,
            "competitor_url": competitor_url,
            "detected_at": alert.detected_at.isoformat(),
            "resolved_at": alert.resolved_at,
        }
        for alert, sku_title, competitor_url in rows
    ]
```

- [ ] **Step 5: Commit**

```bash
git add api/routers/
git commit -m "feat: skus, competitors, signals, alerts routers"
```

---

### Task 6: Signal Engine

**Files:**
- Create: `api/services/signal_engine.py`
- Create: `tests/test_signal_engine.py`

- [ ] **Step 1: Write failing tests**

```python
# tests/test_signal_engine.py
import pytest
from api.services.signal_engine import compute_signal

def test_raise_when_competitor_higher_and_in_stock():
    result = compute_signal(
        merchant_price=50.0,
        competitor_snapshots=[
            {"price": 60.0, "in_stock": True},
            {"price": 65.0, "in_stock": True},
        ]
    )
    assert result["type"] == "RAISE"
    assert result["confidence"] > 0.5

def test_lower_when_merchant_5pct_above_median():
    result = compute_signal(
        merchant_price=100.0,
        competitor_snapshots=[
            {"price": 88.0, "in_stock": True},
            {"price": 90.0, "in_stock": True},
            {"price": 92.0, "in_stock": True},
        ]
    )
    # median = 90, gap = 11.1% → LOWER
    assert result["type"] == "LOWER"

def test_hold_within_2pct():
    result = compute_signal(
        merchant_price=100.0,
        competitor_snapshots=[
            {"price": 99.0, "in_stock": True},
            {"price": 101.0, "in_stock": True},
        ]
    )
    # median = 100, gap = 0% → HOLD
    assert result["type"] == "HOLD"

def test_hold_when_all_competitors_oos():
    result = compute_signal(
        merchant_price=50.0,
        competitor_snapshots=[
            {"price": 60.0, "in_stock": False},
            {"price": 55.0, "in_stock": False},
        ]
    )
    assert result["type"] == "HOLD"
    assert "out of stock" in result["reasoning"].lower()

def test_confidence_lower_with_one_data_point():
    result_one = compute_signal(50.0, [{"price": 60.0, "in_stock": True}])
    result_many = compute_signal(50.0, [{"price": 60.0, "in_stock": True}] * 5)
    assert result_one["confidence"] <= 0.6
    assert result_many["confidence"] > result_one["confidence"]
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
pytest tests/test_signal_engine.py -v
# Expected: FAIL — ImportError: cannot import 'compute_signal'
```

- [ ] **Step 3: Implement signal_engine.py**

```python
# api/services/signal_engine.py
import statistics

def compute_signal(merchant_price: float, competitor_snapshots: list[dict]) -> dict:
    in_stock_snapshots = [s for s in competitor_snapshots if s.get("in_stock") and s.get("price")]
    
    if not in_stock_snapshots:
        return {
            "type": "HOLD",
            "confidence": round(0.4 + min(len(competitor_snapshots), 5) * 0.04, 2),
            "reasoning": f"All {len(competitor_snapshots)} tracked competitor(s) are out of stock — insufficient market data to signal direction.",
        }

    prices = [s["price"] for s in in_stock_snapshots]
    median_price = statistics.median(prices)
    gap_pct = ((merchant_price - median_price) / median_price) * 100 if median_price > 0 else 0

    # Confidence: more data points = higher confidence, capped at 0.97
    data_confidence = min(0.97, 0.5 + len(in_stock_snapshots) * 0.08)

    if gap_pct < -5:  # Merchant priced below market
        return {
            "type": "RAISE",
            "confidence": round(data_confidence * min(1.0, abs(gap_pct) / 20), 2),
            "reasoning": (
                f"Your price (${merchant_price:.2f}) is {abs(gap_pct):.1f}% below the median competitor price "
                f"(${median_price:.2f}) based on {len(in_stock_snapshots)} in-stock competitor(s). "
                f"Raising to ${median_price - 0.01:.2f} would recover margin without losing the competitive edge."
            ),
        }
    elif gap_pct > 5:  # Merchant priced above market
        return {
            "type": "LOWER",
            "confidence": round(data_confidence * min(1.0, gap_pct / 20), 2),
            "reasoning": (
                f"Your price (${merchant_price:.2f}) is {gap_pct:.1f}% above the median competitor price "
                f"(${median_price:.2f}) based on {len(in_stock_snapshots)} in-stock competitor(s). "
                f"You may be losing sales velocity. Consider pricing closer to ${median_price:.2f}."
            ),
        }
    else:
        return {
            "type": "HOLD",
            "confidence": round(data_confidence, 2),
            "reasoning": (
                f"Your price (${merchant_price:.2f}) is within {gap_pct:.1f}% of the median competitor price "
                f"(${median_price:.2f}). Competitively positioned — no action needed."
            ),
        }
```

- [ ] **Step 4: Run tests — expect all PASS**

```bash
pytest tests/test_signal_engine.py -v
# Expected: PASS (5 tests)
```

- [ ] **Step 5: Create signal runner (called after each price_snapshot insert)**

```python
# api/services/signal_runner.py
import uuid
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from api.models.competitor import CompetitorURL, PriceSnapshot
from api.models.signal import Signal
from api.models.sku import SKU
from api.services.signal_engine import compute_signal

SIGNAL_DEDUP_HOURS = 1

async def run_signals_for_sku(sku_id: str, db: AsyncSession):
    # Get all competitor URLs for this SKU
    urls_result = await db.execute(
        select(CompetitorURL).where(CompetitorURL.sku_id == sku_id, CompetitorURL.status == "active")
    )
    urls = urls_result.scalars().all()

    # Get latest snapshot for each URL
    snapshots = []
    for url in urls:
        snap_result = await db.execute(
            select(PriceSnapshot)
            .where(PriceSnapshot.competitor_url_id == url.id)
            .order_by(desc(PriceSnapshot.scraped_at))
            .limit(1)
        )
        snap = snap_result.scalar_one_or_none()
        if snap:
            snapshots.append({"price": float(snap.price) if snap.price else None, "in_stock": snap.in_stock})

    if not snapshots:
        return

    sku_result = await db.execute(select(SKU).where(SKU.id == sku_id))
    sku = sku_result.scalar_one_or_none()
    if not sku:
        return

    # Dedup: skip if same signal type emitted in last hour
    dedup_cutoff = datetime.utcnow() - timedelta(hours=SIGNAL_DEDUP_HOURS)
    recent_result = await db.execute(
        select(Signal)
        .where(Signal.sku_id == sku_id, Signal.created_at >= dedup_cutoff)
        .order_by(desc(Signal.created_at))
        .limit(1)
    )
    recent = recent_result.scalar_one_or_none()

    result = compute_signal(float(sku.current_price), snapshots)

    if recent and recent.type.value == result["type"]:
        return  # Same signal — skip

    signal = Signal(
        id=str(uuid.uuid4()),
        sku_id=sku_id,
        type=result["type"],
        confidence=result["confidence"],
        reasoning=result["reasoning"],
    )
    db.add(signal)
    await db.commit()
```

- [ ] **Step 6: Commit**

```bash
git add api/services/signal_engine.py api/services/signal_runner.py tests/test_signal_engine.py
git commit -m "feat: signal engine with RAISE/LOWER/HOLD logic and dedup"
```

---

### Task 7: BullMQ Scraper (Node.js)

**Files:**
- Create: `scraper/package.json`, `scraper/src/queue.ts`, `worker.ts`, `parser.ts`, `proxy.ts`, `domains/generic.ts`, `domains/amazon.ts`

- [ ] **Step 1: Scaffold scraper Node.js project**

```bash
cd scraper
cat > package.json << 'EOF'
{
  "name": "specter-scraper",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "start": "node dist/worker.js",
    "dev": "tsx watch src/worker.ts"
  },
  "dependencies": {
    "bullmq": "^5.4.0",
    "playwright": "^1.44.0",
    "robots-parser": "^3.0.1",
    "node-fetch": "^3.3.2",
    "ioredis": "^5.3.2"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.4.0",
    "tsx": "^4.0.0"
  }
}
EOF

npm install
npx playwright install chromium
```

```json
// scraper/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 2: Create queue.ts**

```typescript
// scraper/src/queue.ts
import { Queue, Worker, QueueEvents } from 'bullmq'
import IORedis from 'ioredis'

export const connection = new IORedis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
  tls: process.env.REDIS_URL?.includes('rediss') ? {} : undefined,
})

export type ScrapeJob = {
  url: string
  domain: string
  urlPath: string
  competitorUrlIds: string[]
}

export const scrapeQueue = new Queue<ScrapeJob>('scrape', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 60_000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  },
})
```

- [ ] **Step 3: Create proxy.ts**

```typescript
// scraper/src/proxy.ts
export function getBrightDataProxy(): { server: string; username: string; password: string } {
  const host = process.env.BRIGHT_DATA_HOST!
  const port = process.env.BRIGHT_DATA_PORT!
  const username = process.env.BRIGHT_DATA_USERNAME!
  const password = process.env.BRIGHT_DATA_PASSWORD!
  // Rotate session per job
  const sessionId = Math.random().toString(36).slice(2, 10)
  return {
    server: `http://${host}:${port}`,
    username: `${username}-session-${sessionId}`,
    password,
  }
}
```

- [ ] **Step 4: Create domains/generic.ts**

```typescript
// scraper/src/domains/generic.ts
import type { Page } from 'playwright'

export interface ParseResult {
  price: number | null
  inStock: boolean
  currency: string
  title: string | null
}

export async function parse(page: Page): Promise<ParseResult> {
  // Try JSON-LD schema.org/Product first
  const jsonLdResult = await page.evaluate(() => {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]')
    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent || '')
        if (data['@type'] === 'Product' || data['@type'] === 'Offer') {
          const offer = data.offers || data
          const price = parseFloat(offer.price || offer.lowPrice)
          const inStock = (offer.availability || '').includes('InStock')
          return { price: isNaN(price) ? null : price, inStock, currency: offer.priceCurrency || 'USD', title: data.name || null }
        }
      } catch {}
    }
    return null
  })
  if (jsonLdResult?.price) return jsonLdResult

  // Try Open Graph / meta tags
  const metaResult = await page.evaluate(() => {
    const price = document.querySelector('meta[property="product:price:amount"]')?.getAttribute('content')
    const currency = document.querySelector('meta[property="product:price:currency"]')?.getAttribute('content')
    const title = document.querySelector('meta[property="og:title"]')?.getAttribute('content')
    const availability = document.querySelector('meta[property="product:availability"]')?.getAttribute('content')
    return {
      price: price ? parseFloat(price) : null,
      inStock: availability !== 'oos' && availability !== 'out of stock',
      currency: currency || 'USD',
      title: title || null,
    }
  })
  if (metaResult.price) return metaResult

  // Common CSS selectors fallback
  const selectorResult = await page.evaluate(() => {
    const priceSelectors = ['[data-price]', '.price', '#price', '[itemprop="price"]', '.product-price', '.sale-price']
    const stockSelectors = ['.in-stock', '.out-of-stock', '[data-availability]', '[itemprop="availability"]']
    
    let price: number | null = null
    for (const sel of priceSelectors) {
      const el = document.querySelector(sel)
      if (el) {
        const text = el.getAttribute('data-price') || el.textContent || ''
        const num = parseFloat(text.replace(/[^0-9.]/g, ''))
        if (!isNaN(num)) { price = num; break }
      }
    }
    
    let inStock = true
    for (const sel of stockSelectors) {
      const el = document.querySelector(sel)
      if (el) {
        const text = (el.textContent || el.getAttribute('data-availability') || '').toLowerCase()
        if (text.includes('out of stock') || text.includes('unavailable') || text.includes('sold out')) {
          inStock = false
        }
        break
      }
    }

    return { price, inStock, currency: 'USD', title: document.title || null }
  })
  return selectorResult
}
```

- [ ] **Step 5: Create worker.ts**

```typescript
// scraper/src/worker.ts
import { Worker } from 'bullmq'
import { chromium } from 'playwright'
import { connection, type ScrapeJob } from './queue.js'
import { parse } from './parser.js'
import { getBrightDataProxy } from './proxy.js'

const SPECTER_API_URL = process.env.SPECTER_API_URL || 'http://localhost:8000'
const INTERNAL_SECRET = process.env.INTERNAL_SECRET || 'dev-secret'

const worker = new Worker<ScrapeJob>(
  'scrape',
  async (job) => {
    const { url, domain, urlPath, competitorUrlIds } = job.data
    const proxy = getBrightDataProxy()

    const browser = await chromium.launch({
      headless: true,
      proxy: { server: proxy.server, username: proxy.username, password: proxy.password },
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })

    let result
    try {
      const page = await browser.newPage()
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })
      
      // Check for CAPTCHA
      const isCaptcha = await page.evaluate(() => 
        document.title.toLowerCase().includes('captcha') || 
        !!document.querySelector('.g-recaptcha, #captcha, [data-captcha]')
      )
      if (isCaptcha) {
        throw new Error('CAPTCHA_DETECTED')
      }

      result = await parse(page)
    } finally {
      await browser.close()
    }

    // Post snapshot to specter-api internal endpoint
    await fetch(`${SPECTER_API_URL}/internal/snapshots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': INTERNAL_SECRET },
      body: JSON.stringify({
        competitorUrlIds,
        price: result.price,
        inStock: result.inStock,
        currency: result.currency,
      }),
    })
  },
  {
    connection,
    concurrency: 3,
    autorun: true,
  }
)

worker.on('failed', async (job, err) => {
  console.error(`Job ${job?.id} failed:`, err.message)
  if (job && job.attemptsMade >= 3) {
    // Notify API of permanent failure
    await fetch(`${SPECTER_API_URL}/internal/scrape-failed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': INTERNAL_SECRET },
      body: JSON.stringify({ competitorUrlIds: job.data.competitorUrlIds, error: err.message }),
    }).catch(() => {})
  }
})

console.log('SPECTER scraper worker started')
```

- [ ] **Step 6: Create internal snapshot endpoint in specter-api**

```python
# api/routers/internal.py — add to main.py router includes
from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import uuid, os
from api.database import get_db
from api.models.competitor import CompetitorURL, PriceSnapshot
from api.models.sku import SKU
from api.models.alert import OOSAlert
from api.services.signal_runner import run_signals_for_sku
from pydantic import BaseModel

router = APIRouter()
INTERNAL_SECRET = os.environ.get("INTERNAL_SECRET", "dev-secret")

class SnapshotIn(BaseModel):
    competitorUrlIds: list[str]
    price: float | None
    inStock: bool
    currency: str = "USD"

def verify_internal(x_internal_secret: str = Header()):
    if x_internal_secret != INTERNAL_SECRET:
        raise HTTPException(403, "Forbidden")

@router.post("/snapshots")
async def ingest_snapshots(
    data: SnapshotIn,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_internal),
):
    sku_ids_to_signal = set()

    for url_id in data.competitorUrlIds:
        # Get previous snapshot to detect OOS transition
        prev_result = await db.execute(
            select(PriceSnapshot)
            .where(PriceSnapshot.competitor_url_id == url_id)
            .order_by(PriceSnapshot.scraped_at.desc())
            .limit(1)
        )
        prev = prev_result.scalar_one_or_none()
        was_in_stock = prev.in_stock if prev else True

        # Insert new snapshot
        snap = PriceSnapshot(
            id=str(uuid.uuid4()),
            competitor_url_id=url_id,
            price=data.price,
            in_stock=data.inStock,
            currency=data.currency,
        )
        db.add(snap)

        # Detect OOS transition
        if was_in_stock and not data.inStock:
            url_result = await db.execute(select(CompetitorURL).where(CompetitorURL.id == url_id))
            url = url_result.scalar_one_or_none()
            if url:
                existing_alert = await db.execute(
                    select(OOSAlert).where(
                        OOSAlert.competitor_url_id == url_id,
                        OOSAlert.resolved_at.is_(None)
                    )
                )
                if not existing_alert.scalar_one_or_none():
                    alert = OOSAlert(id=str(uuid.uuid4()), competitor_url_id=url_id, sku_id=url.sku_id)
                    db.add(alert)
                    sku_ids_to_signal.add(url.sku_id)
                    # Send email notification (fire and forget)
                    from api.services.notifications import send_oos_alert
                    await send_oos_alert(url.sku_id, url.url, db)
        
        # Detect restock
        if not was_in_stock and data.inStock:
            await db.execute(
                select(OOSAlert).where(OOSAlert.competitor_url_id == url_id, OOSAlert.resolved_at.is_(None))
            )
            # Update resolved_at
            from datetime import datetime
            await db.execute(
                OOSAlert.__table__.update()
                .where(OOSAlert.competitor_url_id == url_id, OOSAlert.resolved_at.is_(None))
                .values(resolved_at=datetime.utcnow().isoformat())
            )

        url_result = await db.execute(select(CompetitorURL).where(CompetitorURL.id == url_id))
        url = url_result.scalar_one_or_none()
        if url:
            sku_ids_to_signal.add(url.sku_id)

    await db.commit()

    # Run signal engine for affected SKUs
    for sku_id in sku_ids_to_signal:
        await run_signals_for_sku(sku_id, db)

    return {"ok": True}
```

- [ ] **Step 7: Commit**

```bash
git add scraper/ api/routers/internal.py
git commit -m "feat: BullMQ scraper workers + internal snapshot ingestion endpoint"
```

---

### Task 8: OOS Alert Notifications + Repricing + Attribution + Billing

**Files:**
- Create: `api/services/notifications.py`, `api/routers/repricing.py`, `api/routers/attribution.py`, `api/routers/billing.py`

- [ ] **Step 1: Create notifications service**

```python
# api/services/notifications.py
import resend
import os
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from api.models.sku import SKU
from api.models.merchant import Merchant

resend.api_key = os.environ.get("RESEND_API_KEY", "")

async def send_oos_alert(sku_id: str, competitor_url: str, db: AsyncSession):
    sku_result = await db.execute(select(SKU).where(SKU.id == sku_id))
    sku = sku_result.scalar_one_or_none()
    if not sku:
        return

    merchant_result = await db.execute(select(Merchant).where(Merchant.id == sku.merchant_id))
    merchant = merchant_result.scalar_one_or_none()
    if not merchant:
        return

    # In production: get user email from Clerk API using clerk_user_id
    # For now, use a placeholder
    try:
        resend.Emails.send({
            "from": "alerts@specter.io",
            "to": ["merchant@example.com"],  # Replace with Clerk user email lookup
            "subject": f"⚡ OOS Alert: Competitor out of stock for {sku.title}",
            "html": f"""
                <h2>Competitor Out of Stock Detected</h2>
                <p>A competitor tracking <strong>{sku.title}</strong> has gone out of stock.</p>
                <p><strong>URL:</strong> {competitor_url}</p>
                <p>This is your window to raise prices for the next 2–7 days while they restock.</p>
                <a href="{os.environ.get('FRONTEND_URL')}/repricing" style="background:#00E87A;color:#06070D;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">
                    Raise Prices Now
                </a>
            """,
        })
    except Exception as e:
        print(f"Email send failed: {e}")
```

- [ ] **Step 2: Create repricing router (SNIPER+)**

```python
# api/routers/repricing.py
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from api.database import get_db
from api.dependencies import require_plan
from api.models.merchant import Merchant
from api.models.sku import SKU
from api.models.signal import Signal, PriceChange
from api.services.shopify import update_shopify_price
import uuid
from pydantic import BaseModel

router = APIRouter()

class RepriceRule(BaseModel):
    sku_id: str
    floor_price: float
    ceiling_price: float
    auto_reprice_enabled: bool

@router.post("/apply/{sku_id}")
async def apply_reprice(
    sku_id: str,
    new_price: float,
    merchant: Merchant = Depends(require_plan("SNIPER")),
    db: AsyncSession = Depends(get_db),
):
    sku_result = await db.execute(select(SKU).where(SKU.id == sku_id, SKU.merchant_id == merchant.id))
    sku = sku_result.scalar_one_or_none()
    if not sku:
        from fastapi import HTTPException
        raise HTTPException(404, "SKU not found")

    # Clamp to floor/ceiling
    if sku.floor_price and new_price < float(sku.floor_price):
        new_price = float(sku.floor_price)
    if sku.ceiling_price and new_price > float(sku.ceiling_price):
        new_price = float(sku.ceiling_price)

    old_price = float(sku.current_price)

    # Apply via Shopify API if connected
    if merchant.shopify_domain and merchant.shopify_access_token and sku.shopify_variant_id:
        success = await update_shopify_price(
            merchant.shopify_domain, merchant.shopify_access_token,
            sku.shopify_variant_id, new_price
        )
        if not success:
            from fastapi import HTTPException
            raise HTTPException(502, "Shopify price update failed")

    # Record price change
    sku.current_price = new_price
    change = PriceChange(
        id=str(uuid.uuid4()),
        sku_id=sku_id,
        old_price=old_price,
        new_price=new_price,
        source="manual",
    )
    db.add(change)
    await db.commit()
    return {"ok": True, "new_price": new_price}
```

- [ ] **Step 3: Create attribution router (PREDATOR+)**

```python
# api/routers/attribution.py
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
from api.database import get_db
from api.dependencies import require_plan
from api.models.merchant import Merchant
from api.models.signal import PriceChange
from api.models.sku import SKU

router = APIRouter()

@router.get("/")
async def get_attribution(
    merchant: Merchant = Depends(require_plan("PREDATOR")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PriceChange, SKU.title.label("sku_title"))
        .join(SKU)
        .where(SKU.merchant_id == merchant.id, PriceChange.revenue_delta.isnot(None))
        .order_by(desc(PriceChange.created_at))
        .limit(100)
    )
    rows = result.all()
    changes = [
        {
            "id": pc.id,
            "sku_title": sku_title,
            "old_price": float(pc.old_price),
            "new_price": float(pc.new_price),
            "source": pc.source,
            "revenue_delta": float(pc.revenue_delta),
            "created_at": pc.created_at.isoformat(),
        }
        for pc, sku_title in rows
    ]
    total_recovered = sum(c["revenue_delta"] for c in changes if c["revenue_delta"] > 0)
    return {"changes": changes, "total_recovered": total_recovered}
```

- [ ] **Step 4: Create billing router (Razorpay webhooks)**

```python
# api/routers/billing.py
from fastapi import APIRouter, Request, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from api.database import get_db
from fastapi import Depends
from api.models.merchant import Merchant, Plan
import hmac, hashlib, os, json

router = APIRouter()

PLAN_MAP = {
    os.environ.get("RAZORPAY_PLAN_SCOUT", ""): Plan.SCOUT,
    os.environ.get("RAZORPAY_PLAN_SNIPER", ""): Plan.SNIPER,
    os.environ.get("RAZORPAY_PLAN_PREDATOR", ""): Plan.PREDATOR,
}

@router.post("/webhook")
async def razorpay_webhook(
    request: Request,
    x_razorpay_signature: str = Header(),
    db: AsyncSession = Depends(get_db),
):
    body = await request.body()
    secret = os.environ["RAZORPAY_WEBHOOK_SECRET"]
    
    # Verify webhook signature
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, x_razorpay_signature):
        raise HTTPException(400, "Invalid webhook signature")

    payload = json.loads(body)
    event = payload.get("event")

    if event == "subscription.activated":
        subscription = payload["payload"]["subscription"]["entity"]
        sub_id = subscription["id"]
        plan_id = subscription.get("plan_id", "")
        new_plan = PLAN_MAP.get(plan_id, Plan.SCOUT)

        result = await db.execute(select(Merchant).where(Merchant.razorpay_subscription_id == sub_id))
        merchant = result.scalar_one_or_none()
        if merchant:
            merchant.plan = new_plan
            await db.commit()

    elif event == "subscription.cancelled" or event == "subscription.expired":
        subscription = payload["payload"]["subscription"]["entity"]
        sub_id = subscription["id"]
        result = await db.execute(select(Merchant).where(Merchant.razorpay_subscription_id == sub_id))
        merchant = result.scalar_one_or_none()
        if merchant:
            merchant.plan = Plan.TRIAL  # Downgrade to read-only
            await db.commit()

    return {"status": "ok"}
```

- [ ] **Step 5: Commit**

```bash
git add api/services/notifications.py api/routers/repricing.py api/routers/attribution.py api/routers/billing.py
git commit -m "feat: OOS notifications, repricing, attribution, Razorpay billing webhook"
```

---

### Task 9: Deploy to Railway

- [ ] **Step 1: Push to GitHub**

```bash
git remote add origin https://github.com/AnshulBaghel05/specter-api.git
git push -u origin master
```

- [ ] **Step 2: Create Railway project**

1. Go to railway.app → New Project → Deploy from GitHub → `specter-api`
2. Add Procfile services: Railway auto-detects `web` and `scraper` processes
3. Add all environment variables from `.env.example` with real values
4. Add Upstash Redis: Railway dashboard → New → Upstash Redis plugin

- [ ] **Step 3: Run Alembic migrations on Railway**

```bash
# In Railway dashboard → specter-api service → Shell:
alembic upgrade head
```

- [ ] **Step 4: Verify health endpoint**

```bash
curl https://specter-api.railway.app/health
# Expected: {"status":"ok"}
```

- [ ] **Step 5: Test auth endpoint**

```bash
curl -H "Authorization: Bearer INVALID" https://specter-api.railway.app/signals
# Expected: {"detail":"Invalid or expired token"}
```

- [ ] **Step 6: Update specter-web NEXT_PUBLIC_API_URL**

In Vercel dashboard → specter-web → Environment Variables:
```
NEXT_PUBLIC_API_URL=https://specter-api.railway.app
```

Trigger a redeploy.
