from fastapi import APIRouter, status

from app.dependencies import CurrentUser, IdeaServiceDependency
from app.schemas.idea import IdeaCreate, IdeaDetail, IdeaRead

router = APIRouter(prefix="/ideas", tags=["ideas"])


@router.get("", response_model=list[IdeaRead])
def list_ideas(service: IdeaServiceDependency) -> list[IdeaRead]:
    return [IdeaRead(**row) for row in service.list_ideas()]


@router.get("/{idea_id}", response_model=IdeaDetail)
def get_idea(idea_id: int, service: IdeaServiceDependency) -> IdeaDetail:
    return IdeaDetail(**service.get_idea(idea_id))


@router.post("", response_model=IdeaDetail, status_code=status.HTTP_201_CREATED)
def create_idea(
    payload: IdeaCreate, service: IdeaServiceDependency, user: CurrentUser
) -> IdeaDetail:
    submitter_name = user.name or user.preferred_username or user.email or "Unknown"
    return IdeaDetail(**service.create_idea(payload, submitter_name))
