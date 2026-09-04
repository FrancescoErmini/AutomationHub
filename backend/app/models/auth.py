from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.core import SCHEMA


class AppUser(Base):
    """A person who has signed in via Keycloak. Provisioned just-in-time on the
    first authenticated request with role ``user``; an administrator promotes to
    ``editor`` / ``admin`` via SQLAdmin. Keycloak owns identity, this table owns
    the application role."""

    __tablename__ = "app_user"
    __table_args__ = (
        CheckConstraint("role IN ('user', 'editor', 'admin')", name="ck_app_user_role"),
        {"schema": SCHEMA},
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    sub: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    email: Mapped[str | None] = mapped_column(String(320), index=True, nullable=True)
    preferred_username: Mapped[str | None] = mapped_column(String(255), nullable=True)
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    given_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    family_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    role: Mapped[str] = mapped_column(String(20), default="user", server_default="user")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
