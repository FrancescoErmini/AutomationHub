"""add ams_year year, baseline, cost columns

Revision ID: 20260806_0008
Revises: 20260804_0007
Create Date: 2026-08-06 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260806_0008"
down_revision: str | None = "20260804_0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_SEED_VALUES = (
    (1, 2024, 42, 45000),
    (2, 2025, 54, 60000),
    (3, 2026, 62, 70800),
)


def upgrade() -> None:
    op.add_column("ams_year", sa.Column("year", sa.Integer(), nullable=True), schema="core")
    op.add_column("ams_year", sa.Column("baseline", sa.Integer(), nullable=True), schema="core")
    op.add_column(
        "ams_year", sa.Column("cost", sa.Numeric(14, 2), nullable=True), schema="core"
    )

    ams_year = sa.table(
        "ams_year",
        sa.column("id", sa.Integer()),
        sa.column("year", sa.Integer()),
        sa.column("baseline", sa.Integer()),
        sa.column("cost", sa.Numeric(14, 2)),
        schema="core",
    )
    conn = op.get_bind()
    for id_, year, baseline, cost in _SEED_VALUES:
        conn.execute(
            ams_year.update()
            .where(ams_year.c.id == id_)
            .values(year=year, baseline=baseline, cost=cost)
        )


def downgrade() -> None:
    op.drop_column("ams_year", "cost", schema="core")
    op.drop_column("ams_year", "baseline", schema="core")
    op.drop_column("ams_year", "year", schema="core")
