"""create ams_rfc_cost table

Revision ID: 20260807_0012
Revises: 20260807_0011
Create Date: 2026-08-07 00:00:02.000000

Originally this migration also seeded core.ams_rfc_cost from
data/raw/RPA_AMS_RFC_Amendment.csv via the Excel/CSV ingestion package. That
package and its source files were removed in the 2026-08-31 repository cleanup;
the table is now created empty and populated through sqladmin like every other
core table.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260807_0012"
down_revision: str | None = "20260807_0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "ams_rfc_cost",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("process_id", sa.Integer(), nullable=True),
        sa.Column("rfc_ref", sa.String(length=120), nullable=True),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("man_days", sa.Numeric(10, 2), nullable=True),
        sa.Column("root_cause_raw", sa.Text(), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("cost_eur", sa.Numeric(14, 2), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["process_id"], ["core.process.id"]),
        sa.PrimaryKeyConstraint("id"),
        schema="core",
    )
    op.create_index(
        op.f("ix_core_ams_rfc_cost_process_id"),
        "ams_rfc_cost",
        ["process_id"],
        unique=False,
        schema="core",
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_core_ams_rfc_cost_process_id"), table_name="ams_rfc_cost", schema="core")
    op.drop_table("ams_rfc_cost", schema="core")
