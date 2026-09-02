import asyncio
import os
import sys
from logging.config import fileConfig

# Ensure backend directory is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

from app.core.config import settings
from app.db.base import Base

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Set database URL dynamically from app settings
db_url = settings.DATABASE_URL
config.set_main_option("sqlalchemy.url", db_url)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)

    with context.begin_transaction():
        context.run_migrations()


from sqlalchemy.ext.asyncio import create_async_engine

async def run_async_migrations() -> None:
    """Run migrations in 'online' mode with async engine."""
    db_url = config.get_main_option("sqlalchemy.url")
    is_sqlite = db_url.startswith("sqlite")
    connect_args = {}
    if not is_sqlite:
        if "ssl=" in db_url or "sslmode=" in db_url or os.getenv("ENVIRONMENT", "").lower() == "production":
            connect_args["ssl"] = "require"
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

    connectable = create_async_engine(
        db_url,
        poolclass=pool.NullPool,
        connect_args=connect_args,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()



def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
