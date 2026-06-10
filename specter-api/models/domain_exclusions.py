from __future__ import annotations
from typing import Optional
from sqlalchemy import String, text
from sqlalchemy.orm import Mapped, mapped_column
from models.base import Base


class DomainExclusion(Base):
    """Hard opt-out / takedown list. A domain here must NOT be scraped, effective
    immediately — the scraper probe checks this (via a Redis-cached set) before any
    fetch, and the ingest path refuses snapshots for excluded domains as defense in
    depth. Separate from competitor_urls.robots_blocked (a per-URL robots signal):
    this is an operator-level kill switch honoring legal/abuse requests."""

    __tablename__ = "domain_exclusions"

    domain: Mapped[str] = mapped_column(String, nullable=False, unique=True, index=True)
    reason: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    # created_at (when the exclusion was added) comes from Base.
