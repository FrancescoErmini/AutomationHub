from pydantic import BaseModel, ConfigDict


class ApqcCategoryRead(BaseModel):
    id: int
    pcf_id: int
    hierarchy_id: str
    name: str

    model_config = ConfigDict(from_attributes=True)


class ApqcProcessGroupRead(BaseModel):
    id: int
    pcf_id: int
    hierarchy_id: str
    name: str
    category_id: int

    model_config = ConfigDict(from_attributes=True)


class ApqcProcessRead(BaseModel):
    id: int
    pcf_id: int
    hierarchy_id: str
    name: str
    process_group_id: int

    model_config = ConfigDict(from_attributes=True)
