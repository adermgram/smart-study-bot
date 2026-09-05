import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.deps import require_role
from app.models.conversation import MessageSender
from app.models.course import Course
from app.models.user import User, UserRole
from app.schemas.chat import AskRequest, AskResponse
from app.services.conversations import add_message, get_or_create_conversation
from app.services.rag import answer_question

router = APIRouter(prefix="/courses/{course_id}", tags=["chat"])


@router.post("/ask", response_model=AskResponse)
async def ask(
    course_id: uuid.UUID,
    payload: AskRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.student)),
):
    course = await db.get(Course, course_id)
    if course is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Course not found")

    conversation = await get_or_create_conversation(db, user_id=user.user_id, course_id=course_id)

    # Compute the outcome before persisting so both rows of the exchange share the
    # same grounded flag (FR6.2: outcome is answered/declined per exchange, not per row).
    answer, grounded = await answer_question(db, course_id=course_id, question=payload.question)

    await add_message(db, conversation_id=conversation.conversation_id, sender=MessageSender.user, content=payload.question, grounded=grounded)
    await add_message(db, conversation_id=conversation.conversation_id, sender=MessageSender.assistant, content=answer, grounded=grounded)

    await db.commit()
    return AskResponse(answer=answer, grounded=grounded)
