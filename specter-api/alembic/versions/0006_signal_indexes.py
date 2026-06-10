"""signal indexes for sku-scoped sort/window queries

Revision ID: 0006
Revises: 0005
Create Date: 2026-06-02

GET /signals always joins skus on sku_id and orders by created_at (default) or
confidence (sort=confidence). The signals table had only its id PK, so these
sku_id-leading composites back the join + window filter + both sort orders.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "ix_signals_sku_id_created_at",
        "signals",
        ["sku_id", sa.text("created_at DESC")],
    )
    op.create_index(
        "ix_signals_sku_id_confidence",
        "signals",
        ["sku_id", sa.text("confidence DESC")],
    )


def downgrade() -> None:
    op.drop_index("ix_signals_sku_id_confidence", table_name="signals")
    op.drop_index("ix_signals_sku_id_created_at", table_name="signals")
