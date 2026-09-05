import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.conversation import MessageSender


class AskRequest(BaseModel):
    question: str


class AskResponse(BaseModel):
    answer: str
    grounded: bool


class MessageResponse(BaseModel):
    message_id: uuid.UUID
    sender: MessageSender
    content: str
    grounded: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ConversationResponse(BaseModel):
    conversation_id: uuid.UUID
    course_id: uuid.UUID
    started_at: datetime
    messages: list[MessageResponse]

    model_config = {"from_attributes": True}
