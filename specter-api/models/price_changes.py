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
