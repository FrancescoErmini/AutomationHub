from typing import Any

from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.core import Person


class PersonService:
    def __init__(self, session: Session) -> None:
        self._session = session

    def search(self, q: str | None, limit: int) -> list[dict[str, Any]]:
        stmt = select(Person).order_by(Person.name, Person.email).limit(limit)
        term = (q or "").strip()
        if term:
            pattern = f"%{term}%"
            stmt = stmt.where(or_(Person.email.ilike(pattern), Person.name.ilike(pattern)))
        return [self._serialize(p) for p in self._session.scalars(stmt).all()]

    def get_or_create(self, email: str, name: str | None) -> Person:
        """Find a person by email (case-insensitive) or create one. Mirrors
        the get-or-create idiom in ``get_current_user``
        (app/dependencies.py) used for AppUser records."""
        normalized = email.strip().lower()

        person = self._session.scalar(select(Person).where(Person.email == normalized))
        if person is not None:
            return person

        person = Person(email=normalized, name=name)
        self._session.add(person)
        try:
            self._session.commit()
        except IntegrityError:
            self._session.rollback()
            person = self._session.scalar(select(Person).where(Person.email == normalized))
            if person is None:
                raise
            return person

        self._session.refresh(person)
        return person

    @staticmethod
    def _serialize(p: Person) -> dict[str, Any]:
        return {"id": p.id, "email": p.email, "name": p.name}
