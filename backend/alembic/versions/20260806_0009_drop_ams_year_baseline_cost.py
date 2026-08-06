"""drop ams_year baseline, cost columns (duplicated by ams_1l_cost)

Revision ID: 20260806_0009
Revises: 20260806_0008
Create Date: 2026-08-06 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260806_0009"
down_revision: str | None = "20260806_0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_column("ams_year", "cost", schema="core")
    op.drop_column("ams_year", "baseline", schema="core")


def downgrade() -> None:
    op.add_column("ams_year", sa.Column("baseline", sa.Integer(), nullable=True), schema="core")
    op.add_column(
        "ams_year", sa.Column("cost", sa.Numeric(14, 2), nullable=True), schema="core"
    )
