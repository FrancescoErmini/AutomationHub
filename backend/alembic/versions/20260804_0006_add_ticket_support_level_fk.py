"""add ticket support level fk

Revision ID: 20260804_0006
Revises: 20260804_0005
Create Date: 2026-08-04 14:34:36.739463
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260804_0006"
down_revision: str | None = "20260804_0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "ticket", sa.Column("support_level_id", sa.Integer(), nullable=True), schema="core"
    )
    op.create_foreign_key(
        "fk_ticket_support_level_id",
        "ticket",
        "support_level",
        ["support_level_id"],
        ["id"],
        source_schema="core",
        referent_schema="core",
    )


def downgrade() -> None:
    op.drop_constraint("fk_ticket_support_level_id", "ticket", schema="core", type_="foreignkey")
    op.drop_column("ticket", "support_level_id", schema="core")
