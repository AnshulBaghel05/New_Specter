"""add shopify_reconnect_required to merchants

Revision ID: 0003
Revises: 0002
Create Date: 2026-05-29

Adds the Shopify token-expiry reconnect flag (F1 AC#6). Auth is Supabase-based
from the initial schema via merchants.supabase_user_id.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "merchants",
        sa.Column("shopify_reconnect_required", sa.Boolean(),
                  server_default=sa.text("false"), nullable=False),
    )


def downgrade() -> None:
    op.drop_column("merchants", "shopify_reconnect_required")
