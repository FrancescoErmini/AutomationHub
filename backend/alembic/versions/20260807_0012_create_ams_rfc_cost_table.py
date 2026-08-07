"""create ams_rfc_cost table, seeded from data/raw/RPA_AMS_RFC_Amendment.csv

Revision ID: 20260807_0012
Revises: 20260807_0011
Create Date: 2026-08-07 00:00:02.000000
"""

from collections.abc import Sequence
from pathlib import Path

import sqlalchemy as sa
from sqlalchemy.orm import Session

from alembic import op

revision: str = "20260807_0012"
down_revision: str | None = "20260807_0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_CSV_PATH = Path(__file__).resolve().parents[3] / "data" / "raw" / "RPA_AMS_RFC_Amendment.csv"


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

    # Imported lazily: importing app.ingestion at module load time would make
    # every alembic invocation (including offline/--sql mode) depend on the
    # full app package being importable.
    from app.ingestion.ams_rfc_csv_loader import load_ams_rfc_costs_from_csv

    if _CSV_PATH.exists():
        with Session(bind=op.get_bind()) as session:
            load_ams_rfc_costs_from_csv(session, _CSV_PATH)
            session.commit()


def downgrade() -> None:
    op.drop_index(op.f("ix_core_ams_rfc_cost_process_id"), table_name="ams_rfc_cost", schema="core")
    op.drop_table("ams_rfc_cost", schema="core")
