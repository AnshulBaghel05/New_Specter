"""processed_webhook_events: Razorpay webhook idempotency ledger

Revision ID: 0014
Revises: 0013
Create Date: 2026-06-16

Razorpay redelivers a webhook (same X-Razorpay-Event-Id) until it receives a 2xx,
so the same event can arrive multiple times. This table records each processed
event id so POST /billing/webhook can short-circuit a redelivery before re-running
any work or re-hitting the Razorpay API. The UNIQUE constraint on event_id also
makes concurrent duplicate deliveries collide at the DB rather than both running.
"""
from __future__ import annotations
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0014"
down_revision: Union[str, None] = "0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "processed_webhook_events",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True),
                  server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
        sa.Column("event_id", sa.String(), nullable=False),
        sa.Column("event_type", sa.String(), nullable=True),
        sa.UniqueConstraint("event_id", name="uq_processed_webhook_events_event_id"),
    )


def downgrade() -> None:
    op.drop_table("processed_webhook_events")
