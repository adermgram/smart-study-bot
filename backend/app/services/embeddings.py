from openai import AsyncOpenAI

from app.core.config import get_settings

settings = get_settings()
client = AsyncOpenAI(api_key=settings.openai_api_key)

EMBED_MODEL = "text-embedding-3-small"


async def embed_texts(texts: list[str]) -> list[list[float]]:
    resp = await client.embeddings.create(model=EMBED_MODEL, input=texts)
    return [item.embedding for item in resp.data]


async def embed_text(text: str) -> list[float]:
    (embedding,) = await embed_texts([text])
    return embedding
