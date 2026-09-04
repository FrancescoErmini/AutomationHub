"""Move app_user table from public to automation_hub schema.

Revision ID: 20260904_0022
Revises: 20260904_0021
Create Date: 2026-09-04
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20260904_0022"
down_revision: str | None = "20260904_0021"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TABLE public.app_user SET SCHEMA automation_hub")


def downgrade() -> None:
    op.execute("ALTER TABLE automation_hub.app_user SET SCHEMA public")
