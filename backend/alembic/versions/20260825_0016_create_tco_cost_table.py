"""create tco_cost table

Revision ID: 20260825_0016
Revises: 20260824_0015
Create Date: 2026-08-25 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260825_0016"
down_revision: str | None = "20260824_0015"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "tco_cost",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("cost_date", sa.Date(), nullable=False),
        sa.Column("cost_eur", sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column("cost_type", sa.String(length=10), nullable=False),
        sa.Column("subtype", sa.String(length=60), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        schema="core",
    )
    op.create_index(
        op.f("ix_core_tco_cost_cost_date"),
        "tco_cost",
        ["cost_date"],
        unique=False,
        schema="core",
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_core_tco_cost_cost_date"), table_name="tco_cost", schema="core")
    op.drop_table("tco_cost", schema="core")
