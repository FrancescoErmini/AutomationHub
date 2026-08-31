from collections.abc import Callable
from pathlib import Path
from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.exceptions import AuthError, ForbiddenError
from app.core.security import TokenClaims, decode_token
from app.db.session import get_db
from app.models.auth import AppUser
from app.repositories.admin import AdminRepository
from app.repositories.analytics import AnalyticsRepository
from app.repositories.ideas import IdeaRepository
from app.repositories.items import ItemRepository
from app.services.admin import AdminService
from app.services.apqc import ApqcService
from app.services.executive import ExecutiveService
from app.services.ideas import IdeaService
from app.services.items import ItemService
from app.services.operations import OperationsService
from app.services.process_catalog import ProcessCatalogService
from app.services.process_economics import ProcessEconomicsService
from app.services.service_performance import ServicePerformanceService
from app.services.simple_ops import SimpleOpsService

DbSession = Annotated[Session, Depends(get_db)]


def get_item_service(session: DbSession) -> ItemService:
    return ItemService(ItemRepository(session))


ItemServiceDependency = Annotated[ItemService, Depends(get_item_service)]


def get_analytics_repository(session: DbSession) -> AnalyticsRepository:
    return AnalyticsRepository(session)


AnalyticsRepositoryDependency = Annotated[AnalyticsRepository, Depends(get_analytics_repository)]


def get_simple_ops_service(repo: AnalyticsRepositoryDependency) -> SimpleOpsService:
    return SimpleOpsService(repo)


SimpleOpsServiceDependency = Annotated[SimpleOpsService, Depends(get_simple_ops_service)]


def get_executive_service(
    repo: AnalyticsRepositoryDependency, simple_ops: SimpleOpsServiceDependency
) -> ExecutiveService:
    return ExecutiveService(repo, simple_ops)


def get_operations_service(repo: AnalyticsRepositoryDependency) -> OperationsService:
    return OperationsService(repo)


def get_process_catalog_service(repo: AnalyticsRepositoryDependency) -> ProcessCatalogService:
    return ProcessCatalogService(repo)


def get_process_economics_service(session: DbSession) -> ProcessEconomicsService:
    return ProcessEconomicsService(session)


ProcessEconomicsServiceDependency = Annotated[
    ProcessEconomicsService, Depends(get_process_economics_service)
]


def get_service_performance_service(
    repo: AnalyticsRepositoryDependency,
) -> ServicePerformanceService:
    return ServicePerformanceService(repo)


ExecutiveServiceDependency = Annotated[ExecutiveService, Depends(get_executive_service)]
OperationsServiceDependency = Annotated[OperationsService, Depends(get_operations_service)]
ProcessCatalogServiceDependency = Annotated[
    ProcessCatalogService, Depends(get_process_catalog_service)
]
ServicePerformanceServiceDependency = Annotated[
    ServicePerformanceService, Depends(get_service_performance_service)
]


def get_idea_repository(session: DbSession) -> IdeaRepository:
    return IdeaRepository(session)


IdeaRepositoryDependency = Annotated[IdeaRepository, Depends(get_idea_repository)]


def get_apqc_service(repo: IdeaRepositoryDependency) -> ApqcService:
    return ApqcService(repo)


def get_idea_service(repo: IdeaRepositoryDependency) -> IdeaService:
    return IdeaService(repo)


ApqcServiceDependency = Annotated[ApqcService, Depends(get_apqc_service)]
IdeaServiceDependency = Annotated[IdeaService, Depends(get_idea_service)]


def get_admin_repository(session: DbSession) -> AdminRepository:
    return AdminRepository(session)


def get_admin_service(
    session: DbSession, repo: Annotated[AdminRepository, Depends(get_admin_repository)]
) -> AdminService:
    return AdminService(session, repo)


AdminServiceDependency = Annotated[AdminService, Depends(get_admin_service)]


def get_rpa_workbook_path() -> Path:
    return get_settings().rpa_workbook_path


RpaWorkbookPathDependency = Annotated[Path, Depends(get_rpa_workbook_path)]


bearer_scheme = HTTPBearer(auto_error=False)

_PROFILE_FIELDS = ("email", "preferred_username", "name", "given_name", "family_name")


def _bootstrap_admin_emails() -> set[str]:
    raw = get_settings().bootstrap_admin_emails
    return {part.strip().lower() for part in raw.split(",") if part.strip()}


def _sync_profile(user: AppUser, claims: TokenClaims) -> bool:
    changed = False
    for field in _PROFILE_FIELDS:
        new_value = getattr(claims, field)
        if new_value is not None and getattr(user, field) != new_value:
            setattr(user, field, new_value)
            changed = True
    return changed


def _maybe_promote(user: AppUser, email: str | None) -> bool:
    if email and email.lower() in _bootstrap_admin_emails() and user.role != "admin":
        user.role = "admin"
        return True
    return False


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    session: DbSession,
) -> AppUser:
    if credentials is None:
        raise AuthError("Missing bearer token")
    claims = decode_token(credentials.credentials)

    user = session.scalar(select(AppUser).where(AppUser.sub == claims.sub))
    if user is None:
        user = AppUser(
            sub=claims.sub,
            email=claims.email,
            preferred_username=claims.preferred_username,
            name=claims.name,
            given_name=claims.given_name,
            family_name=claims.family_name,
            role="user",
        )
        _maybe_promote(user, claims.email)
        session.add(user)
        try:
            session.commit()
        except IntegrityError:
            session.rollback()
            user = session.scalar(select(AppUser).where(AppUser.sub == claims.sub))
            if user is None:
                raise
        else:
            session.refresh(user)
            return user

    changed = _sync_profile(user, claims)
    changed = _maybe_promote(user, claims.email) or changed
    if changed:
        session.commit()
        session.refresh(user)
    return user


CurrentUser = Annotated[AppUser, Depends(get_current_user)]


def require_role(*allowed: str) -> Callable[..., AppUser]:
    def dependency(user: CurrentUser) -> AppUser:
        if user.role == "admin" or user.role in allowed:
            return user
        raise ForbiddenError(f"Requires role: {' or '.join(allowed)}")

    return dependency


RequireEditor = Annotated[AppUser, Depends(require_role("editor"))]
