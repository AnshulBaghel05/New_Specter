# Prompt 2: Database Schema & Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement all 8 SPECTER database tables as SQLAlchemy 2.0 async models, configure Alembic migrations, wire async DB sessions and Upstash Redis, and produce a Supabase SQL migration file with RLS enabled on all tables.

**Architecture:** Eight SQLAlchemy 2.0 `DeclarativeBase` models share a common `Base` with UUID PK + `created_at`. Alembic manages schema migrations via an async engine; a separate hand-written Supabase SQL file enables RLS and service-role policies. `db.py` exposes `get_db()` as a FastAPI dependency; `redis_client.py` exposes a single `redis` instance.

**Tech Stack:** Python 3.13, SQLAlchemy 2.0 (`asyncpg` driver), Alembic 1.13, redis-py (`redis[hiredis]`), pytest, Supabase PostgreSQL 15.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `specter-api/pyproject.toml` | Modify | Add `asyncpg` + `redis[hiredis]` deps |
| `specter-api/requirements.txt` | Regenerate | Pinned deps for Railway |
| `specter-api/models/base.py` | Create | `DeclarativeBase` with UUID PK + `created_at` |
| `specter-api/models/merchants.py` | Create | Merchant model |
| `specter-api/models/skus.py` | Create | SKU model |
| `specter-api/models/competitor_urls.py` | Create | CompetitorURL model |
| `specter-api/models/price_snapshots.py` | Create | PriceSnapshot model |
| `specter-api/models/signals.py` | Create | Signal model |
| `specter-api/models/oos_alerts.py` | Create | OOSAlert model |
| `specter-api/models/price_changes.py` | Create | PriceChange model |
| `specter-api/models/merchant_addons.py` | Create | MerchantAddon model |
| `specter-api/models/__init__.py` | Create | Export all 8 models |
| `specter-api/db.py` | Create | Async engine + `get_db()` dependency |
| `specter-api/redis_client.py` | Create | Upstash Redis singleton |
| `specter-api/alembic.ini` | Create | Alembic config (url from env, not hardcoded) |
| `specter-api/alembic/env.py` | Create | Async Alembic env via `run_async_migrations()` |
| `specter-api/alembic/script.py.mako` | Create | Migration file template |
| `specter-api/alembic/versions/0001_initial_schema.py` | Create | Creates all 8 tables |
| `specter-api/supabase/migrations/0001_initial_schema.sql` | Create | CREATE TABLE + RLS + service-role policies |
| `specter-api/.env` | Create | `DATABASE_URL` + `UPSTASH_REDIS_URL` (gitignored) |
| `specter-api/tests/conftest.py` | Create | Dummy env vars so model tests run offline |
| `specter-api/tests/test_models.py` | Create | Import + column-shape tests for all 8 models |

**All commands run from `C:\Users\manoj\New Specter\specter-api\` with the venv active.**

Activate venv in PowerShell: `.\.venv\Scripts\Activate.ps1`

---

### Task 1: Install Additional Packages

**Files:**
- Modify: `specter-api/pyproject.toml`
- Regenerate: `specter-api/requirements.txt`

- [ ] **Step 1: Activate venv and install packages**

```powershell
cd "C:\Users\manoj\New Specter\specter-api"
.\.venv\Scripts\Activate.ps1
pip install "asyncpg>=0.29" "redis[hiredis]>=5.0"
```

Expected: both packages install without errors.

- [ ] **Step 2: Update pyproject.toml to add the new deps**

Replace the `dependencies` block in `specter-api/pyproject.toml`:

```toml
[project]
name = "specter-api"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
    "fastapi==0.111.*",
    "pydantic>=2.0,<3",
    "sqlalchemy>=2.0,<3",
    "alembic>=1.13,<2",
    "uvicorn[standard]>=0.29",
    "httpx>=0.27",
    "python-jose[cryptography]>=3.3",
    "asyncpg>=0.29",
    "redis[hiredis]>=5.0",
]

[build-system]
requires = ["setuptools>=68"]
build-backend = "setuptools.backends.legacy:build"
```

- [ ] **Step 3: Regenerate requirements.txt**

```powershell
pip freeze > requirements.txt
```

- [ ] **Step 4: Verify imports**

```powershell
python -c "import asyncpg; import redis; print('ok')"
```

Expected: `ok`

- [ ] **Step 5: Commit**

```powershell
git add pyproject.toml requirements.txt
git commit -m "feat(api): add asyncpg and redis[hiredis] dependencies"
```

---

### Task 2: Shared Base Model

**Files:**
- Create: `specter-api/models/base.py`
- Create: `specter-api/tests/conftest.py`
- Create: `specter-api/tests/test_models.py` (partial — Base test only)

- [ ] **Step 1: Create `models/` directory and `models/base.py`**

Create `specter-api/models/base.py`:

```python
from __future__ import annotations
import uuid
from datetime import datetime
from sqlalchemy import DateTime, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False),
        server_default=text("now()"),
        nullable=False,
    )
