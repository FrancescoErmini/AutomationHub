"""Rename core schema to automation_hub.

Revision ID: 20260904_0021
Revises: 20260904_0020
Create Date: 2026-09-04
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20260904_0021"
down_revision: str | None = "20260904_0020"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER SCHEMA core RENAME TO automation_hub")


def downgrade() -> None:
    op.execute("ALTER SCHEMA automation_hub RENAME TO core")
