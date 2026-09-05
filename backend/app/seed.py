import asyncio

from sqlalchemy import select

from app.core.db import AsyncSessionLocal
from app.models.course import Course

PILOT_COURSES = [
    ("CSC311", "Data Structures"),
    ("CSC313", "Operating Systems"),
    ("CSE301", "Software Design and Architecture"),
    ("CSE304", "Web Application Development"),
]


async def seed_courses() -> None:
    async with AsyncSessionLocal() as db:
        for code, title in PILOT_COURSES:
            existing = await db.execute(select(Course).where(Course.code == code))
            if existing.scalar_one_or_none() is not None:
                continue
            db.add(Course(code=code, title=title))
        await db.commit()


if __name__ == "__main__":
    asyncio.run(seed_courses())
    print("Seeded pilot courses.")