```

- [ ] **Step 2: Create `tests/conftest.py`**

Create `specter-api/tests/conftest.py`:

```python
import os
import pytest

# Set dummy env vars so db.py and redis_client.py can be imported without a real connection.
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://user:pass@localhost:5432/test")
os.environ.setdefault("UPSTASH_REDIS_URL", "rediss://:password@localhost:6379")
```

- [ ] **Step 3: Write failing test for Base**

Create `specter-api/tests/test_models.py`:

```python
import uuid
from datetime import datetime
from sqlalchemy import inspect


def test_base_has_id_and_created_at():
    from models.base import Base

    # Base itself has no __tablename__, but we can verify the class attrs exist
    assert hasattr(Base, "id")
    assert hasattr(Base, "created_at")
```

- [ ] **Step 4: Install pytest and run the test (expect FAIL — `models` not a package yet)**

```powershell
pip install pytest
python -m pytest tests/test_models.py::test_base_has_id_and_created_at -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'models'` (no `__init__.py` yet — that's fine, we run with `PYTHONPATH=.`)

- [ ] **Step 5: Rerun with PYTHONPATH set**

```powershell
$env:PYTHONPATH = "."
python -m pytest tests/test_models.py::test_base_has_id_and_created_at -v
```

Expected: PASS

- [ ] **Step 6: Commit**

```powershell
git add models/base.py tests/conftest.py tests/test_models.py
git commit -m "feat(api): add SQLAlchemy DeclarativeBase with UUID PK and created_at"
```

---

### Task 3: Merchant + SKU Models

**Files:**
- Create: `specter-api/models/merchants.py`
- Create: `specter-api/models/skus.py`
- Modify: `specter-api/tests/test_models.py`

- [ ] **Step 1: Add failing tests for Merchant and SKU**

Append to `specter-api/tests/test_models.py`:

```python
def test_merchant_tablename_and_columns():
    from models.merchants import Merchant
    mapper = inspect(Merchant)
    cols = {c.key for c in mapper.columns}
    assert Merchant.__tablename__ == "merchants"
    assert {"id", "created_at", "clerk_user_id", "plan", "shopify_domain",
            "shopify_access_token", "woo_api_key", "razorpay_subscription_id",
            "trial_ends_at", "read_only", "eclipse_interval_ms"} == cols


def test_sku_tablename_and_columns():
    from models.skus import SKU
    mapper = inspect(SKU)
    cols = {c.key for c in mapper.columns}
    assert SKU.__tablename__ == "skus"
    assert {"id", "created_at", "merchant_id", "title", "handle",
            "current_price", "floor_price", "ceiling_price",
            "shopify_variant_id", "active"} == cols
```

- [ ] **Step 2: Run tests — expect FAIL**

```powershell
python -m pytest tests/test_models.py -k "merchant or sku" -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'models.merchants'`

- [ ] **Step 3: Create `models/merchants.py`**

```python
from __future__ import annotations
import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import Boolean, DateTime, Integer, String, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column
from models.base import Base


class Merchant(Base):
    __tablename__ = "merchants"

    clerk_user_id: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    plan: Mapped[str] = mapped_column(String, nullable=False)
    shopify_domain: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    shopify_access_token: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    woo_api_key: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    razorpay_subscription_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    trial_ends_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=False), nullable=True)
    read_only: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    eclipse_interval_ms: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("300000"))
```

- [ ] **Step 4: Create `models/skus.py`**

```python
from __future__ import annotations
import uuid
from decimal import Decimal
from typing import Optional
from sqlalchemy import Boolean, ForeignKey, Numeric, String, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column
from models.base import Base


class SKU(Base):
    __tablename__ = "skus"

    merchant_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("merchants.id"), nullable=False
    )
    title: Mapped[str] = mapped_column(String, nullable=False)
    handle: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    current_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), nullable=True)
    floor_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), nullable=True)
    ceiling_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), nullable=True)
    shopify_variant_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))
```

- [ ] **Step 5: Run tests — expect PASS**

```powershell
python -m pytest tests/test_models.py -k "merchant or sku" -v
```

Expected: 2 PASSED

- [ ] **Step 6: Commit**

```powershell
git add models/merchants.py models/skus.py tests/test_models.py
git commit -m "feat(api): add Merchant and SKU SQLAlchemy models"
```

---

### Task 4: CompetitorURL + PriceSnapshot Models

**Files:**
- Create: `specter-api/models/competitor_urls.py`
- Create: `specter-api/models/price_snapshots.py`
- Modify: `specter-api/tests/test_models.py`

- [ ] **Step 1: Add failing tests**

Append to `specter-api/tests/test_models.py`:

```python
def test_competitor_url_tablename_and_columns():
    from models.competitor_urls import CompetitorURL
    mapper = inspect(CompetitorURL)
    cols = {c.key for c in mapper.columns}
    assert CompetitorURL.__tablename__ == "competitor_urls"
    assert {"id", "created_at", "sku_id", "domain", "url_path",
            "last_scraped_at", "scrape_interval_minutes", "robots_blocked"} == cols


