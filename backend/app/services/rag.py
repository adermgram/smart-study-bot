import json
import uuid
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.conversation import Message, MessageSender
from app.models.document import DocumentChunk, KnowledgeDocument
from app.services.embeddings import embed_text
from app.services.llm import MODEL, client

settings = get_settings()

TOP_K = 5
# How many prior messages feed into retrieval-query augmentation and the generation
# prompt -- enough for a couple of exchanges of follow-up context, bounded so the
# prompt (and cost/latency) doesn't grow unbounded over a long-running conversation.
HISTORY_LIMIT = 6

SYSTEM_PROMPT = (
    "You are a study assistant helping a student through an ongoing conversation about their "
    "course material. Below are the excerpts our search judged most relevant to this exact "
    "question -- they were chosen because they clear a similarity bar, so assume they're usable "
    "and look for the answer in them before concluding otherwise. They're machine-extracted from a "
    "PDF, so expect irregular spacing, mid-sentence cuts, and stray page furniture (headers, figure "
    "captions, URLs) -- read past that instead of dismissing a fragment as unusable. Synthesize "
    "across multiple excerpts if the answer is spread across them.\n\n"
    "Base every factual claim, definition, or explanation of the course content strictly on these "
    "excerpts -- never invent or alter facts about the course content itself, even if you know the "
    "topic generally. Decline only if, having actually read all the excerpts below, none of them "
    "touch the CURRENT question -- don't decline just because no single excerpt is a complete, "
    "cleanly-worded textbook definition on its own, and don't let an earlier question in this "
    "conversation being about a different topic make you doubt excerpts that do address this one: "
    "judge groundedness solely against the excerpts actually shown below and the question actually "
    "asked now.\n\n"
    "You may illustrate a grounded explanation with your own everyday analogies or examples that "
    "aren't drawn from the excerpts, when that would help the student understand -- that's a "
    "teaching aid, not a course-content claim, so it's fine even though it isn't in the material. "
    "Use the conversation so far to understand follow-up questions (e.g. 'what's the difference "
    "between them') in context.\n\n"
    "Respond with strictly valid JSON, no prose or markdown fences, matching this shape:\n"
    '{"grounded": true, "answer": "..."}\n'
    "grounded is true if the excerpts actually let you answer (with or without an added analogy), "
    "false if you're declining. When declining, still put a short, polite explanation in answer. "
    "Do not mention excerpts, retrieval, or JSON in the answer text itself -- answer as a normal "
    "tutor would."
)

DECLINE_MESSAGE = (
    "I can't answer that from the uploaded course material for this course. "
    "Try rephrasing, or ask your lecturer if this topic isn't covered yet."
)


@dataclass
class RetrievedChunk:
    chunk: DocumentChunk
    similarity: float


def _build_search_query(question: str, history: list[Message]) -> str:
    """A standalone question embeds fine as-is, but a follow-up like 'what's the
    difference between them' carries no retrievable signal on its own -- folding in
    the last couple of exchanges gives retrieval the topic words ('array', 'linked
    list', ...) it needs, without a separate query-rewrite LLM call."""
    if not history:
        return question
    recent = "\n".join(m.content for m in history[-4:])
    return f"{recent}\n{question}"


async def retrieve_chunks(
    db: AsyncSession, *, course_id: uuid.UUID, question: str, top_k: int = TOP_K
) -> list[RetrievedChunk]:
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


async def generate_answer(question: str, chunks: list[RetrievedChunk], history: list[Message]) -> tuple[str, bool]:
    """Returns (answer, grounded), both decided by the model after actually reading the
    chunks -- not by the retrieval similarity score. Retrieval only decides what to show
    the model; the model is what's positioned to know whether it actually answered from
    it or declined, so that's what the persisted `grounded` flag reflects."""
    context = "\n\n---\n\n".join(c.chunk.content for c in chunks)
    history_turns = [
        {"role": "user" if m.sender == MessageSender.user else "assistant", "content": m.content} for m in history
    ]
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        *history_turns,
        {"role": "user", "content": f"Course material excerpts:\n\n{context}\n\n---\n\nQuestion: {question}"},
    ]
    resp = await client.chat.completions.create(
        model=MODEL, messages=messages, temperature=0.0, response_format={"type": "json_object"}
    )
    parsed = json.loads(resp.choices[0].message.content or "{}")
    grounded = bool(parsed.get("grounded", False))
    answer = parsed.get("answer") or DECLINE_MESSAGE
    return (answer if grounded else DECLINE_MESSAGE), grounded


@dataclass
class RetrievalResult:
    chunks: list[RetrievedChunk]
    best_similarity: float


async def _retrieve_with_history(
    db: AsyncSession, *, course_id: uuid.UUID, question: str, history: list[Message]
) -> RetrievalResult:
    """Retrieve using the raw question AND (when there's history) a history-augmented
    version, keeping each pool's own top few rather than re-ranking both together on one
    merged similarity ordering. Cosine similarity to two different embedded strings isn't
    on a comparable scale -- in testing, the augmented query's scores ran consistently
    higher even when its chunks were markedly less relevant (mostly PDF page-header noise),
    which silently crowded the raw pool's genuinely correct top match out of the top-K
    entirely. Keeping both pools' own rankings intact avoids that: the raw-question pass
    protects topic-shift questions ('what is linked list' right after an array question)
    from being diluted by the prior topic, while the augmented pass is what makes
    pronoun-dependent follow-ups ('what's the difference between them') resolvable at all."""
    raw_chunks = await retrieve_chunks(db, course_id=course_id, question=question)
    if not history:
        return RetrievalResult(raw_chunks, raw_chunks[0].similarity if raw_chunks else 0.0)

    augmented_query = _build_search_query(question, history)
    augmented_chunks = await retrieve_chunks(db, course_id=course_id, question=augmented_query)

    combined: list[RetrievedChunk] = []
    seen: set[uuid.UUID] = set()
    for c in raw_chunks[:4] + augmented_chunks[:4]:
        if c.chunk.chunk_id not in seen:
            combined.append(c)
            seen.add(c.chunk.chunk_id)

    best_similarity = max(
        raw_chunks[0].similarity if raw_chunks else 0.0,
        augmented_chunks[0].similarity if augmented_chunks else 0.0,
    )
    return RetrievalResult(combined, best_similarity)


async def answer_question(
    db: AsyncSession, *, course_id: uuid.UUID, question: str, history: list[Message] | None = None
) -> tuple[str, bool]:
    history = history[-HISTORY_LIMIT:] if history else []

    result = await _retrieve_with_history(db, course_id=course_id, question=question, history=history)
    if not result.chunks or result.best_similarity < settings.similarity_threshold:
        # Purely a cost/latency guard against clearly-irrelevant questions -- skips paying
        # for a generation call when nothing retrieved is even plausibly on-topic. This is
        # NOT the source of truth for the grounded label (see generate_answer): a history-
        # augmented retrieval pass can occasionally clear this bar on a genuinely off-topic
        # follow-up just because it shares vocabulary with recent on-topic turns, so the
        # model's own post-hoc judgment is what actually decides grounded when we get there.
        return DECLINE_MESSAGE, False
    return await generate_answer(question, result.chunks, history)
