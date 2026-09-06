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
# How many prior messages feed the resolve step and the generation prompt -- enough
# for a couple of exchanges of follow-up context, bounded so the prompt (and cost/
# latency) doesn't grow unbounded over a long-running conversation.
HISTORY_LIMIT = 6

RESOLVE_SYSTEM_PROMPT = (
    "You maintain a student's ongoing conversation with a course-material assistant. Given "
    "the conversation so far and the student's newest message, decide two things:\n\n"
    "1. Is the newest message pure conversational filler with no question or request in it at "
    "all -- a greeting, thanks, or a bare acknowledgment like 'ok', 'got it', 'cool', 'that's "
    "helpful'? Mark chitchat true ONLY for that. ANY actual question is NOT chitchat, even if "
    "it's a follow-up that only makes sense with context (e.g. 'what about the other one', 'can "
    "we remove from the middle of it'), and even if it has nothing to do with the course at all "
    "(e.g. 'what is the capital of France', 'write me a poem') -- those still need to go to the "
    "material check so they can be answered or correctly declined. When genuinely unsure, prefer "
    "chitchat: false.\n\n"
    "2. If it's a real question (chitchat: false), rewrite it as a fully self-contained, standalone question that "
    "makes sense with NO prior context -- resolve every pronoun and implicit reference ('it', "
    "'that', 'the other one', 'this') to the SPECIFIC thing actually being discussed, using the "
    "conversation history. Do not answer the question, only rewrite it. If it's already self-"
    "contained, return it lightly cleaned up.\n\n"
    'Return strictly valid JSON, no prose or markdown fences:\n{"chitchat": true|false, '
    '"standalone_question": "..."}\n'
    "standalone_question must be an empty string if chitchat is true."
)

SYSTEM_PROMPT = (
    "You are a study assistant helping a student through an ongoing conversation about their "
    "course material. Below are the excerpts our search judged most relevant to this exact "
    "question -- they were chosen because they clear a similarity bar, so assume they're usable "
    "and look for the answer in them before concluding otherwise. They're machine-extracted from a "
    "PDF, so expect irregular spacing, mid-sentence cuts, and stray page furniture (headers, figure "
    "captions, URLs) -- read past that instead of dismissing a fragment as unusable. A chunk can "
    "also straddle a section boundary in the source document (e.g. the tail of one topic's "
    "explanation followed by the next topic's heading) -- when that happens, use only the part "
    "that actually answers the question asked, not whatever topic the chunk trails off into.\n\n"
    "Base every factual claim, definition, or explanation of the course content strictly on these "
    "excerpts -- never invent or alter facts about the course content itself, even if you know the "
    "topic generally. Decline only if, having actually read all the excerpts below, none of them "
    "touch the CURRENT question -- don't decline just because no single excerpt is a complete, "
    "cleanly-worded textbook definition on its own.\n\n"
    "You may illustrate a grounded explanation with your own everyday analogies or examples that "
    "aren't drawn from the excerpts, when that would help the student understand -- that's a "
    "teaching aid, not a course-content claim, so it's fine even though it isn't in the material.\n\n"
    "Respond with strictly valid JSON, no prose or markdown fences, matching this shape:\n"
    '{"grounded": true, "answer": "..."}\n'
    "grounded is true if the excerpts actually let you answer (with or without an added analogy), "
    "false if you're declining. When declining, still put a short, polite explanation in answer. "
    "Do not mention excerpts, retrieval, or JSON in the answer text itself -- answer as a normal "
    "tutor would."
)

CHITCHAT_SYSTEM_PROMPT = (
    "You are a study assistant. The student just sent a conversational message with no course-"
    "content request in it (e.g. thanks, ok, a greeting). Reply briefly and warmly in one short "
    "sentence -- don't re-explain anything from earlier in the conversation, don't ask an "
    "unprompted follow-up question, just acknowledge naturally like a normal tutor would."
)

DECLINE_MESSAGE = (
    "I can't answer that from the uploaded course material for this course. "
    "Try rephrasing, or ask your lecturer if this topic isn't covered yet."
)


@dataclass
class RetrievedChunk:
    chunk: DocumentChunk
    similarity: float


def _history_turns(history: list[Message]) -> list[dict]:
    return [{"role": "user" if m.sender == MessageSender.user else "assistant", "content": m.content} for m in history]


async def _resolve_question(question: str, history: list[Message]) -> tuple[bool, str]:
    """Classifies the message as chit-chat vs. a real question, and -- for a real
    question -- rewrites it into a standalone form with pronouns resolved against
    history. Replaces an earlier heuristic that embedded the raw question plus a
    chunk of history side by side: that approach could still hand the model a mix
    of chunks about two different things discussed nearby (e.g. arrays vs. linked
    lists) with nothing forcing it to pick the one the pronoun actually meant. A
    resolved question ('remove from the middle of an array', not '...of it') fixes
    that at the retrieval step instead of hoping generation disambiguates it."""
    if not history:
        return False, question

    resp = await client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": RESOLVE_SYSTEM_PROMPT},
            *_history_turns(history),
            {"role": "user", "content": question},
        ],
        response_format={"type": "json_object"},
        temperature=0.0,
    )
    parsed = json.loads(resp.choices[0].message.content or "{}")
    chitchat = bool(parsed.get("chitchat", False))
    standalone = parsed.get("standalone_question") or question
    return chitchat, standalone


async def _generate_chitchat_reply(question: str, history: list[Message]) -> str:
    messages = [
        {"role": "system", "content": CHITCHAT_SYSTEM_PROMPT},
        *_history_turns(history),
        {"role": "user", "content": question},
    ]
    resp = await client.chat.completions.create(model=MODEL, messages=messages, temperature=0.3)
    return resp.choices[0].message.content or "You're welcome!"


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
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        *_history_turns(history),
        {"role": "user", "content": f"Course material excerpts:\n\n{context}\n\n---\n\nQuestion: {question}"},
    ]
    resp = await client.chat.completions.create(
        model=MODEL, messages=messages, temperature=0.0, response_format={"type": "json_object"}
    )
    parsed = json.loads(resp.choices[0].message.content or "{}")
    grounded = bool(parsed.get("grounded", False))
    answer = parsed.get("answer") or DECLINE_MESSAGE
    return (answer if grounded else DECLINE_MESSAGE), grounded


async def answer_question(
    db: AsyncSession, *, course_id: uuid.UUID, question: str, history: list[Message] | None = None
) -> tuple[str, bool]:
    history = history[-HISTORY_LIMIT:] if history else []

    chitchat, standalone_question = await _resolve_question(question, history)
    if chitchat:
        return await _generate_chitchat_reply(question, history), True

    chunks = await retrieve_chunks(db, course_id=course_id, question=standalone_question)
    if not chunks or chunks[0].similarity < settings.similarity_threshold:
        # Purely a cost/latency guard against clearly-irrelevant questions -- skips paying
        # for a generation call when nothing retrieved is even plausibly on-topic. Not the
        # source of truth for the grounded label: the model's own post-hoc judgment in
        # generate_answer is (see its docstring).
        return DECLINE_MESSAGE, False
    return await generate_answer(standalone_question, chunks, history)
