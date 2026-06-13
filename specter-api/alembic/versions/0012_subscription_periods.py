"""subscription period columns — renewal + cancel-at-period-end dates

Revision ID: 0012
Revises: 0011
Create Date: 2026-06-11

Cancel-at-period-end UX (billing checkout wiring) needs to show the next renewal
date and, when a cancellation is scheduled, the date access lapses. Both are
nullable so existing rows and non-Razorpay test stubs are unaffected.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0012"
down_revision: Union[str, None] = "0011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("merchants", sa.Column("subscription_current_end", sa.DateTime(timezone=True), nullable=True))
    op.add_column("merchants", sa.Column("subscription_cancel_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("merchants", "subscription_cancel_at")
    op.drop_column("merchants", "subscription_current_end")
