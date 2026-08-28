"""create app_user table

Revision ID: 20260828_0017
Revises: 20260825_0016
Create Date: 2026-08-28 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260828_0017"
down_revision: str | None = "20260825_0016"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "app_user",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("sub", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=True),
        sa.Column("preferred_username", sa.String(length=255), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=True),
        sa.Column("given_name", sa.String(length=255), nullable=True),
        sa.Column("family_name", sa.String(length=255), nullable=True),
        sa.Column("role", sa.String(length=20), nullable=False, server_default="user"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("role IN ('user', 'editor', 'admin')", name="ck_app_user_role"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_app_user_sub"), "app_user", ["sub"], unique=True)
    op.create_index(op.f("ix_app_user_email"), "app_user", ["email"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_app_user_email"), table_name="app_user")
    op.drop_index(op.f("ix_app_user_sub"), table_name="app_user")
    op.drop_table("app_user")
