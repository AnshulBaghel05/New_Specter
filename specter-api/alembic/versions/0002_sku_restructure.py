"""sku restructure — competitor_trackings billing unit

Revision ID: 0002
Revises: 0001
Create Date: 2026-05-29

Changes:
- competitor_urls: drop sku_id FK and scrape_interval_minutes; add currency(3)
- merchants: add max_competitors_per_sku (default 3)
- price_snapshots: add currency(3) (default 'USD')
- NEW TABLE competitor_trackings: billing unit (own_product_id × competitor_url_id)
- oos_alerts: replace competitor_url_id FK with competitor_tracking_id FK
"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── 1. competitor_urls — strip sku coupling, add currency ─────────────────
    op.drop_constraint("competitor_urls_sku_id_fkey", "competitor_urls", type_="foreignkey")
    op.drop_column("competitor_urls", "sku_id")
    op.drop_column("competitor_urls", "scrape_interval_minutes")
    op.add_column(
        "competitor_urls",
        sa.Column("currency", sa.String(3), nullable=True),
    )

    # ── 2. merchants — competitor limit per own product ───────────────────────
    op.add_column(
        "merchants",
        sa.Column(
            "max_competitors_per_sku",
            sa.Integer(),
            nullable=True,
            server_default=sa.text("3"),
        ),
    )

    # ── 3. price_snapshots — add currency ─────────────────────────────────────
    op.add_column(
        "price_snapshots",
        sa.Column(
            "currency",
            sa.String(3),
            nullable=False,
            server_default=sa.text("'USD'"),
        ),
    )

    # ── 4. competitor_trackings — new billing unit table ──────────────────────
    op.create_table(
        "competitor_trackings",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("own_product_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("competitor_url_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("merchant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("enabled", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("silenced_oos", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.ForeignKeyConstraint(["own_product_id"], ["skus.id"]),
        sa.ForeignKeyConstraint(["competitor_url_id"], ["competitor_urls.id"]),
        sa.ForeignKeyConstraint(["merchant_id"], ["merchants.id"]),
        sa.PrimaryKeyConstraint("id"),
        # A merchant cannot add the same competitor URL to the same product twice.
        sa.UniqueConstraint("own_product_id", "competitor_url_id", name="uq_tracking_pair"),
    )
    # Index for the most common query: all trackings for a merchant.
    op.create_index("ix_ct_merchant_id", "competitor_trackings", ["merchant_id"])
    # Index for fast per-product competitor count (plan limit enforcement).
    op.create_index("ix_ct_own_product_id", "competitor_trackings", ["own_product_id"])
    # Index for scraper lookup: given competitor_url_id, find all enabled trackings.
    op.create_index("ix_ct_competitor_url_id", "competitor_trackings", ["competitor_url_id"])

    # ── 5. oos_alerts — switch to competitor_tracking_id ─────────────────────
    op.drop_constraint("oos_alerts_competitor_url_id_fkey", "oos_alerts", type_="foreignkey")
    op.drop_column("oos_alerts", "competitor_url_id")
    op.add_column(
        "oos_alerts",
        sa.Column("competitor_tracking_id", postgresql.UUID(as_uuid=True), nullable=False),
    )
    op.create_foreign_key(
        "oos_alerts_competitor_tracking_id_fkey",
        "oos_alerts",
        "competitor_trackings",
        ["competitor_tracking_id"],
        ["id"],
    )


def downgrade() -> None:
    # ── 5. oos_alerts — restore competitor_url_id ────────────────────────────
    op.drop_constraint("oos_alerts_competitor_tracking_id_fkey", "oos_alerts", type_="foreignkey")
    op.drop_column("oos_alerts", "competitor_tracking_id")
    op.add_column(
        "oos_alerts",
        sa.Column("competitor_url_id", postgresql.UUID(as_uuid=True), nullable=False),
    )
    op.create_foreign_key(
        "oos_alerts_competitor_url_id_fkey",
        "oos_alerts",
        "competitor_urls",
        ["competitor_url_id"],
        ["id"],
    )

    # ── 4. competitor_trackings — drop table ──────────────────────────────────
    op.drop_index("ix_ct_competitor_url_id", "competitor_trackings")
    op.drop_index("ix_ct_own_product_id", "competitor_trackings")
    op.drop_index("ix_ct_merchant_id", "competitor_trackings")
    op.drop_table("competitor_trackings")

    # ── 3. price_snapshots — drop currency ────────────────────────────────────
    op.drop_column("price_snapshots", "currency")

    # ── 2. merchants — drop competitor limit ─────────────────────────────────
    op.drop_column("merchants", "max_competitors_per_sku")

    # ── 1. competitor_urls — restore sku coupling ────────────────────────────
    op.drop_column("competitor_urls", "currency")
    op.add_column(
        "competitor_urls",
        sa.Column("scrape_interval_minutes", sa.Integer(), nullable=True),
    )
    op.add_column(
        "competitor_urls",
        sa.Column("sku_id", postgresql.UUID(as_uuid=True), nullable=False),
    )
    op.create_foreign_key(
        "competitor_urls_sku_id_fkey",
        "competitor_urls",
        "skus",
        ["sku_id"],
        ["id"],
    )
