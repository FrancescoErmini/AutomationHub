from typing import Literal

from fastapi import APIRouter, Query, status

from app.dependencies import TicketServiceDependency
from app.schemas.ticket import TicketCreate, TicketOptions, TicketRead, TicketUpdate

router = APIRouter(prefix="/tickets", tags=["tickets"])


@router.get("", response_model=list[TicketRead])
def list_tickets(
    service: TicketServiceDependency,
    status: Literal["all", "open", "closed"] = "all",
    period: Literal["all", "7d", "14d", "30d", "90d", "month", "year", "last_year"] = "14d",
    level: Literal["all", "1l", "2l"] = "all",
    root_cause_id: int | None = None,
    ticket_type: str | None = None,
    q: str | None = None,
    limit: int = Query(default=500, ge=1, le=5000),
) -> list[TicketRead]:
    return [
        TicketRead(**row)
        for row in service.list_tickets(
            status=status,
            period=period,
            level=level,
            root_cause_id=root_cause_id,
            ticket_type=ticket_type,
            q=q,
            limit=limit,
        )
    ]


@router.get("/options", response_model=TicketOptions)
def ticket_options(service: TicketServiceDependency) -> TicketOptions:
    return TicketOptions(**service.get_options())


@router.post("", response_model=TicketRead, status_code=status.HTTP_201_CREATED)
def create_ticket(payload: TicketCreate, service: TicketServiceDependency) -> TicketRead:
    return TicketRead(**service.create(payload))


# TODO: temporary — restore the RequireEditor dependency on this write endpoint
# (add `_user: RequireEditor` and re-import it from app.dependencies).
@router.patch("/{ticket_pk}", response_model=TicketRead)
def update_ticket(
    ticket_pk: int,
    payload: TicketUpdate,
    service: TicketServiceDependency,
) -> TicketRead:
    return TicketRead(**service.update(ticket_pk, payload))


@router.delete("/{ticket_pk}", status_code=status.HTTP_204_NO_CONTENT)
def delete_ticket(ticket_pk: int, service: TicketServiceDependency) -> None:
    service.delete(ticket_pk)
