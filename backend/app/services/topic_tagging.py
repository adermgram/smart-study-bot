import hashlib
import json
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.conversation import Conversation, Message, MessageSender
from app.models.course import Course
from app.models.quiz import QuizAttempt
from app.models.topic_tag import TopicTag
from app.services.llm import MODEL, client

LOOKBACK_DAYS = 7
MAX_QUESTIONS_PER_COURSE = 200

TOPIC_TAGGING_SYSTEM_PROMPT = """You analyze anonymized student activity for one university course to help \
the lecturer see which topics need attention. You are given a list of student questions (each tagged with a \
pseudonymous learner id, never a real name) and a list of self-assessment quiz results per topic.

Identify the topics generating the most questions or the weakest quiz results. Return strictly valid JSON \
with no prose or markdown fences, matching this shape:
{"topics": [{"topic_label": "short topic name", "question_count": 0}]}

question_count is the number of questions/attempts you attributed to that topic. Only include topics you can \
actually support from the given data -- do not invent topics with no evidence."""


def pseudonymize(user_id: uuid.UUID) -> str:
    return "student-" + hashlib.sha256(str(user_id).encode()).hexdigest()[:8]


async def _aggregate_course_activity(db: AsyncSession, *, course_id: uuid.UUID, since: datetime) -> tuple[list[dict], list[dict]]:
    question_rows = await db.execute(
        select(Message.content, Conversation.user_id)
        .join(Conversation, Conversation.conversation_id == Message.conversation_id)
        .where(
            Conversation.course_id == course_id,
            Message.sender == MessageSender.user,
            Message.created_at >= since,
        )
        .order_by(Message.created_at.desc())
        .limit(MAX_QUESTIONS_PER_COURSE)
    )
    questions = [{"student": pseudonymize(user_id), "question": content} for content, user_id in question_rows.all()]

    quiz_rows = await db.execute(
        select(QuizAttempt.user_id, QuizAttempt.topic, QuizAttempt.score, QuizAttempt.total_questions).where(
            QuizAttempt.course_id == course_id,
            QuizAttempt.score.is_not(None),
            QuizAttempt.attempted_at >= since,
        )
    )
    quiz_results = [
        {"student": pseudonymize(user_id), "topic": topic, "score": score, "total": total}
        for user_id, topic, score, total in quiz_rows.all()
    ]

    return questions, quiz_results


async def _tag_course(db: AsyncSession, *, course: Course, period_start: datetime, period_end: datetime) -> None:
    questions, quiz_results = await _aggregate_course_activity(db, course_id=course.course_id, since=period_start)
    if not questions and not quiz_results:
        return

    user_content = (
        f"Student questions this period:\n{json.dumps(questions, indent=2)}\n\n"
        f"Quiz results this period:\n{json.dumps(quiz_results, indent=2)}"
    )
    resp = await client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": TOPIC_TAGGING_SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ],
        response_format={"type": "json_object"},
        temperature=0.2,
    )
    parsed = json.loads(resp.choices[0].message.content or "{}")

    for topic in parsed.get("topics", []):
        db.add(
            TopicTag(
                course_id=course.course_id,
                topic_label=topic["topic_label"],
                question_count=topic.get("question_count", 0),
                period_start=period_start,
                period_end=period_end,
            )
        )


async def run_topic_tagging(db: AsyncSession) -> int:
    period_end = datetime.now(timezone.utc)
    period_start = period_end - timedelta(days=LOOKBACK_DAYS)

    courses = (await db.execute(select(Course))).scalars().all()
    tagged = 0
    for course in courses:
        await _tag_course(db, course=course, period_start=period_start, period_end=period_end)
        tagged += 1

    await db.commit()
    return tagged
