import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class TopicTagSource(str, enum.Enum):
    # LLM-clustered from free-text student questions -- "what are students asking about".
    questions = "questions"
    # Computed directly from QuizAttempt scores, no LLM involved -- "what are students
    # doing badly on". Kept as a separate signal rather than merged into one number:
    # a topic can generate lots of questions (curiosity/engagement) independently of
    # whether students actually score well on it, and a lecturer needs to tell those
    # apart to know whether to add material or reteach a concept.
    quiz = "quiz"


class TopicTag(Base):
    __tablename__ = "topic_tags"

    tag_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    course_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("courses.course_id"), nullable=False)
    topic_label: Mapped[str] = mapped_column(String(255), nullable=False)
    source: Mapped[TopicTagSource] = mapped_column(
        Enum(TopicTagSource, name="topic_tag_source"), nullable=False, server_default=TopicTagSource.questions.value
    )
    question_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    avg_quiz_score_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    quiz_attempt_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    period_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    period_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
