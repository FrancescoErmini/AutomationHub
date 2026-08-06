from fastapi import APIRouter, Query, status

from app.dependencies import AdminServiceDependency, RpaWorkbookPathDependency
from app.schemas.admin import (
    DataQualityIssueRead,
    IngestionBatchRead,
    IngestionRunResponse,
    RelationshipCheckRead,
)

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/ingestion", response_model=IngestionRunResponse, status_code=status.HTTP_201_CREATED)
def trigger_ingestion(
    service: AdminServiceDependency, workbook_path: RpaWorkbookPathDependency
) -> IngestionRunResponse:
    summary = service.trigger_ingestion(workbook_path)
    return IngestionRunResponse(
        batch_id=summary.staging.batch_id,
        total_rows=summary.staging.total_rows,
        valid_rows=summary.staging.valid_rows,
        rejected_rows=summary.staging.rejected_rows,
        core_counts=summary.core.counts,
        relationships=[
            RelationshipCheckRead.model_validate(check) for check in summary.relationships
        ],
    )


@router.get("/ingestion/{batch_id}", response_model=IngestionBatchRead)
def get_ingestion_batch(batch_id: int, service: AdminServiceDependency) -> IngestionBatchRead:
    return IngestionBatchRead.model_validate(service.get_batch(batch_id))


@router.get("/relationships", response_model=list[RelationshipCheckRead])
def get_relationships(
    service: AdminServiceDependency, batch_id: int | None = Query(default=None)
) -> list[RelationshipCheckRead]:
    return [
        RelationshipCheckRead.model_validate(row) for row in service.get_relationships(batch_id)
    ]


@router.get("/data-quality", response_model=list[DataQualityIssueRead])
def get_data_quality(
    service: AdminServiceDependency, batch_id: int | None = Query(default=None)
) -> list[DataQualityIssueRead]:
    return [
        DataQualityIssueRead.model_validate(issue)
        for issue in service.get_data_quality_issues(batch_id)
    ]
