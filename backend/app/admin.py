"""SQLAdmin integration: a session-authenticated admin panel over every model."""

from fastapi import FastAPI
from sqladmin import Admin, ModelView
from sqladmin.authentication import AuthenticationBackend
from sqladmin.models import ModelViewMeta
from sqlalchemy.engine import Engine
from starlette.requests import Request

import app.models as models  # noqa: F401  ensures every model is registered on Base before scanning
from app.core.config import get_settings
from app.db.base import Base

SESSION_KEY = "admin_authenticated"


class AdminAuth(AuthenticationBackend):
    async def login(self, request: Request) -> bool:
        form = await request.form()
        username, password = form.get("username"), form.get("password")

        settings = get_settings()
        if username != settings.admin_username or password != settings.admin_password:
            return False

        request.session[SESSION_KEY] = True
        return True

    async def logout(self, request: Request) -> bool:
        request.session.clear()
        return True

    async def authenticate(self, request: Request) -> bool:
        return bool(request.session.get(SESSION_KEY))


def _model_views() -> list[type[ModelView]]:
    """Build a ModelView for every mapped SQLAlchemy model, no per-table classes needed."""
    views = []
    for model in Base.__subclasses__():
        view = ModelViewMeta(
            f"{model.__name__}Admin",
            (ModelView,),
            {"column_list": "__all__"},
            model=model,
        )
        views.append(view)
    return views


def setup_admin(app: FastAPI, engine: Engine) -> Admin:
    settings = get_settings()
    admin = Admin(
        app=app,
        engine=engine,
        authentication_backend=AdminAuth(secret_key=settings.admin_secret_key),
    )
    for view in _model_views():
        admin.add_view(view)
    return admin
