from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    jwt_secret: str
    jwt_expire_minutes: int = 30
    groq_api_key: str
    openai_api_key: str
    internal_shared_secret: str = "change-me"
    # text-embedding-3-small gives much lower question-to-passage cosine similarity than
    # document-to-document similarity -- live testing measured ~0.40-0.59 for genuinely
    # on-topic questions vs. ~0.03-0.13 for off-topic ones, so 0.3 sits with margin on
    # both sides. This supersedes the plan's initial 0.7-0.75 guess; re-tune from real
    # pilot questions across more/larger course material as it's uploaded.
    similarity_threshold: float = 0.3

    cors_origins: list[str] = ["http://localhost:3000"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
