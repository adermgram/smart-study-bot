import uuid

from pydantic import BaseModel, Field


class CourseResponse(BaseModel):
    course_id: uuid.UUID
    code: str
    title: str

    model_config = {"from_attributes": True}


class CourseCreateRequest(BaseModel):
    code: str = Field(min_length=1, max_length=20)
    title: str = Field(min_length=1, max_length=255)