def test_price_snapshot_tablename_and_columns():
    from models.price_snapshots import PriceSnapshot
    mapper = inspect(PriceSnapshot)
    cols = {c.key for c in mapper.columns}
    assert PriceSnapshot.__tablename__ == "price_snapshots"
    assert {"id", "created_at", "competitor_url_id", "price", "in_stock",
            "scraped_at", "raw_s3_key", "needs_review", "delete_at"} == cols
```

- [ ] **Step 2: Run tests — expect FAIL**

```powershell
python -m pytest tests/test_models.py -k "competitor or snapshot" -v
```

Expected: FAIL with `ModuleNotFoundError`

- [ ] **Step 3: Create `models/competitor_urls.py`**

```python
from __future__ import annotations
import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column
from models.base import Base


class CompetitorURL(Base):
    __tablename__ = "competitor_urls"

    sku_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("skus.id"), nullable=False
    )
    domain: Mapped[str] = mapped_column(String, nullable=False)
    url_path: Mapped[str] = mapped_column(String, nullable=False)
    last_scraped_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=False), nullable=True)
    scrape_interval_minutes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    robots_blocked: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
```

- [ ] **Step 4: Create `models/price_snapshots.py`**

```python
from __future__ import annotations
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional
from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, String, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column
from models.base import Base


class PriceSnapshot(Base):
    __tablename__ = "price_snapshots"

    competitor_url_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("competitor_urls.id"), nullable=False
    )
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    in_stock: Mapped[bool] = mapped_column(Boolean, nullable=False)
    scraped_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), nullable=False)
    raw_s3_key: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    needs_review: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    delete_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=False), nullable=True)
```

- [ ] **Step 5: Run tests — expect PASS**

```powershell
python -m pytest tests/test_models.py -k "competitor or snapshot" -v
```

Expected: 2 PASSED

- [ ] **Step 6: Commit**

```powershell
git add models/competitor_urls.py models/price_snapshots.py tests/test_models.py
git commit -m "feat(api): add CompetitorURL and PriceSnapshot models"
```

---

### Task 5: Signal + OOSAlert Models

**Files:**
- Create: `specter-api/models/signals.py`
- Create: `specter-api/models/oos_alerts.py`
- Modify: `specter-api/tests/test_models.py`

- [ ] **Step 1: Add failing tests**

Append to `specter-api/tests/test_models.py`:

```python
def test_signal_tablename_and_columns():
    from models.signals import Signal
    mapper = inspect(Signal)
    cols = {c.key for c in mapper.columns}
    assert Signal.__tablename__ == "signals"
    assert {"id", "created_at", "sku_id", "type", "confidence", "reasoning",
            "price_suggestion", "source", "ai_fallback", "ai_model"} == cols


def test_oos_alert_tablename_and_columns():
    from models.oos_alerts import OOSAlert
    mapper = inspect(OOSAlert)
    cols = {c.key for c in mapper.columns}
    assert OOSAlert.__tablename__ == "oos_alerts"
    assert {"id", "created_at", "competitor_url_id", "sku_id",
            "detected_at", "resolved_at", "notified_at"} == cols
```

- [ ] **Step 2: Run tests — expect FAIL**

```powershell
python -m pytest tests/test_models.py -k "signal or oos" -v
```

Expected: FAIL with `ModuleNotFoundError`

- [ ] **Step 3: Create `models/signals.py`**

```python
from __future__ import annotations
import uuid
from decimal import Decimal
from typing import Optional
from sqlalchemy import Boolean, ForeignKey, Numeric, String, Text, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column
from models.base import Base


class Signal(Base):
    __tablename__ = "signals"

    sku_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("skus.id"), nullable=False
    )
    type: Mapped[str] = mapped_column(String(5), nullable=False)
    confidence: Mapped[Decimal] = mapped_column(Numeric(3, 2), nullable=False)
    reasoning: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    price_suggestion: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), nullable=True)
    source: Mapped[str] = mapped_column(String(4), nullable=False)
    ai_fallback: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    ai_model: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
```

- [ ] **Step 4: Create `models/oos_alerts.py`**

```python
from __future__ import annotations
import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column
from models.base import Base


class OOSAlert(Base):
    __tablename__ = "oos_alerts"

    competitor_url_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("competitor_urls.id"), nullable=False
    )
    sku_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("skus.id"), nullable=False
    )
    detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), nullable=False)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=False), nullable=True)
    notified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=False), nullable=True)
