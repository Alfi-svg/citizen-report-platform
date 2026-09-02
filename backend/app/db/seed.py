import asyncio
import logging
from typing import List, Dict, Any
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import async_session_factory
from app.models.category import Category

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("seed")

INITIAL_CATEGORIES: List[Dict[str, Any]] = [
    {
        "name": "Crime",
        "slug": "crime",
        "description": "General criminal offenses and illegal activities.",
    },
    {
        "name": "Murder",
        "slug": "murder",
        "description": "Homicide and fatal incident reports.",
    },
    {
        "name": "Missing Person",
        "slug": "missing-person",
        "description": "Reports of missing persons, abducted individuals, or runaway alerts.",
    },
    {
        "name": "Violence",
        "slug": "violence",
        "description": "Physical violence, assaults, and armed clashes.",
    },
    {
        "name": "Abuse",
        "slug": "abuse",
        "description": "Domestic abuse, child abuse, harassment, and exploitation.",
    },
    {
        "name": "Corruption",
        "slug": "corruption",
        "description": "Bribery, misuse of power, embezzlement, and official misconduct.",
    },
    {
        "name": "Fraud",
        "slug": "fraud",
        "description": "Financial fraud, cyber scams, forgery, and deceptive practices.",
    },
    {
        "name": "Public Safety",
        "slug": "public-safety",
        "description": "Hazards, structural collapses, fires, and infrastructure dangers.",
    },
    {
        "name": "Human Rights",
        "slug": "human-rights",
        "description": "Human rights violations, unlawful detention, and discrimination.",
    },
    {
        "name": "Environmental Issue",
        "slug": "environmental-issue",
        "description": "Illegal deforestation, river pollution, hazardous waste dumping.",
    },
    {
        "name": "Public Service Issue",
        "slug": "public-service-issue",
        "description": "Negligence in civic utilities, road blockades, and municipal services.",
    },
    {
        "name": "Other",
        "slug": "other",
        "description": "Other uncategorized citizen incident reports.",
    },
]


async def seed_categories(db: AsyncSession) -> int:
    """Seeds initial categories if they do not already exist."""
    created_count = 0
    for cat_data in INITIAL_CATEGORIES:
        stmt = select(Category).where(Category.slug == cat_data["slug"])
        result = await db.execute(stmt)
        existing = result.scalar_one_or_none()

        if not existing:
            category = Category(
                name=cat_data["name"],
                slug=cat_data["slug"],
                description=cat_data["description"],
                is_active=True,
            )
            db.add(category)
            created_count += 1
            logger.info(f"Seeding category: {category.name} ({category.slug})")

    if created_count > 0:
        await db.commit()
        logger.info(f"Successfully seeded {created_count} categories.")
    else:
        logger.info("All initial categories already exist. No new categories seeded.")

    return created_count


async def run_seed():
    """CLI runner for database seeding."""
    logger.info("Starting database bootstrap / seed...")
    async with async_session_factory() as session:
        count = await seed_categories(session)
        logger.info(f"Seed complete. {count} categories created.")


if __name__ == "__main__":
    asyncio.run(run_seed())
