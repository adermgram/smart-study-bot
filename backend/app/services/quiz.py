import json
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.quiz import QuizAttempt
from app.services.llm import MODEL, client
from app.services.rag import retrieve_chunks

QUIZ_SYSTEM_PROMPT = """You write multiple-choice self-assessment quizzes for university students, \
grounded strictly in the supplied course material excerpts. Do not use outside knowledge -- every \
question and its correct answer must be answerable directly from the excerpts.

Return strictly valid JSON matching this shape, with no prose or markdown fences:
{"questions": [{"question": "...", "options": ["...", "...", "...", "..."], "correct_index": 0, "explanation": "..."}]}

Each question must have exactly 4 options and correct_index must be the 0-based index of the \
correct option. explanation is a short (1-2 sentence) grounded explanation of why that option is \
correct, shown to the student after they answer -- write it so it teaches the concept, not just \
restates the answer."""


async def generate_quiz(
    db: AsyncSession, *, course_id: uuid.UUID, user_id: uuid.UUID, topic: str, num_questions: int = 5
) -> QuizAttempt:
    chunks = await retrieve_chunks(db, course_id=course_id, question=topic, top_k=8)
    if not chunks:
        raise ValueError("No course material is available yet for this course.")

    context = "\n\n---\n\n".join(c.chunk.content for c in chunks)
    resp = await client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": QUIZ_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"Course material excerpts:\n\n{context}\n\n---\n\n"
                    f"Write {num_questions} multiple-choice questions on the topic: {topic}"
                ),
            },
        ],
        response_format={"type": "json_object"},
        temperature=0.4,
    )
    parsed = json.loads(resp.choices[0].message.content or "{}")
    questions = parsed.get("questions", [])
    if not questions:
        raise ValueError("Could not generate quiz questions from the available course material.")

    attempt = QuizAttempt(
        user_id=user_id,
        course_id=course_id,
        topic=topic,
        score=None,
        total_questions=len(questions),
        generated_quiz={"questions": questions},
    )
    db.add(attempt)
    await db.commit()
    await db.refresh(attempt)
    return attempt


def grade_quiz(attempt: QuizAttempt, answers: list[int]) -> list[dict]:
    questions = attempt.generated_quiz["questions"]
    results = []
    for q, chosen in zip(questions, answers):
        results.append(
            {
                "question": q["question"],
                "options": q["options"],
                "correct_index": q["correct_index"],
                "chosen_index": chosen,
                "correct": chosen == q["correct_index"],
                "explanation": q.get("explanation"),
            }
        )
    return results
