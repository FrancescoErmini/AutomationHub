"""Automation catalog: every RPA process in the pipeline, split into live
(in production) vs. still in progress, for the process-catalog homepage view.
"""

from typing import Any

from app.repositories.analytics import AnalyticsRepository

_LIVE_STATUS = "In production"


class ProcessCatalogService:
    def __init__(self, repo: AnalyticsRepository) -> None:
        self._repo = repo

    def list_items(self) -> list[dict[str, Any]]:
        return [
            {
                "title": name,
                "department": department or "Unassigned",
                "description": description,
                "status": status,
                "is_live": status == _LIVE_STATUS,
            }
            for name, department, description, status in self._repo.pipeline_processes()
        ]
