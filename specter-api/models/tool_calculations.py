from __future__ import annotations
import uuid
from datetime import datetime
from typing import Any, Optional
from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column
from models.base import Base


class ToolCalculation(Base):
    """A saved free-tool calculation (Workspace "Saved Report").

    Persists the inputs + results of any public calculator so a logged-in
    free user can keep history, reload it into the tool, compare runs, and
    feed the Opportunity Feed. Available to every plan incl. `free` — there
    is no plan gate on this surface. RLS scopes rows by merchant.
    """
    __tablename__ = "tool_calculations"

    merchant_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("merchants.id"), nullable=False
    )
    # Calculator identity, e.g. "shipping", "shopify-profit", "amazon-fba".
    tool_name: Mapped[str] = mapped_column(String, nullable=False)
    # User-facing label, e.g. "May Profit Analysis".
    name: Mapped[str] = mapped_column(String, nullable=False)
    # Raw calculator inputs + computed results (opaque per-tool shapes).
    inputs: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    results: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    # Display currency the figures were computed in, e.g. "USD".
    currency: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    # Soft-archive timestamp; NULL = active. Hidden from the default list.
    archived_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
