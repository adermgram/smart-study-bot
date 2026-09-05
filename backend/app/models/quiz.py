import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    attempt_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=False)
    course_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("courses.course_id"), nullable=False)
    topic: Mapped[str] = mapped_column(String(255), nullable=False)
    # Null until the student submits answers (FR4.3): a generated-but-unsubmitted quiz
    # has no score yet.
    score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_questions: Mapped[int] = mapped_column(Integer, nullable=False)
    # The plan's ER diagram (section 9) has no separate Quiz/Question table, so the
    # generated MCQs + answer key are stashed here between the generate and submit
    # calls -- otherwise there's nowhere to check submitted answers against.
    generated_quiz: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    attempted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
