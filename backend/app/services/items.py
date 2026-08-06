from app.core.exceptions import DuplicateItemError
from app.models.item import Item
from app.repositories.items import ItemRepository
from app.schemas.item import ItemCreate


class ItemService:
    def __init__(self, repository: ItemRepository) -> None:
        self._repository = repository

    def list_items(self) -> list[Item]:
        return self._repository.list()

    def create_item(self, payload: ItemCreate) -> Item:
        if self._repository.get_by_name(payload.name) is not None:
            raise DuplicateItemError(f"An item named '{payload.name}' already exists")
        return self._repository.add(Item(name=payload.name, description=payload.description))