```

- [ ] **Step 5: Run tests — expect PASS**

```powershell
python -m pytest tests/test_models.py -k "signal or oos" -v
```

Expected: 2 PASSED

- [ ] **Step 6: Commit**

```powershell
git add models/signals.py models/oos_alerts.py tests/test_models.py
git commit -m "feat(api): add Signal and OOSAlert models"
```

---

### Task 6: PriceChange + MerchantAddon Models

**Files:**
- Create: `specter-api/models/price_changes.py`
- Create: `specter-api/models/merchant_addons.py`
- Modify: `specter-api/tests/test_models.py`

- [ ] **Step 1: Add failing tests**

Append to `specter-api/tests/test_models.py`:

```python
def test_price_change_tablename_and_columns():
    from models.price_changes import PriceChange
    mapper = inspect(PriceChange)
    cols = {c.key for c in mapper.columns}
    assert PriceChange.__tablename__ == "price_changes"
    assert {"id", "created_at", "sku_id", "signal_id", "old_price",
            "new_price", "source", "revenue_delta"} == cols


def test_merchant_addon_tablename_and_columns():
    from models.merchant_addons import MerchantAddon
    mapper = inspect(MerchantAddon)
    cols = {c.key for c in mapper.columns}
    assert MerchantAddon.__tablename__ == "merchant_addons"
    assert {"id", "created_at", "merchant_id", "addon_type", "quantity"} == cols
```

- [ ] **Step 2: Run tests — expect FAIL**

```powershell
python -m pytest tests/test_models.py -k "price_change or merchant_addon" -v
```

Expected: FAIL with `ModuleNotFoundError`

- [ ] **Step 3: Create `models/price_changes.py`**

```python
from __future__ import annotations
import uuid
from decimal import Decimal
from typing import Optional
from sqlalchemy import ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column
from models.base import Base


class PriceChange(Base):
    __tablename__ = "price_changes"

    sku_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("skus.id"), nullable=False
    )
    signal_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("signals.id"), nullable=True
    )
    old_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    new_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    source: Mapped[str] = mapped_column(String(6), nullable=False)
    revenue_delta: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), nullable=True)
```

- [ ] **Step 4: Create `models/merchant_addons.py`**

```python
from __future__ import annotations
import uuid
from sqlalchemy import ForeignKey, Integer, String, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column
from models.base import Base


class MerchantAddon(Base):
    __tablename__ = "merchant_addons"

    merchant_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("merchants.id"), nullable=False
    )
    addon_type: Mapped[str] = mapped_column(String, nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("1"))
```

- [ ] **Step 5: Run tests — expect PASS**

```powershell
python -m pytest tests/test_models.py -k "price_change or merchant_addon" -v
```

Expected: 2 PASSED

- [ ] **Step 6: Commit**

```powershell
git add models/price_changes.py models/merchant_addons.py tests/test_models.py
git commit -m "feat(api): add PriceChange and MerchantAddon models"
```

---

### Task 7: models/\_\_init\_\_.py — Export All Models

**Files:**
- Create: `specter-api/models/__init__.py`
- Modify: `specter-api/tests/test_models.py`

- [ ] **Step 1: Add failing test for unified import**

Append to `specter-api/tests/test_models.py`:

```python
def test_all_models_export_from_models_package():
    from models import (
        Merchant, SKU, CompetitorURL, PriceSnapshot,
        Signal, OOSAlert, PriceChange, MerchantAddon,
    )
    assert all([Merchant, SKU, CompetitorURL, PriceSnapshot,
                Signal, OOSAlert, PriceChange, MerchantAddon])
```

- [ ] **Step 2: Run test — expect FAIL**

```powershell
python -m pytest tests/test_models.py::test_all_models_export_from_models_package -v
```

Expected: FAIL with `ImportError`

- [ ] **Step 3: Create `models/__init__.py`**

```python
from models.merchants import Merchant
from models.skus import SKU
from models.competitor_urls import CompetitorURL
from models.price_snapshots import PriceSnapshot
from models.signals import Signal
from models.oos_alerts import OOSAlert
from models.price_changes import PriceChange
from models.merchant_addons import MerchantAddon

__all__ = [
    "Merchant",
    "SKU",
    "CompetitorURL",
    "PriceSnapshot",
    "Signal",
    "OOSAlert",
    "PriceChange",
    "MerchantAddon",
]
```

- [ ] **Step 4: Run all model tests — expect all PASS**

```powershell
python -m pytest tests/test_models.py -v
```

Expected: 9 PASSED (1 base + 2 per task group + 1 all-imports)

- [ ] **Step 5: Verify the spec's own smoke test**

```powershell
python -c "from models.merchants import Merchant; print('ok')"
```

Expected: `ok`

- [ ] **Step 6: Commit**

```powershell
git add models/__init__.py tests/test_models.py
git commit -m "feat(api): add models/__init__.py exporting all 8 models"
```

---

### Task 8: db.py — Async Session Factory

**Files:**
- Create: `specter-api/db.py`
- Modify: `specter-api/tests/test_models.py`

- [ ] **Step 1: Add failing test**

Append to `specter-api/tests/test_models.py`:

```python
import inspect as stdlib_inspect


