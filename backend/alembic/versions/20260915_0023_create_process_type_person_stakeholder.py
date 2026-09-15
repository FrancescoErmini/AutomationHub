"""create process_type, person, process_stakeholder; add process.process_type_id

Revision ID: 20260915_0023
Revises: 20260904_0022
Create Date: 2026-09-15
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260915_0023"
down_revision: str | None = "20260904_0022"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "automation_hub"


def upgrade() -> None:
    op.create_table(
        "process_type",
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
        schema=SCHEMA,
    )

    op.create_table(
        "person",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        schema=SCHEMA,
    )
    op.create_index(
        op.f("ix_automation_hub_person_email"),
        "person",
        ["email"],
        unique=True,
        schema=SCHEMA,
    )

    op.add_column(
        "process",
        sa.Column("process_type_id", sa.Integer(), nullable=True),
        schema=SCHEMA,
    )
    op.create_foreign_key(
        "process_process_type_id_fkey",
        "process",
        "process_type",
        ["process_type_id"],
        ["id"],
        source_schema=SCHEMA,
        referent_schema=SCHEMA,
    )

    op.create_table(
        "process_stakeholder",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("process_id", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(length=40), nullable=False),
        sa.Column("person_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["process_id"], [f"{SCHEMA}.process.id"]),
        sa.ForeignKeyConstraint(["person_id"], [f"{SCHEMA}.person.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("process_id", "role", "person_id", name="uq_process_stakeholder"),
        schema=SCHEMA,
    )
    op.create_index(
        op.f("ix_automation_hub_process_stakeholder_process_id"),
        "process_stakeholder",
        ["process_id"],
        unique=False,
        schema=SCHEMA,
    )
    op.create_index(
        op.f("ix_automation_hub_process_stakeholder_person_id"),
        "process_stakeholder",
        ["person_id"],
        unique=False,
        schema=SCHEMA,
    )
    op.create_index(
        op.f("ix_automation_hub_process_stakeholder_role"),
        "process_stakeholder",
        ["role"],
        unique=False,
        schema=SCHEMA,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_automation_hub_process_stakeholder_role"),
        table_name="process_stakeholder",
        schema=SCHEMA,
    )
    op.drop_index(
        op.f("ix_automation_hub_process_stakeholder_person_id"),
        table_name="process_stakeholder",
        schema=SCHEMA,
    )
    op.drop_index(
        op.f("ix_automation_hub_process_stakeholder_process_id"),
        table_name="process_stakeholder",
        schema=SCHEMA,
    )
    op.drop_table("process_stakeholder", schema=SCHEMA)

    op.drop_constraint("process_process_type_id_fkey", "process", schema=SCHEMA, type_="foreignkey")
    op.drop_column("process", "process_type_id", schema=SCHEMA)

    op.drop_index(
        op.f("ix_automation_hub_person_email"),
        table_name="person",
        schema=SCHEMA,
    )
    op.drop_table("person", schema=SCHEMA)

    op.drop_table("process_type", schema=SCHEMA)
