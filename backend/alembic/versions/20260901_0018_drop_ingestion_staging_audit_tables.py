"""drop ingestion staging / audit tables

Drops everything left behind by the removed Excel/CSV ingestion subsystem
(commit "remove Excel/CSV ingestion subsystem and its data files"):

* the whole ``staging`` schema (15 raw workbook-dump tables)
* the whole ``audit`` schema (ingestion_batch, data_quality_issue,
  relationship_reconciliation)
* ``core.value_normalization`` (ingestion normalization audit trail)
* the ``analytics`` schema and its lone ``ticket_enriched`` view, which no
  repository ever queried -- AnalyticsRepository builds every query from
  ``core.*`` directly
* the orphan ``public.items`` table from the initial scaffold (its model was
  already deleted)

Nothing reads or writes any of these tables; they still hold the raw rows and
audit trail from the last ingestion run before the subsystem was removed.
``downgrade`` recreates the structures empty -- the discarded rows are not
recoverable from the repo, only from a database backup.

Revision ID: 20260901_0018
Revises: 20260828_0017
Create Date: 2026-09-01
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260901_0018"
down_revision: str | None = "20260828_0017"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# staging.* table names (all share the same raw-row column shape)
_STAGING_TABLES: tuple[str, ...] = (
    "pid",
    "pipeline",
    "tickets",
    "tickets_out",
    "schedules",
    "economics",
    "tco",
    "ams_1l",
    "ams_2l",
    "ams_rfc",
    "ams_sms",
    "ams_sla",
    "licenses",
    "vms",
    "variables",
)

_TICKET_ENRICHED_VIEW = """
CREATE VIEW analytics.ticket_enriched AS
SELECT
    t.id,
    t.ticket_id,
    t.ticket_type,
    t.is_1l,
    t.start_date,
    t.end_date,
    t.process_id,
    p.canonical_name AS process_name,
    t.company_id,
    c.name AS company_name,
    t.root_cause_id,
    rc.name AS root_cause_name
FROM core.ticket t
LEFT JOIN core.process p ON p.id = t.process_id
LEFT JOIN core.company c ON c.id = t.company_id
LEFT JOIN core.root_cause rc ON rc.id = t.root_cause_id
"""


def upgrade() -> None:
    # CASCADE mops up the FKs pointing at audit.ingestion_batch from the staging
    # tables and core.value_normalization.
    op.execute("DROP TABLE IF EXISTS core.value_normalization CASCADE")
    op.execute("DROP SCHEMA IF EXISTS staging CASCADE")
    op.execute("DROP SCHEMA IF EXISTS audit CASCADE")
    op.execute("DROP SCHEMA IF EXISTS analytics CASCADE")
    op.execute("DROP TABLE IF EXISTS items CASCADE")


def downgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS audit")
    op.execute("CREATE SCHEMA IF NOT EXISTS staging")
    op.execute("CREATE SCHEMA IF NOT EXISTS analytics")

    op.create_table(
        "ingestion_batch",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("source_file", sa.String(length=500), nullable=False),
        sa.Column("source_hash", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("total_rows", sa.Integer(), nullable=False),
        sa.Column("valid_rows", sa.Integer(), nullable=False),
        sa.Column("rejected_rows", sa.Integer(), nullable=False),
        sa.Column(
            "started_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        schema="audit",
    )
    op.create_index(
        op.f("ix_audit_ingestion_batch_source_hash"),
        "ingestion_batch",
        ["source_hash"],
        unique=False,
        schema="audit",
    )
    op.create_table(
        "data_quality_issue",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("ingestion_batch_id", sa.Integer(), nullable=False),
        sa.Column("source_sheet", sa.String(length=60), nullable=False),
        sa.Column("source_row_number", sa.Integer(), nullable=True),
        sa.Column("entity", sa.String(length=60), nullable=False),
        sa.Column("issue_type", sa.String(length=80), nullable=False),
        sa.Column("severity", sa.String(length=20), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.ForeignKeyConstraint(["ingestion_batch_id"], ["audit.ingestion_batch.id"]),
        sa.PrimaryKeyConstraint("id"),
        schema="audit",
    )
    op.create_index(
        op.f("ix_audit_data_quality_issue_ingestion_batch_id"),
        "data_quality_issue",
        ["ingestion_batch_id"],
        unique=False,
        schema="audit",
    )
    op.create_table(
        "relationship_reconciliation",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("ingestion_batch_id", sa.Integer(), nullable=False),
        sa.Column("relationship_name", sa.String(length=80), nullable=False),
        sa.Column("total_rows", sa.Integer(), nullable=False),
        sa.Column("matched_rows", sa.Integer(), nullable=False),
        sa.Column("unmatched_rows", sa.Integer(), nullable=False),
        sa.Column("duplicate_candidates", sa.Integer(), nullable=False),
        sa.Column("match_pct", sa.Numeric(precision=6, scale=3), nullable=False),
        sa.Column("threshold_pct", sa.Numeric(precision=6, scale=3), nullable=False),
        sa.Column("sample_unmatched", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "computed_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["ingestion_batch_id"], ["audit.ingestion_batch.id"]),
        sa.PrimaryKeyConstraint("id"),
        schema="audit",
    )
    op.create_index(
        op.f("ix_audit_relationship_reconciliation_ingestion_batch_id"),
        "relationship_reconciliation",
        ["ingestion_batch_id"],
        unique=False,
        schema="audit",
    )

    op.create_table(
        "value_normalization",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("ingestion_batch_id", sa.Integer(), nullable=True),
        sa.Column("entity", sa.String(length=60), nullable=False),
        sa.Column("source_sheet", sa.String(length=60), nullable=False),
        sa.Column("source_row_number", sa.Integer(), nullable=True),
        sa.Column("original_value", sa.Text(), nullable=False),
        sa.Column("normalized_value", sa.Text(), nullable=False),
        sa.Column("method", sa.String(length=60), nullable=False),
        sa.Column("confidence", sa.Numeric(precision=4, scale=3), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.ForeignKeyConstraint(["ingestion_batch_id"], ["audit.ingestion_batch.id"]),
        sa.PrimaryKeyConstraint("id"),
        schema="core",
    )
    op.create_index(
        op.f("ix_core_value_normalization_ingestion_batch_id"),
        "value_normalization",
        ["ingestion_batch_id"],
        unique=False,
        schema="core",
    )

    for table in _STAGING_TABLES:
        op.create_table(
            table,
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("ingestion_batch_id", sa.Integer(), nullable=False),
            sa.Column("source_file", sa.String(length=500), nullable=False),
            sa.Column("source_sheet", sa.String(length=60), nullable=False),
            sa.Column("source_row_number", sa.Integer(), nullable=False),
            sa.Column("source_hash", sa.String(length=64), nullable=False),
            sa.Column("validation_status", sa.String(length=20), nullable=False),
            sa.Column("rejection_reason", sa.Text(), nullable=True),
            sa.Column("raw_row", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.ForeignKeyConstraint(["ingestion_batch_id"], ["audit.ingestion_batch.id"]),
            sa.PrimaryKeyConstraint("id"),
            schema="staging",
        )
        op.create_index(
            op.f(f"ix_staging_{table}_ingestion_batch_id"),
            table,
            ["ingestion_batch_id"],
            unique=False,
            schema="staging",
        )
        op.create_index(
            op.f(f"ix_staging_{table}_source_hash"),
            table,
            ["source_hash"],
            unique=False,
            schema="staging",
        )

    op.execute(_TICKET_ENRICHED_VIEW)

    op.create_table(
        "items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name", name="uq_items_name"),
    )
