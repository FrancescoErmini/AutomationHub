from typing import Literal

from fastapi import APIRouter, Query

from app.dependencies import TicketServiceDependency
from app.schemas.ticket import TicketOptions, TicketRead, TicketUpdate

router = APIRouter(prefix="/tickets", tags=["tickets"])


@router.get("", response_model=list[TicketRead])
def list_tickets(
    service: TicketServiceDependency,
    scope: Literal["default", "all"] = "default",
    q: str | None = None,
    limit: int = Query(default=500, ge=1, le=5000),
) -> list[TicketRead]:
    return [TicketRead(**row) for row in service.list_tickets(scope=scope, q=q, limit=limit)]


@router.get("/options", response_model=TicketOptions)
def ticket_options(service: TicketServiceDependency) -> TicketOptions:
    return TicketOptions(**service.get_options())


# TODO: temporary — restore the RequireEditor dependency on this write endpoint
# (add `_user: RequireEditor` and re-import it from app.dependencies).
@router.patch("/{ticket_pk}", response_model=TicketRead)
def update_ticket(
    ticket_pk: int,
    payload: TicketUpdate,
    service: TicketServiceDependency,
) -> TicketRead:
    return TicketRead(**service.update(ticket_pk, payload))
