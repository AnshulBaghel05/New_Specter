"""auto-reprice toggles + email notification preference

Revision ID: 0004
Revises: 0003
Create Date: 2026-05-29

Adds F7 AC#7 auto-reprice switches (global on merchants, per-SKU on skus) and
the F5 email-notification preference on merchants.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "merchants",
        sa.Column("auto_reprice_enabled", sa.Boolean(),
                  server_default=sa.text("true"), nullable=False),
    )
    op.add_column(
        "merchants",
        sa.Column("email_notifications_enabled", sa.Boolean(),
                  server_default=sa.text("true"), nullable=False),
    )
    op.add_column(
        "skus",
        sa.Column("auto_reprice_enabled", sa.Boolean(),
                  server_default=sa.text("true"), nullable=False),
    )


def downgrade() -> None:
    op.drop_column("skus", "auto_reprice_enabled")
    op.drop_column("merchants", "email_notifications_enabled")
    op.drop_column("merchants", "auto_reprice_enabled")
