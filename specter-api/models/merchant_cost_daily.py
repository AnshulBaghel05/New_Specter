from __future__ import annotations
import uuid
from datetime import date as date_t, datetime
from sqlalchemy import Date, DateTime, Numeric, String, Integer, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column
from models.base import Base


class MerchantCostDaily(Base):
    """Daily per-merchant cost rollup (source of truth for margins). One row per
    (merchant_id, date, cost_type). Flushed from Redis counters by flush_daily."""
    __tablename__ = "merchant_cost_daily"

    merchant_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False)
    date: Mapped[date_t] = mapped_column(Date, nullable=False)
    cost_type: Mapped[str] = mapped_column(String, nullable=False)   # proxy | ai | captcha
    cost_usd: Mapped[float] = mapped_column(Numeric(14, 6), nullable=False, server_default=text("0"))
    units: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, server_default=text("0"))
    sample_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False)

    __table_args__ = (
        UniqueConstraint("merchant_id", "date", "cost_type", name="uq_merchant_cost_daily"),
    )