def test_get_db_is_async_generator():
    from db import get_db
    assert stdlib_inspect.isasyncgenfunction(get_db)


def test_db_exports_async_session_local():
    from db import AsyncSessionLocal
    assert AsyncSessionLocal is not None
```

- [ ] **Step 2: Run tests — expect FAIL**

```powershell
python -m pytest tests/test_models.py -k "get_db or session_local" -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'db'`

- [ ] **Step 3: Create `db.py`**

```python
from __future__ import annotations
import os
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

DATABASE_URL = os.environ["DATABASE_URL"]

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
```

- [ ] **Step 4: Run tests — expect PASS**

```powershell
python -m pytest tests/test_models.py -k "get_db or session_local" -v
```

Expected: 2 PASSED

- [ ] **Step 5: Commit**

```powershell
git add db.py tests/test_models.py
git commit -m "feat(api): add async db session factory with get_db() dependency"
```

---

### Task 9: redis\_client.py — Upstash Redis Singleton

**Files:**
- Create: `specter-api/redis_client.py`
- Modify: `specter-api/tests/test_models.py`

- [ ] **Step 1: Add failing test**

Append to `specter-api/tests/test_models.py`:

```python
def test_redis_client_is_configured():
    from redis_client import redis
    from redis import Redis
    assert isinstance(redis, Redis)
```

- [ ] **Step 2: Run test — expect FAIL**

```powershell
python -m pytest tests/test_models.py::test_redis_client_is_configured -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'redis_client'`

- [ ] **Step 3: Create `redis_client.py`**

```python
from __future__ import annotations
import os

from redis import Redis

UPSTASH_REDIS_URL = os.environ["UPSTASH_REDIS_URL"]

redis = Redis.from_url(UPSTASH_REDIS_URL, decode_responses=True)
```

- [ ] **Step 4: Run test — expect PASS**

```powershell
python -m pytest tests/test_models.py::test_redis_client_is_configured -v
```

Expected: 1 PASSED

- [ ] **Step 5: Run ALL tests — expect all pass**

```powershell
python -m pytest tests/test_models.py -v
```

Expected: 12 PASSED

- [ ] **Step 6: Commit**

```powershell
git add redis_client.py tests/test_models.py
git commit -m "feat(api): add Upstash Redis singleton via redis-py"
```

---

### Task 10: Alembic Configuration

**Files:**
- Create: `specter-api/alembic.ini`
- Create: `specter-api/alembic/env.py`
- Create: `specter-api/alembic/script.py.mako`
- Create: `specter-api/alembic/versions/` (empty directory placeholder)

- [ ] **Step 1: Create `alembic.ini`**

```ini
[alembic]
script_location = alembic
prepend_sys_path = .
version_path_separator = os

[post_write_hooks]

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARN
handlers = console
qualname =

