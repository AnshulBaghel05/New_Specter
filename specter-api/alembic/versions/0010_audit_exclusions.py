"""compliance: domain exclusions + append-only scrape audit

Revision ID: 0010
Revises: 0009
Create Date: 2026-06-08

Adds:
  - domain_exclusions — operator-level kill switch (legal/abuse takedowns). The
    scraper checks this before any fetch; ingest refuses excluded domains.
  - scrape_audit — append-only one-row-per-fetch trail (domain, status,
    robots_decision, proxy_tier, ts) for compliance/abuse questions.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0010"
down_revision: Union[str, None] = "0009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "domain_exclusions",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True),
                  server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
        sa.Column("domain", sa.String(), nullable=False),
        sa.Column("reason", sa.String(), nullable=True),
    )
    op.create_index("ix_domain_exclusions_domain", "domain_exclusions", ["domain"], unique=True)

    op.create_table(
        "scrape_audit",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True),
                  server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
        sa.Column("domain", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("robots_decision", sa.String(), nullable=True),
        sa.Column("proxy_tier", sa.String(), nullable=True),
    )
    op.create_index("ix_scrape_audit_domain_created", "scrape_audit", ["domain", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_scrape_audit_domain_created", table_name="scrape_audit")
    op.drop_table("scrape_audit")
    op.drop_index("ix_domain_exclusions_domain", table_name="domain_exclusions")
    op.drop_table("domain_exclusions")
