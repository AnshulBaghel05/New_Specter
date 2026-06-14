"""performance indexes on hot foreign-key / lookup columns

Revision ID: 0013
Revises: 0012
Create Date: 2026-06-14

The initial schema (0001) created these tables with foreign-key *constraints* but
no *indexes* on the FK columns — Postgres does not auto-index FKs. At scale this
forces sequential scans on the largest, fastest-growing tables. This migration
adds the missing indexes:

  - price_snapshots (competitor_url_id, scraped_at DESC) — the signal read path
    (latest snapshot per competitor URL). Highest-impact index in the system.
  - skus (merchant_id)                       — every dashboard SKU listing.
  - competitor_urls (domain, url_path) UNIQUE — the get-or-create lookup run on
    every ingest; UNIQUE also enforces the implicit invariant the code relies on.
  - oos_alerts (competitor_tracking_id), (sku_id)
  - price_changes (sku_id), (signal_id)      — attribution / history reads.

Zero-downtime: every index is built with CREATE INDEX CONCURRENTLY inside an
autocommit block (CONCURRENTLY cannot run in a transaction), so no table is
locked against writes. All statements are IF NOT EXISTS / IF EXISTS so the
migration is safely re-runnable. Purely additive — no data or behavior changes.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0013"
down_revision: Union[str, None] = "0012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# (index name, table, columns, unique)
_INDEXES: list[tuple[str, str, list, bool]] = [
    ("ix_price_snapshots_curl_scraped", "price_snapshots",
     ["competitor_url_id", sa.text("scraped_at DESC")], False),
    ("ix_skus_merchant_id", "skus", ["merchant_id"], False),
    ("uq_competitor_urls_domain_path", "competitor_urls", ["domain", "url_path"], True),
    ("ix_oos_alerts_tracking_id", "oos_alerts", ["competitor_tracking_id"], False),
    ("ix_oos_alerts_sku_id", "oos_alerts", ["sku_id"], False),
    ("ix_price_changes_sku_id", "price_changes", ["sku_id"], False),
    ("ix_price_changes_signal_id", "price_changes", ["signal_id"], False),
]


def upgrade() -> None:
    # CONCURRENTLY requires running outside a transaction.
    with op.get_context().autocommit_block():
        for name, table, cols, unique in _INDEXES:
            op.create_index(
                name, table, cols,
                unique=unique,
                if_not_exists=True,
                postgresql_concurrently=True,
            )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        for name, table, _cols, _unique in reversed(_INDEXES):
            op.drop_index(
                name,
                table_name=table,
                if_exists=True,
                postgresql_concurrently=True,
            )
