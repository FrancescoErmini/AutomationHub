from unittest.mock import Mock

import pytest

from app.core.exceptions import DuplicateItemError
from app.models.item import Item
from app.repositories.items import ItemRepository
from app.schemas.item import ItemCreate
from app.services.items import ItemService


def test_create_item_delegates_persistence() -> None:
    repository = Mock(spec=ItemRepository)
    repository.get_by_name.return_value = None
    expected = Item(id=1, name="Router", description="Edge device")
    repository.add.return_value = expected
    service = ItemService(repository)

    result = service.create_item(ItemCreate(name="Router", description="Edge device"))

    assert result is expected
    repository.add.assert_called_once()


def test_create_item_rejects_duplicate_name() -> None:
    repository = Mock(spec=ItemRepository)
    repository.get_by_name.return_value = Item(id=1, name="Router")
    service = ItemService(repository)

    with pytest.raises(DuplicateItemError, match="already exists"):
        service.create_item(ItemCreate(name="Router"))
