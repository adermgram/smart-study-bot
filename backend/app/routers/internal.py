from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.deps import require_internal_secret
from app.services.topic_tagging import run_topic_tagging

router = APIRouter(prefix="/internal", tags=["internal"])


@router.post("/topic-tagging/run", dependencies=[Depends(require_internal_secret)])
async def trigger_topic_tagging(db: AsyncSession = Depends(get_db)):
    courses_processed = await run_topic_tagging(db)
    return {"courses_processed": courses_processed}
