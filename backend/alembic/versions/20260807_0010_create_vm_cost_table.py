"""create vm_cost table, backfilled from license_cost at 0 eur

Revision ID: 20260807_0010
Revises: 20260806_0009
Create Date: 2026-08-07 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260807_0010"
down_revision: str | None = "20260806_0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "vm_cost",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("virtual_machine_id", sa.Integer(), nullable=False),
        sa.Column("cost_eur", sa.Numeric(14, 2), nullable=False),
        sa.ForeignKeyConstraint(["virtual_machine_id"], ["core.virtual_machine.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("year", "virtual_machine_id", name="uq_vm_cost_year_vm"),
        schema="core",
    )
    # No general VM opex source exists yet -- mirror every (year, VM) pair
    # already present in license_cost at 0 eur, matching license_cost's shape.
    op.execute(
        "INSERT INTO core.vm_cost (year, virtual_machine_id, cost_eur) "
        "SELECT DISTINCT year, virtual_machine_id, 0 FROM core.license_cost"
    )


def downgrade() -> None:
    op.drop_table("vm_cost", schema="core")
