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
