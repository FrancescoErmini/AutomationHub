from pathlib import Path
from typing import Annotated

from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import get_db
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
from app.services.roi import RoiService
from app.services.service_performance import ServicePerformanceService
from app.services.simple_ops import SimpleOpsService

DbSession = Annotated[Session, Depends(get_db)]


def get_item_service(session: DbSession) -> ItemService:
    return ItemService(ItemRepository(session))


ItemServiceDependency = Annotated[ItemService, Depends(get_item_service)]


def get_analytics_repository(session: DbSession) -> AnalyticsRepository:
    return AnalyticsRepository(session)


AnalyticsRepositoryDependency = Annotated[AnalyticsRepository, Depends(get_analytics_repository)]


def get_executive_service(repo: AnalyticsRepositoryDependency) -> ExecutiveService:
    return ExecutiveService(repo)


def get_operations_service(repo: AnalyticsRepositoryDependency) -> OperationsService:
    return OperationsService(repo)


def get_roi_service(repo: AnalyticsRepositoryDependency) -> RoiService:
    return RoiService(repo)


def get_process_catalog_service(repo: AnalyticsRepositoryDependency) -> ProcessCatalogService:
    return ProcessCatalogService(repo)


def get_service_performance_service(
    repo: AnalyticsRepositoryDependency,
) -> ServicePerformanceService:
    return ServicePerformanceService(repo)


def get_simple_ops_service(repo: AnalyticsRepositoryDependency) -> SimpleOpsService:
    return SimpleOpsService(repo)


ExecutiveServiceDependency = Annotated[ExecutiveService, Depends(get_executive_service)]
OperationsServiceDependency = Annotated[OperationsService, Depends(get_operations_service)]
RoiServiceDependency = Annotated[RoiService, Depends(get_roi_service)]
ProcessCatalogServiceDependency = Annotated[
    ProcessCatalogService, Depends(get_process_catalog_service)
]
ServicePerformanceServiceDependency = Annotated[
    ServicePerformanceService, Depends(get_service_performance_service)
]
SimpleOpsServiceDependency = Annotated[SimpleOpsService, Depends(get_simple_ops_service)]


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
