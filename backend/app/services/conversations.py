import uuid

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

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


async def get_recent_messages(db: AsyncSession, *, conversation_id: uuid.UUID, limit: int = 10) -> list[Message]:
    """Most recent messages, oldest first -- ready to drop straight into a chat prompt."""
    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.desc())
        .limit(limit)
    )
    return list(reversed(result.scalars().all()))


async def list_conversations(db: AsyncSession, *, user_id: uuid.UUID) -> list[Conversation]:
    result = await db.execute(
        select(Conversation)
        .where(Conversation.user_id == user_id)
        .options(selectinload(Conversation.messages))
        .order_by(Conversation.started_at.desc())
    )
    return result.scalars().all()


async def get_conversation(db: AsyncSession, *, conversation_id: uuid.UUID, user_id: uuid.UUID) -> Conversation | None:
    result = await db.execute(
        select(Conversation)
        .where(Conversation.conversation_id == conversation_id, Conversation.user_id == user_id)
        .options(selectinload(Conversation.messages))
    )
    return result.scalar_one_or_none()


async def delete_all_conversations(db: AsyncSession, *, user_id: uuid.UUID) -> None:
    conversation_ids = select(Conversation.conversation_id).where(Conversation.user_id == user_id)
    await db.execute(delete(Message).where(Message.conversation_id.in_(conversation_ids)))
    await db.execute(delete(Conversation).where(Conversation.user_id == user_id))
    await db.commit()
