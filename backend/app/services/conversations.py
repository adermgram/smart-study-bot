import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.conversation import Conversation, Message, MessageSender


async def get_or_create_conversation(db: AsyncSession, *, user_id: uuid.UUID, course_id: uuid.UUID) -> Conversation:
    result = await db.execute(
        select(Conversation).where(Conversation.user_id == user_id, Conversation.course_id == course_id)
    )
    conversation = result.scalar_one_or_none()
    if conversation is None:
        conversation = Conversation(user_id=user_id, course_id=course_id)
        db.add(conversation)
        await db.flush()
    return conversation


async def add_message(
    db: AsyncSession, *, conversation_id: uuid.UUID, sender: MessageSender, content: str, grounded: bool
) -> Message:
    message = Message(conversation_id=conversation_id, sender=sender, content=content, grounded=grounded)
    db.add(message)
    await db.flush()
    return message
