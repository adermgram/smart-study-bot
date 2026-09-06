import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.deps import require_role
from app.models.course import Course
from app.models.topic_tag import TopicTag
from app.models.user import UserRole
from app.schemas.topic_tag import TopicTagResponse
from app.services.topic_tagging import run_topic_tagging_for_course

router = APIRouter(prefix="/courses/{course_id}/topic-tags", tags=["topic-tags"])


async def _get_course_or_404(db: AsyncSession, course_id: uuid.UUID) -> Course:
    course = await db.get(Course, course_id)
    if course is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Course not found")
    return course


async def _current_tags(db: AsyncSession, course_id: uuid.UUID) -> list[TopicTag]:
    result = await db.execute(
        select(TopicTag).where(TopicTag.course_id == course_id).order_by(TopicTag.period_end.desc())
    )
    return result.scalars().all()


@router.get("", response_model=list[TopicTagResponse])
async def list_topic_tags(
    course_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_role(UserRole.lecturer)),
):
    await _get_course_or_404(db, course_id)
    return await _current_tags(db, course_id)


@router.post("/refresh", response_model=list[TopicTagResponse])
async def refresh_topic_tags(
    course_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_role(UserRole.lecturer)),
):
    """On-demand version of the weekly cron, scoped to one course, gated by the lecturer
    role instead of the internal shared secret. Lets a lecturer pull fresh insight right
    before class instead of waiting for Monday's scheduled run."""
    await _get_course_or_404(db, course_id)
    await run_topic_tagging_for_course(db, course_id=course_id)
    await db.commit()
    return await _current_tags(db, course_id)
