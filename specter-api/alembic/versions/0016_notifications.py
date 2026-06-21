"""notifications: in-app notification + alert centre

Revision ID: 0016
Revises: 0015
Create Date: 2026-06-21

In-app notifications surfaced via the dashboard bell + /notifications page. One row
per merchant per event (new signal, OOS, billing). `read_at IS NULL` = unread; the
(merchant_id, read_at) index keeps the 60s-polled unread-count cheap. Indexes are
created inline with the (empty) table, so no CONCURRENTLY is needed.
"""
from __future__ import annotations
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0016"
down_revision: Union[str, None] = "0015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "notifications",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True),
                  server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
        sa.Column("merchant_id", sa.dialects.postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("merchants.id"), nullable=False),
        sa.Column("type", sa.String(length=20), nullable=False),
        sa.Column("severity", sa.String(length=10), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("link", sa.String(), nullable=True),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("dedup_key", sa.String(), nullable=True),
    )
    op.create_index("ix_notifications_merchant_read", "notifications",
                    ["merchant_id", "read_at"])
    op.create_index("ix_notifications_merchant_created", "notifications",
                    ["merchant_id", "created_at"])
    op.create_index("ix_notifications_merchant_dedup", "notifications",
                    ["merchant_id", "dedup_key"])


def downgrade() -> None:
    op.drop_index("ix_notifications_merchant_dedup", table_name="notifications")
    op.drop_index("ix_notifications_merchant_created", table_name="notifications")
    op.drop_index("ix_notifications_merchant_read", table_name="notifications")
    op.drop_table("notifications")
