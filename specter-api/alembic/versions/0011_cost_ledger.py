"""cost ledger: merchant_cost_daily rollup + cost_event_sample

Revision ID: 0011
Revises: 0010
"""
from __future__ import annotations
from typing import Union
import sqlalchemy as sa
from alembic import op

revision: str = "0011"
down_revision: Union[str, None] = "0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "merchant_cost_daily",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True),
                  server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("merchant_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("cost_type", sa.String(), nullable=False),
        sa.Column("cost_usd", sa.Numeric(14, 6), server_default=sa.text("0"), nullable=False),
        sa.Column("units", sa.Numeric(18, 4), server_default=sa.text("0"), nullable=False),
        sa.Column("sample_count", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("merchant_id", "date", "cost_type", name="uq_merchant_cost_daily"),
    )
    op.create_index("ix_merchant_cost_daily_date", "merchant_cost_daily", ["date"])
    op.create_table(
        "cost_event_sample",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True),
                  server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("merchant_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("cost_type", sa.String(), nullable=False),
        sa.Column("proxy_tier", sa.String(), nullable=True),
        sa.Column("units", sa.Numeric(18, 4), nullable=False),
        sa.Column("cost_usd", sa.Numeric(14, 8), nullable=False),
        sa.Column("domain", sa.String(), nullable=True),
    )
    op.create_index("ix_cost_event_sample_created", "cost_event_sample", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_cost_event_sample_created", table_name="cost_event_sample")
    op.drop_table("cost_event_sample")
    op.drop_index("ix_merchant_cost_daily_date", table_name="merchant_cost_daily")
    op.drop_table("merchant_cost_daily")