[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
datefmt = %H:%M:%S
```

Note: `sqlalchemy.url` is intentionally absent — `alembic/env.py` overrides it from `DATABASE_URL` env var at runtime.

- [ ] **Step 2: Create `alembic/` directory and `alembic/env.py`**

```python
from __future__ import annotations
import asyncio
import os
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config
from alembic import context

from models.base import Base
import models  # noqa: F401 — side-effect import registers all 8 models with Base.metadata

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = os.environ["DATABASE_URL"]
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    url = os.environ["DATABASE_URL"]
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = url
    connectable = async_engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

- [ ] **Step 3: Create `alembic/script.py.mako`**

```mako
"""${message}

Revision ID: ${up_revision}
Revises: ${down_revision | comma,n}
Create Date: ${create_date}

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
${imports if imports else ""}

# revision identifiers, used by Alembic.
revision: str = ${repr(up_revision)}
down_revision: Union[str, None] = ${repr(down_revision)}
branch_labels: Union[str, Sequence[str], None] = ${repr(branch_labels)}
depends_on: Union[str, Sequence[str], None] = ${repr(depends_on)}


def upgrade() -> None:
    ${upgrades if upgrades else "pass"}


def downgrade() -> None:
    ${downgrades if downgrades else "pass"}
```

- [ ] **Step 4: Create `alembic/versions/` directory**

Create an empty file `alembic/versions/.gitkeep` so git tracks the empty directory.

- [ ] **Step 5: Verify alembic can read migration history (does not connect to DB)**

```powershell
python -m alembic history
```

Expected: `(empty — no migrations exist yet, but no config errors either)`

- [ ] **Step 6: Commit**

```powershell
git add alembic.ini alembic/env.py alembic/script.py.mako alembic/versions/.gitkeep
git commit -m "feat(api): configure async Alembic with env.py reading DATABASE_URL"
```

---

### Task 11: Initial Alembic Migration

**Files:**
- Create: `specter-api/alembic/versions/0001_initial_schema.py`

- [ ] **Step 1: Create `alembic/versions/0001_initial_schema.py`**

```python
"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-05-24

"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "merchants",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("clerk_user_id", sa.String(), nullable=False),
        sa.Column("plan", sa.String(), nullable=False),
        sa.Column("shopify_domain", sa.String(), nullable=True),
        sa.Column("shopify_access_token", sa.String(), nullable=True),
        sa.Column("woo_api_key", sa.String(), nullable=True),
        sa.Column("razorpay_subscription_id", sa.String(), nullable=True),
        sa.Column("trial_ends_at", sa.DateTime(), nullable=True),
        sa.Column("read_only", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("eclipse_interval_ms", sa.Integer(), server_default=sa.text("300000"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("clerk_user_id"),
    )
    op.create_table(
        "skus",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("merchant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("handle", sa.String(), nullable=True),
        sa.Column("current_price", sa.Numeric(10, 2), nullable=True),
        sa.Column("floor_price", sa.Numeric(10, 2), nullable=True),
        sa.Column("ceiling_price", sa.Numeric(10, 2), nullable=True),
        sa.Column("shopify_variant_id", sa.String(), nullable=True),
        sa.Column("active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.ForeignKeyConstraint(["merchant_id"], ["merchants.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "competitor_urls",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("sku_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("domain", sa.String(), nullable=False),
        sa.Column("url_path", sa.String(), nullable=False),
        sa.Column("last_scraped_at", sa.DateTime(), nullable=True),
        sa.Column("scrape_interval_minutes", sa.Integer(), nullable=True),
        sa.Column("robots_blocked", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.ForeignKeyConstraint(["sku_id"], ["skus.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "price_snapshots",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("competitor_url_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("price", sa.Numeric(10, 2), nullable=False),
        sa.Column("in_stock", sa.Boolean(), nullable=False),
        sa.Column("scraped_at", sa.DateTime(), nullable=False),
        sa.Column("raw_s3_key", sa.String(), nullable=True),
        sa.Column("needs_review", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("delete_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["competitor_url_id"], ["competitor_urls.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "signals",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("sku_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("type", sa.String(5), nullable=False),
        sa.Column("confidence", sa.Numeric(3, 2), nullable=False),
        sa.Column("reasoning", sa.Text(), nullable=True),
        sa.Column("price_suggestion", sa.Numeric(10, 2), nullable=True),
        sa.Column("source", sa.String(4), nullable=False),
        sa.Column("ai_fallback", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("ai_model", sa.String(32), nullable=True),
        sa.ForeignKeyConstraint(["sku_id"], ["skus.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "oos_alerts",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("competitor_url_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("sku_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("detected_at", sa.DateTime(), nullable=False),
        sa.Column("resolved_at", sa.DateTime(), nullable=True),
        sa.Column("notified_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["competitor_url_id"], ["competitor_urls.id"]),
        sa.ForeignKeyConstraint(["sku_id"], ["skus.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "price_changes",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("sku_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("signal_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("old_price", sa.Numeric(10, 2), nullable=False),
        sa.Column("new_price", sa.Numeric(10, 2), nullable=False),
        sa.Column("source", sa.String(6), nullable=False),
        sa.Column("revenue_delta", sa.Numeric(10, 2), nullable=True),
        sa.ForeignKeyConstraint(["signal_id"], ["signals.id"]),
        sa.ForeignKeyConstraint(["sku_id"], ["skus.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "merchant_addons",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("merchant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("addon_type", sa.String(), nullable=False),
        sa.Column("quantity", sa.Integer(), server_default=sa.text("1"), nullable=False),
        sa.ForeignKeyConstraint(["merchant_id"], ["merchants.id"]),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("merchant_addons")
    op.drop_table("price_changes")
    op.drop_table("oos_alerts")
    op.drop_table("signals")
    op.drop_table("price_snapshots")
    op.drop_table("competitor_urls")
    op.drop_table("skus")
    op.drop_table("merchants")
```

- [ ] **Step 2: Set real DATABASE_URL in `.env` (fill in your Supabase values)**

Open `specter-api/.env` and set:

```
DATABASE_URL=postgresql+asyncpg://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
UPSTASH_REDIS_URL=rediss://:<password>@<host>:<port>
```

Note: Supabase connection pooler URL format is `aws-0-<region>.pooler.supabase.com:5432`. The `postgresql+asyncpg://` prefix is required for asyncpg driver.

- [ ] **Step 3: Load the .env and run the migration**

```powershell
# Load the .env vars into the current PowerShell session
Get-Content .env | ForEach-Object {
    if ($_ -match '^([^=]+)=(.*)$') {
        [System.Environment]::SetEnvironmentVariable($matches[1], $matches[2])
    }
}

python -m alembic upgrade head
```

Expected output:
```
INFO  [alembic.runtime.migration] Context impl PostgreSQLImpl.
INFO  [alembic.runtime.migration] Will assume non-transactional DDL.
INFO  [alembic.runtime.migration] Running upgrade  -> 0001, initial schema
```

- [ ] **Step 4: Verify current revision**

```powershell
python -m alembic current
```

Expected: `0001 (head)`

- [ ] **Step 5: Commit**

```powershell
git add alembic/versions/0001_initial_schema.py
git commit -m "feat(api): add initial Alembic migration creating all 8 tables"
```

---

### Task 12: Supabase SQL Migration File

**Files:**
- Create: `specter-api/supabase/migrations/0001_initial_schema.sql`

- [ ] **Step 1: Create `supabase/migrations/` directory and SQL file**

Create `specter-api/supabase/migrations/0001_initial_schema.sql`:

```sql
-- SPECTER initial schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- Enables RLS on all tables with a permissive service-role policy.
-- Per-table user policies are added in a later migration.

-- ============================================================
-- Tables
-- ============================================================

CREATE TABLE merchants (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at              TIMESTAMP   NOT NULL DEFAULT now(),
  clerk_user_id           VARCHAR     NOT NULL UNIQUE,
  plan                    VARCHAR     NOT NULL,
  shopify_domain          VARCHAR,
  shopify_access_token    VARCHAR,
  woo_api_key             VARCHAR,
  razorpay_subscription_id VARCHAR,
  trial_ends_at           TIMESTAMP,
  read_only               BOOLEAN     NOT NULL DEFAULT false,
  eclipse_interval_ms     INTEGER     NOT NULL DEFAULT 300000
);

CREATE TABLE skus (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at          TIMESTAMP     NOT NULL DEFAULT now(),
  merchant_id         UUID          NOT NULL REFERENCES merchants(id),
  title               VARCHAR       NOT NULL,
  handle              VARCHAR,
  current_price       DECIMAL(10,2),
  floor_price         DECIMAL(10,2),
  ceiling_price       DECIMAL(10,2),
  shopify_variant_id  VARCHAR,
  active              BOOLEAN       NOT NULL DEFAULT true
);

CREATE TABLE competitor_urls (
  id                       UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at               TIMESTAMP NOT NULL DEFAULT now(),
  sku_id                   UUID      NOT NULL REFERENCES skus(id),
  domain                   VARCHAR   NOT NULL,
  url_path                 VARCHAR   NOT NULL,
  last_scraped_at          TIMESTAMP,
  scrape_interval_minutes  INTEGER,
  robots_blocked           BOOLEAN   NOT NULL DEFAULT false
);

CREATE TABLE price_snapshots (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at          TIMESTAMP     NOT NULL DEFAULT now(),
  competitor_url_id   UUID          NOT NULL REFERENCES competitor_urls(id),
  price               DECIMAL(10,2) NOT NULL,
  in_stock            BOOLEAN       NOT NULL,
  scraped_at          TIMESTAMP     NOT NULL,
  raw_s3_key          VARCHAR,
  needs_review        BOOLEAN       NOT NULL DEFAULT false,
  delete_at           TIMESTAMP
);

CREATE TABLE signals (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       TIMESTAMP     NOT NULL DEFAULT now(),
  sku_id           UUID          NOT NULL REFERENCES skus(id),
  type             VARCHAR(5)    NOT NULL,
  confidence       DECIMAL(3,2)  NOT NULL,
  reasoning        TEXT,
  price_suggestion DECIMAL(10,2),
  source           VARCHAR(4)    NOT NULL,
  ai_fallback      BOOLEAN       NOT NULL DEFAULT false,
  ai_model         VARCHAR(32)
);

CREATE TABLE oos_alerts (
  id                  UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at          TIMESTAMP NOT NULL DEFAULT now(),
  competitor_url_id   UUID      NOT NULL REFERENCES competitor_urls(id),
  sku_id              UUID      NOT NULL REFERENCES skus(id),
  detected_at         TIMESTAMP NOT NULL,
  resolved_at         TIMESTAMP,
  notified_at         TIMESTAMP
);

CREATE TABLE price_changes (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMP     NOT NULL DEFAULT now(),
  sku_id        UUID          NOT NULL REFERENCES skus(id),
  signal_id     UUID          REFERENCES signals(id),
  old_price     DECIMAL(10,2) NOT NULL,
  new_price     DECIMAL(10,2) NOT NULL,
  source        VARCHAR(6)    NOT NULL,
  revenue_delta DECIMAL(10,2)
);

CREATE TABLE merchant_addons (
  id           UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at   TIMESTAMP NOT NULL DEFAULT now(),
  merchant_id  UUID      NOT NULL REFERENCES merchants(id),
  addon_type   VARCHAR   NOT NULL,
  quantity     INTEGER   NOT NULL DEFAULT 1
);

-- ============================================================
-- Row-Level Security
-- ============================================================

ALTER TABLE merchants        ENABLE ROW LEVEL SECURITY;
ALTER TABLE skus             ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_urls  ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_snapshots  ENABLE ROW LEVEL SECURITY;
ALTER TABLE signals          ENABLE ROW LEVEL SECURITY;
ALTER TABLE oos_alerts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_changes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_addons  ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Service-role permissive policies (specter-api full access)
-- Per-user policies added in a later migration (Prompt 12).
-- ============================================================

CREATE POLICY "service_role_full_access" ON merchants
  USING (true) WITH CHECK (true);

CREATE POLICY "service_role_full_access" ON skus
  USING (true) WITH CHECK (true);

CREATE POLICY "service_role_full_access" ON competitor_urls
  USING (true) WITH CHECK (true);

CREATE POLICY "service_role_full_access" ON price_snapshots
  USING (true) WITH CHECK (true);

CREATE POLICY "service_role_full_access" ON signals
  USING (true) WITH CHECK (true);

CREATE POLICY "service_role_full_access" ON oos_alerts
  USING (true) WITH CHECK (true);

CREATE POLICY "service_role_full_access" ON price_changes
  USING (true) WITH CHECK (true);

CREATE POLICY "service_role_full_access" ON merchant_addons
  USING (true) WITH CHECK (true);
```

- [ ] **Step 2: Verify the SQL file applies cleanly in Supabase**

Open Supabase Dashboard → SQL Editor → New Query. Paste the contents of `supabase/migrations/0001_initial_schema.sql` and click **Run**.

Expected: All statements succeed. Check Database → Tables — all 8 tables should appear with RLS enabled (shield icon).

- [ ] **Step 3: Commit**

```powershell
git add supabase/migrations/0001_initial_schema.sql
git commit -m "feat(api): add Supabase SQL migration with RLS enabled on all 8 tables"
```

---

### Task 13: .env File + Final Smoke Tests + Commit

**Files:**
- Create: `specter-api/.env` (gitignored)
- Verify: `.gitignore` excludes `.env`

- [ ] **Step 1: Verify `.env` is in `.gitignore`**

Open `specter-api/.gitignore` and confirm it contains a line matching `.env` (not just `.env.local`). If missing, add it:

```
.env
.env.*
__pycache__/
.venv/
*.pyc
```

- [ ] **Step 2: Create `specter-api/.env` with real credentials**

```
DATABASE_URL=postgresql+asyncpg://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
UPSTASH_REDIS_URL=rediss://:<password>@<host>:<port>
```

This file must NOT be committed. Verify with `git status` — it should be untracked and not staged.

- [ ] **Step 3: Run all model + db + redis tests**

```powershell
$env:PYTHONPATH = "."
python -m pytest tests/test_models.py -v
```

Expected: All 12 tests PASS.

- [ ] **Step 4: Run all 4 spec smoke tests**

```powershell
# Load real env vars
Get-Content .env | ForEach-Object {
    if ($_ -match '^([^=]+)=(.*)$') {
        [System.Environment]::SetEnvironmentVariable($matches[1], $matches[2])
    }
}

# Smoke test 1: alembic at head
python -m alembic current
# Expected: 0001 (head)

# Smoke test 2: model import
python -c "from models.merchants import Merchant; print('ok')"
# Expected: ok

# Smoke test 3: all 8 models import
python -c "from models import Merchant, SKU, CompetitorURL, PriceSnapshot, Signal, OOSAlert, PriceChange, MerchantAddon; print('ok')"
# Expected: ok

# Smoke test 4: redis ping (requires live Upstash URL)
python -c "from redis_client import redis; print(redis.ping())"
# Expected: True
```

- [ ] **Step 5: Commit .gitignore update if it was modified**

```powershell
git status  # verify .env is NOT in staged files
git diff --cached --quiet || git commit -m "chore(api): ensure .env excluded in gitignore"
```

Note: All model files, db.py, redis_client.py, alembic/, and supabase/ were already committed in Tasks 1–12. This step only commits .gitignore if it was modified in Step 1 above. If nothing is staged, skip the commit — that means everything is already committed.

---

## Success Criteria

All five must pass before Prompt 2 is considered complete:

1. `python -m alembic current` → `0001 (head)`
2. `python -m alembic upgrade head` on a fresh DB → exits 0
3. `python -c "from models.merchants import Merchant; print('ok')"` → `ok`
4. `python -c "from redis_client import redis; print(redis.ping())"` → `True`
5. All 8 tables visible in Supabase Dashboard with RLS shield icon enabled
