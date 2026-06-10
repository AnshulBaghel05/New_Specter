"""merchant_addons.razorpay_subscription_id — link an add-on to its Razorpay sub

Revision ID: 0008
Revises: 0007
Create Date: 2026-06-05

Add-on management (Prompt 15 / Razorpay billing) needs to cancel the exact
Razorpay subscription backing an add-on when the merchant removes it. Store
that subscription id on the merchant_addons row. Nullable so existing rows and
non-Razorpay test stubs are unaffected.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0008"
down_revision: Union[str, None] = "0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "merchant_addons",
        sa.Column("razorpay_subscription_id", sa.String(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("merchant_addons", "razorpay_subscription_id")
