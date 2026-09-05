import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.deps import require_role
from app.models.user import User, UserRole
from app.schemas.chat import ConversationResponse
from app.services.conversations import delete_all_conversations, get_conversation, list_conversations

router = APIRouter(prefix="/conversations", tags=["conversations"])


@router.get("", response_model=list[ConversationResponse])
async def get_my_conversations(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.student)),
):
    return await list_conversations(db, user_id=user.user_id)


@router.get("/{conversation_id}", response_model=ConversationResponse)
async def get_my_conversation(
    conversation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.student)),
):
    conversation = await get_conversation(db, conversation_id=conversation_id, user_id=user.user_id)
    if conversation is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found")
    return conversation


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
async def delete_my_conversations(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.student)),
):
    await delete_all_conversations(db, user_id=user.user_id)
