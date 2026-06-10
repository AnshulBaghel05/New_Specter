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

    # competitor_tracking_id links to the specific (own_product × competitor_url) pair
    # that went OOS — replaces the old (competitor_url_id + sku_id) pair.
    competitor_tracking_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("competitor_trackings.id"), nullable=False
    )
    # Denormalized from competitor_trackings.own_product_id for fast signal/reprice queries.
    sku_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("skus.id"), nullable=False
    )
    detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    notified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
