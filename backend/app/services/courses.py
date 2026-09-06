import uuid

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.course import Course
from app.models.user import User


async def get_manageable_course_or_403(db: AsyncSession, *, course_id: uuid.UUID, user: User) -> Course:
    """A lecturer can manage a course if they created it, or if it's unowned (the
    original seeded pilot courses, created before ownership existed). Shared by
    every endpoint that lets a lecturer act on a specific course -- upload,
    document listing, topic-tag reads/refresh, deletion -- so "which courses can
    this lecturer touch" is defined in exactly one place."""
    course = await db.get(Course, course_id)
    if course is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Course not found")
    if course.owner_id is not None and course.owner_id != user.user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You don't have access to manage this course")
    return course
