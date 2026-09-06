import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.deps import get_current_user, require_role
from app.models.conversation import Conversation, Message
from app.models.course import Course
from app.models.document import DocumentChunk, KnowledgeDocument
from app.models.quiz import QuizAttempt
from app.models.topic_tag import TopicTag
from app.models.user import User, UserRole
from app.schemas.course import CourseCreateRequest, CourseResponse
from app.services.courses import get_manageable_course_or_403

router = APIRouter(prefix="/courses", tags=["courses"])


@router.get("", response_model=list[CourseResponse])
async def list_courses(
    mine: bool = False,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = select(Course)
    # `mine` scopes a lecturer's course pickers (upload, dashboard) to courses they
    # can actually manage -- their own, plus the unowned legacy pilot courses.
    # Meaningless for a student (courses aren't owned from their side), so ignored.
    if mine and user.role == UserRole.lecturer:
        query = query.where((Course.owner_id == user.user_id) | (Course.owner_id.is_(None)))
    result = await db.execute(query.order_by(Course.code))
    return result.scalars().all()


@router.post("", response_model=CourseResponse, status_code=status.HTTP_201_CREATED)
async def create_course(
    payload: CourseCreateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.lecturer)),
):
    code = payload.code.strip().upper()
    existing = await db.execute(select(Course).where(Course.code == code))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, f"A course with code '{code}' already exists")

    course = Course(code=code, title=payload.title.strip(), owner_id=user.user_id)
    db.add(course)
    await db.commit()
    await db.refresh(course)
    return course


@router.delete("/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_course(
    course_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.lecturer)),
):
    """Permanently deletes a course and everything tied to it -- uploaded material,
    every student's conversations, quiz attempts, and topic tags. Irreversible, so
    the frontend gates this behind a type-the-course-code confirmation; ownership
    is still enforced here regardless of what the UI shows."""
    course = await get_manageable_course_or_403(db, course_id=course_id, user=user)

    document_ids = select(KnowledgeDocument.document_id).where(KnowledgeDocument.course_id == course_id)
    conversation_ids = select(Conversation.conversation_id).where(Conversation.course_id == course_id)

    await db.execute(delete(DocumentChunk).where(DocumentChunk.document_id.in_(document_ids)))
    await db.execute(delete(KnowledgeDocument).where(KnowledgeDocument.course_id == course_id))
    await db.execute(delete(Message).where(Message.conversation_id.in_(conversation_ids)))
    await db.execute(delete(Conversation).where(Conversation.course_id == course_id))
    await db.execute(delete(QuizAttempt).where(QuizAttempt.course_id == course_id))
    await db.execute(delete(TopicTag).where(TopicTag.course_id == course_id))
    await db.delete(course)
    await db.commit()
