"""create application table and process_application link table

Revision ID: 20260824_0015
Revises: 20260824_0014
Create Date: 2026-08-24 00:00:02.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260824_0015"
down_revision: str | None = "20260824_0014"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "application",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
        schema="core",
    )

    op.create_table(
        "process_application",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("process_id", sa.Integer(), nullable=False),
        sa.Column("application_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["process_id"], ["core.process.id"]),
        sa.ForeignKeyConstraint(["application_id"], ["core.application.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("process_id", "application_id", name="uq_process_application"),
        schema="core",
    )
    op.create_index(
        op.f("ix_core_process_application_process_id"),
        "process_application",
        ["process_id"],
        unique=False,
        schema="core",
    )
    op.create_index(
        op.f("ix_core_process_application_application_id"),
        "process_application",
        ["application_id"],
        unique=False,
        schema="core",
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_core_process_application_application_id"),
        table_name="process_application",
        schema="core",
    )
    op.drop_index(
        op.f("ix_core_process_application_process_id"),
        table_name="process_application",
        schema="core",
    )
    op.drop_table("process_application", schema="core")
    op.drop_table("application", schema="core")
