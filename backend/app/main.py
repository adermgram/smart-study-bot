from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.routers import auth, chat, courses, documents, internal, quiz, topic_tags

settings = get_settings()

app = FastAPI(title="Smart Study Assistant Bot API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(courses.router)
app.include_router(documents.router)
app.include_router(chat.router)
app.include_router(quiz.router)
app.include_router(topic_tags.router)
app.include_router(internal.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
