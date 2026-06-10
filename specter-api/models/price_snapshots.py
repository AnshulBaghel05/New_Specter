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

    # Snapshots are URL-level: one scrape job produces one snapshot shared by all
    # competitor_trackings referencing this URL — avoids duplicate rows per tracking.
    competitor_url_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("competitor_urls.id"), nullable=False
    )
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, server_default=text("'USD'"))
    in_stock: Mapped[bool] = mapped_column(Boolean, nullable=False)
    scraped_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    raw_s3_key: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    needs_review: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    delete_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    # Idempotency key — the scraper's BullMQ job UUID. UNIQUE so a retried job
    # that re-POSTs the same result is absorbed by ON CONFLICT (job_uuid) DO NOTHING.
    job_uuid: Mapped[Optional[uuid.UUID]] = mapped_column(
        PG_UUID(as_uuid=True), unique=True, nullable=True
    )
