from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.item import Item


class ItemRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def list(self) -> list[Item]:
        return list(self._session.scalars(select(Item).order_by(Item.id)))

    def get_by_name(self, name: str) -> Item | None:
        return self._session.scalar(select(Item).where(Item.name == name))

    def add(self, item: Item) -> Item:
        self._session.add(item)
        self._session.commit()
        self._session.refresh(item)
        return item
