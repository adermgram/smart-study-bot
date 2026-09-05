import uuid
from datetime import datetime

from pydantic import BaseModel


class TopicTagResponse(BaseModel):
    tag_id: uuid.UUID
    topic_label: str
    question_count: int
    period_start: datetime
    period_end: datetime

    model_config = {"from_attributes": True}
