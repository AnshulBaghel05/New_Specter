from __future__ import annotations
import uuid
from typing import Optional
from sqlalchemy import Numeric, String
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column
from models.base import Base


class CostEventSample(Base):
    """1% sampled raw cost events — calibrates the byte/cost estimates against the
    daily rollups and spot-checks attribution. id + created_at from Base."""
    __tablename__ = "cost_event_sample"

    merchant_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False)
    cost_type: Mapped[str] = mapped_column(String, nullable=False)
    proxy_tier: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    units: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)
    cost_usd: Mapped[float] = mapped_column(Numeric(14, 8), nullable=False)
    domain: Mapped[Optional[str]] = mapped_column(String, nullable=True)
