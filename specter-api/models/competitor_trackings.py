from __future__ import annotations
import uuid
from sqlalchemy import Boolean, ForeignKey, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column
from models.base import Base


class CompetitorTracking(Base):
    """Billing unit. One row = 1 SKU consumed.
    Represents a merchant's decision to track one own_product against one competitor URL
    — i.e. one (product -> competitor) link. Each enabled row is also exactly one
    competitor-URL scrape per refresh cycle (the scrape runs on the competitor's page;
    the merchant's own store is API-synced, never scraped).
    Count(rows where merchant_id = X and enabled = true) = merchant's active SKU usage
    = competitor scrapes per cycle. The SKU count tracks product->competitor links, not
    the number of products imported (100 products x 1 competitor = 100 SKUs;
    33 products x 3 competitors = 99 SKUs)."""

    __tablename__ = "competitor_trackings"

    own_product_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("skus.id"), nullable=False
    )
    competitor_url_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("competitor_urls.id"), nullable=False
    )
    merchant_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("merchants.id"), nullable=False
    )
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))
    silenced_oos: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
