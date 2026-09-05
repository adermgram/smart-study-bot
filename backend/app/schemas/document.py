import uuid
from datetime import datetime

from pydantic import BaseModel


class DocumentResponse(BaseModel):
    document_id: uuid.UUID
    course_id: uuid.UUID
    title: str
    source_type: str
    created_at: datetime
    chunk_count: int

    model_config = {"from_attributes": True}
