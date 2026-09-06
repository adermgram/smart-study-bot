import hashlib
import json
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.conversation import Conversation, Message, MessageSender
from app.models.course import Course
from app.models.quiz import QuizAttempt
from app.models.topic_tag import TopicTag, TopicTagSource
from app.services.llm import MODEL, client

LOOKBACK_DAYS = 7
MAX_QUESTIONS_PER_COURSE = 200

# Only clusters free-text questions now -- quiz performance is computed directly in SQL
# (see _compute_quiz_topic_stats) rather than asked of the LLM, since quiz topics are
# already clean strings the student typed themselves and averaging scores is exact
# arithmetic an LLM has no business doing when Python can just do it correctly.
TOPIC_TAGGING_SYSTEM_PROMPT = """You analyze anonymized student questions for one university course to help \
the lecturer see which topics students are asking about most. Each question is tagged with a pseudonymous \
learner id, never a real name.

Cluster the questions into topics and return strictly valid JSON with no prose or markdown fences, matching \
this shape:
{"topics": [{"topic_label": "short topic name", "question_count": 0}]}

question_count is the number of questions you attributed to that topic. Only include topics you can actually \
support from the given data -- do not invent topics with no evidence."""


def pseudonymize(user_id: uuid.UUID) -> str:
    return "student-" + hashlib.sha256(str(user_id).encode()).hexdigest()[:8]


async def _aggregate_questions(db: AsyncSession, *, course_id: uuid.UUID, since: datetime) -> list[dict]:
    rows = await db.execute(
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
    return [{"student": pseudonymize(user_id), "question": content} for content, user_id in rows.all()]


async def _compute_quiz_topic_stats(db: AsyncSession, *, course_id: uuid.UUID, since: datetime) -> list[dict]:
    """Groups completed quiz attempts by topic (case/whitespace-insensitive) and computes
    an exact average score per topic -- no LLM involved. Weakest topics (lowest average)
    are what a lecturer should consider reteaching, as distinct from merely-popular ones."""
    rows = (
        await db.execute(
            select(QuizAttempt.topic, QuizAttempt.score, QuizAttempt.total_questions).where(
                QuizAttempt.course_id == course_id,
                QuizAttempt.score.is_not(None),
                QuizAttempt.attempted_at >= since,
            )
        )
    ).all()

    by_topic: dict[str, list[tuple[str, int, int]]] = {}
    for topic, score, total in rows:
        by_topic.setdefault(topic.strip().lower(), []).append((topic, score, total))

    stats = []
    for entries in by_topic.values():
        pct_scores = [score / total * 100 for _, score, total in entries if total]
        if not pct_scores:
            continue
        stats.append(
            {
                "topic_label": entries[0][0].strip(),  # first-seen original casing, for display
                "avg_quiz_score_pct": sum(pct_scores) / len(pct_scores),
                "quiz_attempt_count": len(pct_scores),
            }
        )
    return stats


async def _tag_from_questions(
    db: AsyncSession, *, course_id: uuid.UUID, questions: list[dict], period_start: datetime, period_end: datetime
) -> int:
    resp = await client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": TOPIC_TAGGING_SYSTEM_PROMPT},
            {"role": "user", "content": f"Student questions this period:\n{json.dumps(questions, indent=2)}"},
        ],
        response_format={"type": "json_object"},
        temperature=0.2,
    )
    parsed = json.loads(resp.choices[0].message.content or "{}")

    created = 0
    for topic in parsed.get("topics", []):
        db.add(
            TopicTag(
                course_id=course_id,
                topic_label=topic["topic_label"],
                source=TopicTagSource.questions,
                question_count=topic.get("question_count", 0),
                period_start=period_start,
                period_end=period_end,
            )
        )
        created += 1
    return created


async def run_topic_tagging_for_course(
    db: AsyncSession,
    *,
    course_id: uuid.UUID,
    period_start: datetime | None = None,
    period_end: datetime | None = None,
) -> int:
    """Tags one course right now. Returns the number of TopicTag rows created (0 if there
    was no activity to tag). Shared by the scheduled sweep over all courses and the
    lecturer's on-demand refresh -- same logic, same lookback window, just scoped to one
    course and callable synchronously from a request instead of only from the cron."""
    period_end = period_end or datetime.now(timezone.utc)
    period_start = period_start or (period_end - timedelta(days=LOOKBACK_DAYS))

    created = 0

    questions = await _aggregate_questions(db, course_id=course_id, since=period_start)
    if questions:
        created += await _tag_from_questions(
            db, course_id=course_id, questions=questions, period_start=period_start, period_end=period_end
        )

    quiz_stats = await _compute_quiz_topic_stats(db, course_id=course_id, since=period_start)
    for stat in quiz_stats:
        db.add(
            TopicTag(
                course_id=course_id,
                topic_label=stat["topic_label"],
                source=TopicTagSource.quiz,
                avg_quiz_score_pct=stat["avg_quiz_score_pct"],
                quiz_attempt_count=stat["quiz_attempt_count"],
                period_start=period_start,
                period_end=period_end,
            )
        )
        created += 1

    return created


async def run_topic_tagging(db: AsyncSession) -> int:
    """The scheduled sweep: tags every course. Returns the number of courses processed
    (not the number of tags created -- a course with no activity is still "processed")."""
    period_end = datetime.now(timezone.utc)
    period_start = period_end - timedelta(days=LOOKBACK_DAYS)

    courses = (await db.execute(select(Course))).scalars().all()
    for course in courses:
        await run_topic_tagging_for_course(
            db, course_id=course.course_id, period_start=period_start, period_end=period_end
        )

    await db.commit()
    return len(courses)
