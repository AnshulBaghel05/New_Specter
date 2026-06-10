from __future__ import annotations
from datetime import datetime
from typing import Optional
from sqlalchemy import BigInteger, Boolean, DateTime, String, text
from sqlalchemy.orm import Mapped, mapped_column
from models.base import Base


class CompetitorURL(Base):
    """URL-level registry. One row per unique (domain, url_path) pair across all merchants.
    Scraper writes price_snapshots against this record.
    The billing unit is competitor_trackings — not this table."""

    __tablename__ = "competitor_urls"

    domain: Mapped[str] = mapped_column(String, nullable=False)
    url_path: Mapped[str] = mapped_column(String, nullable=False)
    last_scraped_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    robots_blocked: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    currency: Mapped[Optional[str]] = mapped_column(String(3), nullable=True)
    # Even-spread scheduling (control-plane dispatcher): the URL's effective scrape
    # interval, its stable phase offset within that interval, and the next due time.
    interval_ms: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    phase_offset_ms: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    next_run_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
