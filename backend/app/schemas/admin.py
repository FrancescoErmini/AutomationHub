from datetime import datetime

from pydantic import BaseModel, ConfigDict, computed_field


class IngestionBatchRead(BaseModel):
    id: int
    source_file: str
    source_hash: str
    status: str
    total_rows: int
    valid_rows: int
    rejected_rows: int
    started_at: datetime
    finished_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


class RelationshipCheckRead(BaseModel):
    relationship_name: str
    total_rows: int
    matched_rows: int
    unmatched_rows: int
    duplicate_candidates: int
    match_pct: float
    threshold_pct: float
    sample_unmatched: list[str]

    model_config = ConfigDict(from_attributes=True)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def below_threshold(self) -> bool:
        return self.match_pct < self.threshold_pct


class DataQualityIssueRead(BaseModel):
    id: int
    source_sheet: str
    source_row_number: int | None
    entity: str
    issue_type: str
    severity: str
    message: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class IngestionRunResponse(BaseModel):
    batch_id: int
    total_rows: int
    valid_rows: int
    rejected_rows: int
    core_counts: dict[str, int]
    relationships: list[RelationshipCheckRead]
