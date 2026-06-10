"""tool_calculations — saved free-tool reports (Workspace persistence)

Revision ID: 0007
Revises: 0006
Create Date: 2026-06-04

Persists public-calculator runs so a logged-in free user can keep history,
reload a calculation into the tool, compare runs, and feed the Opportunity
Feed. No plan gate — available to every plan incl. `free`.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "tool_calculations",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("merchant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tool_name", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("inputs", postgresql.JSONB(), nullable=False),
        sa.Column("results", postgresql.JSONB(), nullable=False),
        sa.Column("currency", sa.String(), nullable=True),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["merchant_id"], ["merchants.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_tool_calculations_merchant_created",
        "tool_calculations",
        ["merchant_id", sa.text("created_at DESC")],
    )


def downgrade() -> None:
    op.drop_index("ix_tool_calculations_merchant_created", table_name="tool_calculations")
    op.drop_table("tool_calculations")
