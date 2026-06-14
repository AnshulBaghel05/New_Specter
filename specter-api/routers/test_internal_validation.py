"""Ingest data-quality tests — a price snapshot must carry a positive price."""
import os
from decimal import Decimal

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://user:pass@localhost:5432/test")
os.environ.setdefault("UPSTASH_REDIS_URL", "rediss://:password@localhost:6379")

import pytest  # noqa: E402
from pydantic import ValidationError  # noqa: E402

from routers.internal import SnapshotIn  # noqa: E402


def test_rejects_zero_price():
    with pytest.raises(ValidationError):
        SnapshotIn(domain="x", url_path="/p", price=0, in_stock=True)


def test_rejects_negative_price():
    with pytest.raises(ValidationError):
        SnapshotIn(domain="x", url_path="/p", price=-1, in_stock=True)


def test_rejects_out_of_range_price():
    with pytest.raises(ValidationError):
        SnapshotIn(domain="x", url_path="/p", price=Decimal("100000000"), in_stock=True)


def test_accepts_positive_price():
    s = SnapshotIn(domain="x", url_path="/p", price=Decimal("9.99"), in_stock=True)
    assert s.price == Decimal("9.99")
