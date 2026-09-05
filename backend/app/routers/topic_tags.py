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

router = APIRouter(prefix="/courses/{course_id}/topic-tags", tags=["topic-tags"])


@router.get("", response_model=list[TopicTagResponse])
async def list_topic_tags(
    course_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_role(UserRole.lecturer)),
):
    if await db.get(Course, course_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Course not found")

    result = await db.execute(
        select(TopicTag).where(TopicTag.course_id == course_id).order_by(TopicTag.period_end.desc())
    )
    return result.scalars().all()
