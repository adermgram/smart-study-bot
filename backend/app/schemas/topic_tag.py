import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.topic_tag import TopicTagSource


class TopicTagResponse(BaseModel):
    tag_id: uuid.UUID
    topic_label: str
    source: TopicTagSource
    question_count: int | None
    avg_quiz_score_pct: float | None
    quiz_attempt_count: int | None
    period_start: datetime
    period_end: datetime

    model_config = {"from_attributes": True}
