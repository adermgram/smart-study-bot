import uuid

from pydantic import BaseModel


class CourseResponse(BaseModel):
    course_id: uuid.UUID
    code: str
    title: str

    model_config = {"from_attributes": True}
