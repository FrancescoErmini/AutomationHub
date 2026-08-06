"""Create analytics.ticket_enriched view.

Revision ID: 20260804_0004
Revises: 20260804_0003
Create Date: 2026-08-04
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20260804_0004"
down_revision: str | None = "20260804_0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

CREATE_VIEW = """
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

DROP_VIEW = "DROP VIEW analytics.ticket_enriched"


def upgrade() -> None:
    op.execute(CREATE_VIEW)


def downgrade() -> None:
    op.execute(DROP_VIEW)
