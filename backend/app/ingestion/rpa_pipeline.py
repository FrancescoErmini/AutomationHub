"""Orchestrates the full RPA workbook ingestion pipeline: stage every row,
normalize and load core, then validate relationships. Used by both the CLI
and the admin ingestion API endpoint so the two never drift apart.
"""

from dataclasses import dataclass
from pathlib import Path

from sqlalchemy.orm import Session

from app.ingestion.rpa_core_loader import CoreLoadResult, load_core_from_staging
from app.ingestion.rpa_relationship_validation import RelationshipCheck, validate_relationships
from app.ingestion.rpa_staging_loader import StagingLoadResult, load_staging_from_workbook


@dataclass(frozen=True)
class RpaIngestionSummary:
    staging: StagingLoadResult
    core: CoreLoadResult
    relationships: list[RelationshipCheck]


def run_rpa_ingestion(session: Session, path: Path) -> RpaIngestionSummary:
    staging_result = load_staging_from_workbook(session, path)
    core_result = load_core_from_staging(session, staging_result.batch_id)
    relationship_checks = validate_relationships(session, staging_result.batch_id)
    return RpaIngestionSummary(
        staging=staging_result, core=core_result, relationships=relationship_checks
    )
