"""create apqc taxonomy tables (category, process_group, process)

Revision ID: 20260824_0013
Revises: 20260807_0012
Create Date: 2026-08-24 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260824_0013"
down_revision: str | None = "20260807_0012"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "apqc_category",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("pcf_id", sa.Integer(), nullable=False),
        sa.Column("hierarchy_id", sa.String(length=20), nullable=False),
        sa.Column("name", sa.String(length=300), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("pcf_id"),
        sa.UniqueConstraint("hierarchy_id"),
        schema="core",
    )
    op.create_index(
        op.f("ix_core_apqc_category_pcf_id"),
        "apqc_category",
        ["pcf_id"],
        unique=True,
        schema="core",
    )

    op.create_table(
        "apqc_process_group",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("pcf_id", sa.Integer(), nullable=False),
        sa.Column("hierarchy_id", sa.String(length=20), nullable=False),
        sa.Column("name", sa.String(length=300), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("category_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["category_id"], ["core.apqc_category.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("pcf_id"),
        sa.UniqueConstraint("hierarchy_id"),
        schema="core",
    )
    op.create_index(
        op.f("ix_core_apqc_process_group_pcf_id"),
        "apqc_process_group",
        ["pcf_id"],
        unique=True,
        schema="core",
    )
    op.create_index(
        op.f("ix_core_apqc_process_group_category_id"),
        "apqc_process_group",
        ["category_id"],
        unique=False,
        schema="core",
    )

    op.create_table(
        "apqc_process",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("pcf_id", sa.Integer(), nullable=False),
        sa.Column("hierarchy_id", sa.String(length=20), nullable=False),
        sa.Column("name", sa.String(length=300), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("process_group_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["process_group_id"], ["core.apqc_process_group.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("pcf_id"),
        sa.UniqueConstraint("hierarchy_id"),
        schema="core",
    )
    op.create_index(
        op.f("ix_core_apqc_process_pcf_id"),
        "apqc_process",
        ["pcf_id"],
        unique=True,
        schema="core",
    )
    op.create_index(
        op.f("ix_core_apqc_process_process_group_id"),
        "apqc_process",
        ["process_group_id"],
        unique=False,
        schema="core",
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_core_apqc_process_process_group_id"),
        table_name="apqc_process",
        schema="core",
    )
    op.drop_index(op.f("ix_core_apqc_process_pcf_id"), table_name="apqc_process", schema="core")
    op.drop_table("apqc_process", schema="core")

    op.drop_index(
        op.f("ix_core_apqc_process_group_category_id"),
        table_name="apqc_process_group",
        schema="core",
    )
    op.drop_index(
        op.f("ix_core_apqc_process_group_pcf_id"), table_name="apqc_process_group", schema="core"
    )
    op.drop_table("apqc_process_group", schema="core")

    op.drop_index(op.f("ix_core_apqc_category_pcf_id"), table_name="apqc_category", schema="core")
    op.drop_table("apqc_category", schema="core")
