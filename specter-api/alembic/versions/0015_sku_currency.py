"""skus.currency: per-product display + signal currency

Revision ID: 0015
Revises: 0014
Create Date: 2026-06-21

Each product now carries its own ISO-4217 currency. The signal engine normalizes
every competitor snapshot price (which carries its own scraped currency on
price_snapshots.currency) into the product's currency via the FX service before
comparing, so a EUR-priced competitor and a USD product no longer produce a
garbage RAISE/LOWER. Existing rows backfill to 'USD' (the prior implicit
assumption), so historical math is unchanged for anyone who never set a currency.
"""
from __future__ import annotations
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0015"
down_revision: Union[str, None] = "0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "skus",
        sa.Column("currency", sa.String(length=3), nullable=False,
                  server_default=sa.text("'USD'")),
    )


def downgrade() -> None:
    op.drop_column("skus", "currency")
