import asyncio
import os
import sys

# Ensure backend root is in PYTHONPATH
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.session import async_session_factory
from app.db.seed_accident_zones import seed_accident_zones


async def main():
    print("Seeding documented Bangladesh accident-prone zones...")
    async with async_session_factory() as db:
        count = await seed_accident_zones(db)
        print(f"Successfully seeded {count} accident-prone zones.")


if __name__ == "__main__":
    asyncio.run(main())
