"""add core.process.documentation_url

Adds a nullable column holding the link to a process's functional
documentation (a Google Drive folder). Populated out-of-band from
``data/docs.csv`` by ``scripts/import_documentation_urls.py``; left NULL
for processes with no documentation link.

Revision ID: 20260901_0019
Revises: 20260901_0018
Create Date: 2026-09-01
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260901_0019"
down_revision: str | None = "20260901_0018"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "process",
        sa.Column("documentation_url", sa.String(length=1000), nullable=True),
        schema="core",
    )


def downgrade() -> None:
    op.drop_column("process", "documentation_url", schema="core")
