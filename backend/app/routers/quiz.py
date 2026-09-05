import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.deps import require_role
from app.models.course import Course
from app.models.quiz import QuizAttempt
from app.models.user import User, UserRole
from app.schemas.quiz import (
    QuizGenerateRequest,
    QuizGenerateResponse,
    QuizQuestionOut,
    QuizResultResponse,
    QuizSubmitRequest,
    QuizSubmitResponse,
)
from app.services.quiz import generate_quiz, grade_quiz

router = APIRouter(tags=["quiz"])


@router.post("/courses/{course_id}/quiz", response_model=QuizGenerateResponse)
async def create_quiz(
    course_id: uuid.UUID,
    payload: QuizGenerateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.student)),
):
    if await db.get(Course, course_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Course not found")

    try:
        attempt = await generate_quiz(
            db, course_id=course_id, user_id=user.user_id, topic=payload.topic, num_questions=payload.num_questions
        )
    except ValueError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc

    questions = attempt.generated_quiz["questions"]
    return QuizGenerateResponse(
        attempt_id=attempt.attempt_id,
        topic=attempt.topic,
        questions=[QuizQuestionOut(question=q["question"], options=q["options"]) for q in questions],
    )


@router.post("/quiz/{attempt_id}/submit", response_model=QuizSubmitResponse)
async def submit_quiz(
    attempt_id: uuid.UUID,
    payload: QuizSubmitRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.student)),
):
    attempt = await db.get(QuizAttempt, attempt_id)
    if attempt is None or attempt.user_id != user.user_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Quiz attempt not found")
    if attempt.score is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "This quiz attempt was already submitted")

    results = grade_quiz(attempt, payload.answers)
    attempt.score = sum(1 for r in results if r["correct"])
    await db.commit()

    return QuizSubmitResponse(score=attempt.score, total=attempt.total_questions, results=results)


@router.get("/users/me/quiz-results", response_model=list[QuizResultResponse])
async def my_quiz_results(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.student)),
):
    result = await db.execute(
        select(QuizAttempt)
        .where(QuizAttempt.user_id == user.user_id, QuizAttempt.score.is_not(None))
        .order_by(QuizAttempt.attempted_at.desc())
    )
    return result.scalars().all()
