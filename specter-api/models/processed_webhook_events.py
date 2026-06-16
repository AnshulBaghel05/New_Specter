from __future__ import annotations
from typing import Optional
from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column
from models.base import Base


class ProcessedWebhookEvent(Base):
    """One row per Razorpay webhook event we have already processed.

    Razorpay redelivers a webhook (same `X-Razorpay-Event-Id`) until it gets a 2xx,
    so the same event can arrive several times. The handlers are individually
    idempotent, but recording the event id here lets the endpoint short-circuit a
    redelivery before re-running any work or re-hitting the Razorpay API. The id is
    UNIQUE so a concurrent duplicate delivery collides at the DB instead of both
    processing.
    """

    __tablename__ = "processed_webhook_events"

    event_id: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    event_type: Mapped[Optional[str]] = mapped_column(String, nullable=True)
