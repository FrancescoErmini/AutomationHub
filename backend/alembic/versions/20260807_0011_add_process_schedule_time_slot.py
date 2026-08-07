"""add process_schedule.time_slot, default 'morning'

Revision ID: 20260807_0011
Revises: 20260807_0010
Create Date: 2026-08-07 00:00:01.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260807_0011"
down_revision: str | None = "20260807_0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # No time-slot source column exists yet -- default every existing and
    # future row to 'morning' until real values are back-filled per row.
    op.add_column(
        "process_schedule",
        sa.Column("time_slot", sa.String(length=20), nullable=False, server_default="morning"),
        schema="core",
    )


def downgrade() -> None:
    op.drop_column("process_schedule", "time_slot", schema="core")
