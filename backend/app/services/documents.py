import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import DocumentChunk, KnowledgeDocument
from app.services.chunking import chunk_text
from app.services.embeddings import embed_texts
from app.services.text_extraction import extract_text


async def ingest_document(
    db: AsyncSession,
    *,
    course_id: uuid.UUID,
    uploaded_by: uuid.UUID,
    filename: str,
    content: bytes,
) -> tuple[KnowledgeDocument, int]:
    text = extract_text(filename, content)
    chunks = chunk_text(text)

    source_type = filename.rsplit(".", 1)[-1].lower() if "." in filename else "unknown"
    document = KnowledgeDocument(
        course_id=course_id,
        title=filename,
        source_type=source_type,
        uploaded_by=uploaded_by,
    )
    db.add(document)
    await db.flush()  # assigns document.document_id without committing yet

    if chunks:
        embeddings = await embed_texts(chunks)
        for chunk_content, embedding in zip(chunks, embeddings):
            db.add(DocumentChunk(document_id=document.document_id, content=chunk_content, embedding=embedding))

    await db.commit()
    await db.refresh(document)
    return document, len(chunks)
