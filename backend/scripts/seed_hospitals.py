#!/usr/bin/env python3
import asyncio
import logging
import sys
import os

# Ensure backend directory is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.session import async_session_factory
from app.db.seed_hospitals import seed_hospitals_and_inventory

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("seed_hospitals_cli")


async def main():
    logger.info("Starting verified hospital and blood inventory database seeding...")
    async with async_session_factory() as session:
        result = await seed_hospitals_and_inventory(session)
        logger.info(
            "Seeding successful! Hospitals: %s, Inventories: %s (Total defined: %s)",
            result["hospitals_created"],
            result["inventories_created"],
            result["total_hospitals_defined"],
        )


if __name__ == "__main__":
    asyncio.run(main())
