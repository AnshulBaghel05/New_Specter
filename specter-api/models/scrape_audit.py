from __future__ import annotations
from typing import Optional
from sqlalchemy import String, Index
from sqlalchemy.orm import Mapped, mapped_column
from models.base import Base


class ScrapeAudit(Base):
    """Append-only audit trail: one row per fetch outcome reaching the API.

    Records what we did to each domain and why, so abuse/compliance questions
    ("did you keep scraping us after the takedown?") have an authoritative answer.
    Never updated or deleted in the hot path; a retention job tiers it out.

    status: 'stored' | 'duplicate' | 'failed' | 'blocked' | 'excluded'
    robots_decision: 'allowed' | 'disallowed' | 'unknown' (as the scraper saw it)
    proxy_tier: 'datacenter' | 'residential' | 'none' (which egress was used)
    """

    __tablename__ = "scrape_audit"

    domain: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False)
    robots_decision: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    proxy_tier: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    # created_at (the fetch timestamp) comes from Base.

    __table_args__ = (
        Index("ix_scrape_audit_domain_created", "domain", "created_at"),
    )
