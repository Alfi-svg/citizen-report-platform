from sqlalchemy.ext.asyncio import AsyncSession
from app.db.seed import seed_categories


async def init_db(db: AsyncSession) -> None:
    """Initializes the database with essential bootstrap data."""
    await seed_categories(db)
