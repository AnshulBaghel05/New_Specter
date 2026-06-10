from __future__ import annotations
import uuid
from typing import Optional
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
    # The Razorpay subscription backing this add-on, so DELETE /billing/addon/{id}
    # can cancel the exact subscription. Nullable for legacy rows / test stubs.
    razorpay_subscription_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
