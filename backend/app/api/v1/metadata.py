from fastapi import APIRouter

from app.dependencies import AnalyticsRepositoryDependency
from app.schemas.analytics import FilterOptions

router = APIRouter(prefix="/metadata", tags=["metadata"])


@router.get("/filters", response_model=FilterOptions)
def get_filters(repo: AnalyticsRepositoryDependency) -> FilterOptions:
    return FilterOptions(companies=repo.companies())
