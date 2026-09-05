from urllib.parse import parse_qs, urlsplit, urlunsplit

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool

from app.core.config import get_settings

settings = get_settings()

# Supabase pooler URLs are typically postgresql://... — swap to the asyncpg driver.
_raw_url = settings.database_url.replace("postgresql://", "postgresql+asyncpg://", 1).replace(
    "postgres://", "postgresql+asyncpg://", 1
)

# asyncpg's connect() takes `ssl`, not the libpq-style `sslmode` query param SQLAlchemy
# would otherwise forward verbatim — strip it out of the URL and pass it as a connect_arg.
_split = urlsplit(_raw_url)
_query = parse_qs(_split.query)
_sslmode = _query.pop("sslmode", ["require"])[0]
_async_url = urlunsplit(_split._replace(query=""))

connect_args: dict = {
    # Supabase's pooler runs PgBouncer in transaction mode: each logical connection can
    # land on a different backend session mid-app-lifetime, so a named prepared statement
    # from one session can collide with the same auto-generated name on another. Disabling
    # asyncpg's cache alone isn't enough — SQLAlchemy's asyncpg dialect prepares statements
    # itself via connection.prepare(), independent of that cache — so force unnamed
    # statements too, which sidesteps the naming collision entirely.
    "statement_cache_size": 0,
    "prepared_statement_cache_size": 0,
    "prepared_statement_name_func": lambda: "",
}
if _sslmode != "disable":
    # asyncpg accepts libpq-style sslmode strings directly (unlike passing True, which
    # forces full certificate-chain verification and fails behind TLS-inspecting proxies).
    connect_args["ssl"] = _sslmode

engine = create_async_engine(
    _async_url,
    # NullPool: don't layer SQLAlchemy-side pooling on top of PgBouncer's — let every
    # checkout open a fresh asyncpg connection, matching transaction-mode's model.
    poolclass=NullPool,
    connect_args=connect_args,
)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
