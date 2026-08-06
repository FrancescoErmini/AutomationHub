from unittest.mock import Mock

from app.repositories.analytics import AnalyticsRepository
from app.services.process_catalog import ProcessCatalogService


def test_list_items_maps_status_to_is_live_and_defaults_missing_department() -> None:
    repository = Mock(spec=AnalyticsRepository)
    repository.pipeline_processes.return_value = [
        ("RPA - Alpha", "Finance", "Does the Alpha thing.", "In production"),
        ("RPA - Beta", "Finance", "Does the Beta thing.", "In development"),
        ("RPA - Gamma", None, None, None),
    ]
    service = ProcessCatalogService(repository)

    items = service.list_items()

    assert items == [
        {
            "title": "RPA - Alpha",
            "department": "Finance",
            "description": "Does the Alpha thing.",
            "status": "In production",
            "is_live": True,
        },
        {
            "title": "RPA - Beta",
            "department": "Finance",
            "description": "Does the Beta thing.",
            "status": "In development",
            "is_live": False,
        },
        {
            "title": "RPA - Gamma",
            "department": "Unassigned",
            "description": None,
            "status": None,
            "is_live": False,
        },
    ]
