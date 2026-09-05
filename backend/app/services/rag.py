import uuid
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.document import DocumentChunk, KnowledgeDocument
from app.services.embeddings import embed_text
from app.services.llm import MODEL, client

settings = get_settings()

TOP_K = 5

SYSTEM_PROMPT = (
    "You are a study assistant answering questions strictly from the course material "
    "provided below. Answer using only the supplied excerpts -- never introduce facts, "
    "examples, or explanations from outside them, even if you know the answer generally. "
    "If the excerpts do not address the question, say plainly that you cannot answer it "
    "from the course material. Do not mention that you were given excerpts; answer as a "
    "normal tutor would, grounded only in what's provided."
)


@dataclass
class RetrievedChunk:
    chunk: DocumentChunk
    similarity: float


async def retrieve_chunks(db: AsyncSession, *, course_id: uuid.UUID, question: str, top_k: int = TOP_K) -> list[RetrievedChunk]:
    query_embedding = await embed_text(question)
    distance = DocumentChunk.embedding.cosine_distance(query_embedding)

    result = await db.execute(
        select(DocumentChunk, distance.label("distance"))
        .join(KnowledgeDocument, KnowledgeDocument.document_id == DocumentChunk.document_id)
        .where(KnowledgeDocument.course_id == course_id)
        .order_by(distance)
        .limit(top_k)
    )
    return [RetrievedChunk(chunk=chunk, similarity=1 - dist) for chunk, dist in result.all()]


async def generate_answer(question: str, chunks: list[RetrievedChunk]) -> str:
    context = "\n\n---\n\n".join(c.chunk.content for c in chunks)
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"Course material excerpts:\n\n{context}\n\n---\n\nQuestion: {question}"},
    ]
    resp = await client.chat.completions.create(model=MODEL, messages=messages, temperature=0.2)
    return resp.choices[0].message.content or ""


DECLINE_MESSAGE = (
    "I can't answer that from the uploaded course material for this course. "
    "Try rephrasing, or ask your lecturer if this topic isn't covered yet."
)


async def answer_question(db: AsyncSession, *, course_id: uuid.UUID, question: str) -> tuple[str, bool]:
    chunks = await retrieve_chunks(db, course_id=course_id, question=question)
    if not chunks or chunks[0].similarity < settings.similarity_threshold:
        return DECLINE_MESSAGE, False
    answer = await generate_answer(question, chunks)
    return answer, True
