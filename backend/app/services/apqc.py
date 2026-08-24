from app.models.core import ApqcCategory, ApqcProcess, ApqcProcessGroup
from app.repositories.ideas import IdeaRepository


class ApqcService:
    """Read-only access to the APQC taxonomy for the wizard's cascading
    L1 -> L2 -> L3 dropdowns."""

    def __init__(self, repository: IdeaRepository) -> None:
        self._repository = repository

    def list_categories(self) -> list[ApqcCategory]:
        return self._repository.list_categories()

    def list_process_groups(self, category_id: int) -> list[ApqcProcessGroup]:
        return self._repository.list_process_groups(category_id)

    def list_processes(self, process_group_id: int) -> list[ApqcProcess]:
        return self._repository.list_processes(process_group_id)
