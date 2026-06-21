from __future__ import annotations
import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import DateTime, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column
from models.base import Base


class Notification(Base):
    """In-app notification for a merchant (the bell + /notifications page).

    Owned by merchant_id (1:1 with the auth user via merchants.supabase_user_id).
    `read_at IS NULL` means unread — the unread-count query filters on exactly that,
    so the (merchant_id, read_at) index keeps the 60s-polled badge cheap.
    """
    __tablename__ = "notifications"

    merchant_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("merchants.id"), nullable=False
    )
    # One of: signal | oos | billing | competitor_change | system
    type: Mapped[str] = mapped_column(String(20), nullable=False)
    # One of: info | success | warning | critical (drives icon + colour on the UI)
    severity: Mapped[str] = mapped_column(String(10), nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    # In-app route to act on the notification (e.g. /signals, /products, /settings).
    link: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    # NULL = unread; set to now() when the merchant reads it.
    read_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    # Optional idempotency key so the same event can't notify twice.
    dedup_key: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    __table_args__ = (
        # Fast unread-count per merchant (the polled bell badge).
        Index("ix_notifications_merchant_read", "merchant_id", "read_at"),
        # Fast newest-first paginated listing per merchant.
        Index("ix_notifications_merchant_created", "merchant_id", "created_at"),
        # Dedup lookups.
        Index("ix_notifications_merchant_dedup", "merchant_id", "dedup_key"),
    )
