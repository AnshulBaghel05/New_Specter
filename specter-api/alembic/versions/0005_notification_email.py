"""persist notification_email on merchants

Revision ID: 0005
Revises: 0004
Create Date: 2026-05-30

Stores the merchant's email so background pipelines (the OOS detector) can send
F5 transactional alerts without a request-scoped Supabase JWT. Captured from the
JWT `email` claim on sign-in.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "merchants",
        sa.Column("notification_email", sa.String(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("merchants", "notification_email")
