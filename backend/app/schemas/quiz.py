import uuid
from datetime import datetime

from pydantic import BaseModel


class QuizGenerateRequest(BaseModel):
    topic: str
    num_questions: int = 5


class QuizQuestionOut(BaseModel):
    question: str
    options: list[str]


class QuizGenerateResponse(BaseModel):
    attempt_id: uuid.UUID
    topic: str
    questions: list[QuizQuestionOut]


class QuizSubmitRequest(BaseModel):
    answers: list[int]


class QuizQuestionResult(BaseModel):
    question: str
    options: list[str]
    correct_index: int
    chosen_index: int
    correct: bool
    explanation: str | None = None


class QuizSubmitResponse(BaseModel):
    score: int
    total: int
    results: list[QuizQuestionResult]


class QuizResultResponse(BaseModel):
    attempt_id: uuid.UUID
    course_id: uuid.UUID
    topic: str
    score: int | None
    total_questions: int
    attempted_at: datetime

    model_config = {"from_attributes": True}
