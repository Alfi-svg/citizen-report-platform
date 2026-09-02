from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.db.seed import seed_categories
from app.models.category import Category
from app.schemas.category import CategoryResponse

router = APIRouter()


@router.get(
    "",
    response_model=List[CategoryResponse],
    status_code=status.HTTP_200_OK,
    summary="List all active incident categories",
)
async def list_categories(
    db: AsyncSession = Depends(get_db),
) -> List[Category]:
    """
    Returns all active incident categories for report classification.
    """
    stmt = select(Category).where(Category.is_active == True).order_by(Category.name.asc())
    result = await db.execute(stmt)
    categories = result.scalars().all()

    # If empty (first run before explicit seed), bootstrap initial categories automatically
    if not categories:
        await seed_categories(db)
        result = await db.execute(stmt)
        categories = result.scalars().all()

    return list(categories)
