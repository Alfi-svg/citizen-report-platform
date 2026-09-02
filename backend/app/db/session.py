import asyncio
from typing import AsyncGenerator
from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from app.core.config import settings

# Configure async database engine
# If running SQLite for tests (sqlite+aiosqlite:///...), pool_size is not supported, so handle appropriately
is_sqlite = settings.DATABASE_URL.startswith("sqlite")

engine_kwargs = {
    "echo": settings.DB_ECHO,
    "future": True,
}

db_url = settings.DATABASE_URL
if db_url.startswith("postgres://"):
    db_url = "postgresql+asyncpg://" + db_url[len("postgres://"):]
elif db_url.startswith("postgresql://") and not db_url.startswith("postgresql+asyncpg://"):
    db_url = "postgresql+asyncpg://" + db_url[len("postgresql://"):]

if not is_sqlite:

    connect_args = {}
    # If SSL is requested or in production mode, configure SSL for asyncpg
    if "ssl=" in db_url or "sslmode=" in db_url or settings.ENVIRONMENT.lower() == "production":
        connect_args["ssl"] = "require"
        # Normalize URL to strip libpq-specific params (sslmode, channel_binding) that asyncpg rejects
        if "?" in db_url:
            from urllib.parse import urlparse, parse_qs, urlencode
            parsed = urlparse(db_url)
            query_params = parse_qs(parsed.query)
            filtered_params = {
                k: v for k, v in query_params.items()
                if k not in ("sslmode", "channel_binding", "ssl")
            }
            new_query = urlencode(filtered_params, doseq=True)
            db_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}" + (f"?{new_query}" if new_query else "")

    engine_kwargs.update({
        "pool_size": settings.DB_POOL_SIZE,
        "max_overflow": settings.DB_MAX_OVERFLOW,
        "pool_pre_ping": True,
        "connect_args": connect_args,
    })

engine = create_async_engine(db_url, **engine_kwargs)


async_session_factory = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that yields an async database session per request."""
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def check_database_connection(timeout_seconds: float = 2.0) -> bool:
    """Probes the database connection using SELECT 1 with a timeout."""
    try:
        async def _ping() -> bool:
            async with engine.connect() as conn:
                result = await conn.execute(text("SELECT 1"))
                return result.scalar() == 1

        return await asyncio.wait_for(_ping(), timeout=timeout_seconds)
    except Exception:
        return False
