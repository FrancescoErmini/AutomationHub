"""widen process schedule free text columns

Revision ID: 20260804_0007
Revises: 20260804_0006
Create Date: 2026-08-04 14:46:47.926586
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260804_0007"
down_revision: str | None = "20260804_0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column(
        "process_schedule",
        "frequency",
        existing_type=sa.VARCHAR(length=200),
        type_=sa.Text(),
        existing_nullable=True,
        schema="core",
    )
    op.alter_column(
        "process_schedule",
        "run_time",
        existing_type=sa.VARCHAR(length=20),
        type_=sa.Text(),
        existing_nullable=True,
        schema="core",
    )


def downgrade() -> None:
    op.alter_column(
        "process_schedule",
        "run_time",
        existing_type=sa.Text(),
        type_=sa.VARCHAR(length=20),
        existing_nullable=True,
        schema="core",
    )
    op.alter_column(
        "process_schedule",
        "frequency",
        existing_type=sa.Text(),
        type_=sa.VARCHAR(length=200),
        existing_nullable=True,
        schema="core",
    )
