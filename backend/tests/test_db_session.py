import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db, check_database_connection


@pytest.mark.asyncio
async def test_get_db_generator(db_session: AsyncSession):
    assert isinstance(db_session, AsyncSession)
    result = await db_session.execute(text("SELECT 1"))
    assert result.scalar() == 1


@pytest.mark.asyncio
async def test_check_database_connection():
    # Calling check_database_connection returns bool without unhandled exceptions
    result = await check_database_connection(timeout_seconds=0.5)
    assert isinstance(result, bool)
