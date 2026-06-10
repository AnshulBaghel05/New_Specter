from __future__ import annotations
from datetime import datetime
from typing import Optional
from sqlalchemy import Boolean, DateTime, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column
from models.base import Base


class Merchant(Base):
    __tablename__ = "merchants"

    supabase_user_id: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    plan: Mapped[str] = mapped_column(String, nullable=False)
    shopify_domain: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    shopify_access_token: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    woo_api_key: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    razorpay_subscription_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    trial_ends_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    read_only: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    shopify_reconnect_required: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    eclipse_interval_ms: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("300000"))
    # Maximum competitor trackings per own product. Set to plan default on plan change.
    # RECON=3, CIPHER=5, PHANTOM=8, PREDATOR=12, ECLIPSE=custom (NULL = unlimited)
    max_competitors_per_sku: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, server_default=text("3"))
    # Global auto-reprice master switch (F7 AC#7). CIPHER+ only takes effect.
    auto_reprice_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))
    # Notification preferences (F5 emails). When false, OOS/scrape emails are suppressed.
    email_notifications_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))
    # Recipient for transactional emails. Captured from the Supabase JWT `email`
    # claim at sign-in and refreshed when it changes — background pipelines (OOS
    # detector) have no request context to read the JWT, so it must be persisted.
    notification_email: Mapped[Optional[str]] = mapped_column(String, nullable=True)
