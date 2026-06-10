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
    # Per-SKU auto-reprice switch (F7 AC#7). Effective only when the merchant's
    # global auto_reprice_enabled is also true and plan is CIPHER+.
    auto_reprice_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))
