import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.deps import require_role
from app.models.course import Course
from app.models.document import DocumentChunk, KnowledgeDocument
from app.models.user import User, UserRole
from app.schemas.document import DocumentResponse
from app.services.documents import ingest_document

router = APIRouter(prefix="/courses/{course_id}/documents", tags=["documents"])


async def _get_course_or_404(db: AsyncSession, course_id: uuid.UUID) -> Course:
    course = await db.get(Course, course_id)
    if course is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Course not found")
    return course


@router.post("", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    course_id: uuid.UUID,
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.lecturer)),
):
    await _get_course_or_404(db, course_id)
    content = await file.read()
    document, chunk_count = await ingest_document(
        db,
        course_id=course_id,
        uploaded_by=user.user_id,
        filename=file.filename or "untitled",
        content=content,
    )
    return DocumentResponse(
        document_id=document.document_id,
        course_id=document.course_id,
        title=document.title,
        source_type=document.source_type,
        created_at=document.created_at,
        chunk_count=chunk_count,
    )


@router.get("", response_model=list[DocumentResponse])
async def list_documents(
    course_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_role(UserRole.lecturer)),
):
    await _get_course_or_404(db, course_id)
    result = await db.execute(
        select(KnowledgeDocument, func.count(DocumentChunk.chunk_id))
        .outerjoin(DocumentChunk, DocumentChunk.document_id == KnowledgeDocument.document_id)
        .where(KnowledgeDocument.course_id == course_id)
        .group_by(KnowledgeDocument.document_id)
        .order_by(KnowledgeDocument.created_at.desc())
    )
    return [
        DocumentResponse(
            document_id=doc.document_id,
            course_id=doc.course_id,
            title=doc.title,
            source_type=doc.source_type,
            created_at=doc.created_at,
            chunk_count=chunk_count,
        )
        for doc, chunk_count in result.all()
    ]
