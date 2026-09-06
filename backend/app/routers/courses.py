from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.deps import get_current_user, require_role
from app.models.course import Course
from app.models.user import UserRole
from app.schemas.course import CourseCreateRequest, CourseResponse

router = APIRouter(prefix="/courses", tags=["courses"])


@router.get("", response_model=list[CourseResponse])
async def list_courses(db: AsyncSession = Depends(get_db), _user=Depends(get_current_user)):
    result = await db.execute(select(Course).order_by(Course.code))
    return result.scalars().all()


@router.post("", response_model=CourseResponse, status_code=status.HTTP_201_CREATED)
async def create_course(
    payload: CourseCreateRequest,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_role(UserRole.lecturer)),
):
    code = payload.code.strip().upper()
    existing = await db.execute(select(Course).where(Course.code == code))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, f"A course with code '{code}' already exists")

    course = Course(code=code, title=payload.title.strip())
    db.add(course)
    await db.commit()
    await db.refresh(course)
    return course
