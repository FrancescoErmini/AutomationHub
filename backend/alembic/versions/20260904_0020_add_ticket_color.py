"""add core.ticket.ticket_color

Adds a nullable column holding a per-ticket label colour used to tint the
Ticket ID cell in the tickets table. NULL (the default) means "no colour"
-- the cell keeps its normal background. When set, the value is one of a
fixed 8-colour rainbow palette (see ``app.schemas.ticket.TICKET_COLORS``).

Revision ID: 20260904_0020
Revises: 20260901_0019
Create Date: 2026-09-04
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260904_0020"
down_revision: str | None = "20260901_0019"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "ticket",
        sa.Column("ticket_color", sa.String(length=7), nullable=True),
        schema="core",
    )


def downgrade() -> None:
    op.drop_column("ticket", "ticket_color", schema="core")
