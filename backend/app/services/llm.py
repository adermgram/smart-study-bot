from openai import AsyncOpenAI

from app.core.config import get_settings

settings = get_settings()

client = AsyncOpenAI(api_key=settings.groq_api_key, base_url="https://api.groq.com/openai/v1")
MODEL = "openai/gpt-oss-120b"
