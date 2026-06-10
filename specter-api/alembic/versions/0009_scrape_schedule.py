"""scrape schedule + ingest idempotency

Revision ID: 0009
Revises: 0008
Create Date: 2026-06-08

Adds the columns the production scraper needs:
  - price_snapshots.job_uuid  — UNIQUE idempotency key so a retried BullMQ job
    that re-POSTs the same result is absorbed by ON CONFLICT (job_uuid) DO NOTHING.
  - competitor_urls.{interval_ms, phase_offset_ms, next_run_at} — even-spread
    scheduling for the control-plane dispatcher, plus a partial index on
    next_run_at for the FOR UPDATE SKIP LOCKED claim query.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "0009"
down_revision: Union[str, None] = "0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "price_snapshots",
        sa.Column("job_uuid", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_unique_constraint(
        "uq_price_snapshots_job_uuid", "price_snapshots", ["job_uuid"]
    )

    op.add_column("competitor_urls", sa.Column("interval_ms", sa.BigInteger(), nullable=True))
    op.add_column("competitor_urls", sa.Column("phase_offset_ms", sa.BigInteger(), nullable=True))
    op.add_column(
        "competitor_urls",
        sa.Column("next_run_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_curls_next_run",
        "competitor_urls",
        ["next_run_at"],
        postgresql_where=sa.text("next_run_at IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("ix_curls_next_run", table_name="competitor_urls")
    op.drop_column("competitor_urls", "next_run_at")
    op.drop_column("competitor_urls", "phase_offset_ms")
    op.drop_column("competitor_urls", "interval_ms")
    op.drop_constraint("uq_price_snapshots_job_uuid", "price_snapshots", type_="unique")
    op.drop_column("price_snapshots", "job_uuid")
