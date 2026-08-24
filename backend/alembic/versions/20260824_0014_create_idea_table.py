"""create idea table; seed idea_roi_threshold_eur reference variable

Revision ID: 20260824_0014
Revises: 20260824_0013
Create Date: 2026-08-24 00:00:01.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260824_0014"
down_revision: str | None = "20260824_0013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "idea",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=300), nullable=False),
        sa.Column("submitter_name", sa.String(length=200), nullable=False),
        sa.Column("apqc_process_id", sa.Integer(), nullable=False),
        sa.Column("primary_goal", sa.String(length=60), nullable=False),
        sa.Column("process_stability", sa.String(length=60), nullable=False),
        sa.Column("system_stability", sa.String(length=60), nullable=False),
        sa.Column("task_frequency", sa.String(length=20), nullable=False),
        sa.Column("transaction_volume", sa.Numeric(14, 2), nullable=False),
        sa.Column("headcount_fte", sa.Numeric(10, 2), nullable=False),
        sa.Column("avg_time_per_task_minutes", sa.Numeric(10, 2), nullable=False),
        sa.Column("error_rate_pct", sa.Numeric(6, 3), nullable=False),
        sa.Column("avg_rework_time_minutes", sa.Numeric(10, 2), nullable=False),
        sa.Column("audit_rate_pct", sa.Numeric(6, 3), nullable=False),
        sa.Column("avg_loaded_fte_cost_eur", sa.Numeric(14, 2), nullable=False),
        sa.Column("number_of_steps", sa.String(length=20), nullable=False),
        sa.Column("decision_logic", sa.String(length=60), nullable=False),
        sa.Column("process_variations", sa.String(length=30), nullable=False),
        sa.Column("primary_input_format", sa.String(length=60), nullable=False),
        sa.Column("number_of_systems", sa.String(length=10), nullable=False),
        sa.Column("system_interface", sa.String(length=60), nullable=False),
        sa.Column("unstructured_data", sa.String(length=60), nullable=False),
        sa.Column("cognitive_reasoning", sa.String(length=60), nullable=False),
        sa.Column("computer_vision", sa.String(length=60), nullable=False),
        sa.Column("ai_output_risk", sa.String(length=60), nullable=False),
        sa.Column("annual_transactions", sa.Numeric(16, 2), nullable=False),
        sa.Column("base_hours", sa.Numeric(16, 2), nullable=False),
        sa.Column("rework_hours", sa.Numeric(16, 2), nullable=False),
        sa.Column("total_hours_saved", sa.Numeric(16, 2), nullable=False),
        sa.Column("gross_roi_eur", sa.Numeric(16, 2), nullable=False),
        sa.Column("feasibility_score", sa.Integer(), nullable=False),
        sa.Column("feasibility_band", sa.String(length=10), nullable=False),
        sa.Column("technology_category", sa.String(length=60), nullable=False),
        sa.Column("final_classification", sa.String(length=60), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="Submitted"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["apqc_process_id"], ["core.apqc_process.id"]),
        sa.PrimaryKeyConstraint("id"),
        schema="core",
    )
    op.create_index(
        op.f("ix_core_idea_apqc_process_id"),
        "idea",
        ["apqc_process_id"],
        unique=False,
        schema="core",
    )

    op.execute(
        """
        INSERT INTO core.reference_variable (name, value, note)
        VALUES (
            'idea_roi_threshold_eur',
            50000,
            'Default annual gross ROI threshold (EUR) used to classify a submitted '
            'idea as High vs Low ROI in the idea scoring engine.'
        )
        ON CONFLICT (name) DO NOTHING
        """
    )


def downgrade() -> None:
    op.execute("DELETE FROM core.reference_variable WHERE name = 'idea_roi_threshold_eur'")
    op.drop_index(op.f("ix_core_idea_apqc_process_id"), table_name="idea", schema="core")
    op.drop_table("idea", schema="core")
