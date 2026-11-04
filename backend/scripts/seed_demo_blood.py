#!/usr/bin/env python3
"""
Seed Repeatable Demo Blood Data Script for Nirapotta AI.
Usage:
    python scripts/seed_demo_blood.py [--db-url SQLALCHEMY_URL]
"""
import sys
import os
import asyncio
import argparse

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.core.config import settings
from app.models.base import Base
from app.db.seed_demo_blood import seed_demo_blood_data


async def main():
    parser = argparse.ArgumentParser(description="Seed synthetic demo blood donors and requests for Nirapotta AI.")
    parser.add_argument("--db-url", type=str, default=None, help="Custom database URL for testing/demo (defaults to settings.DATABASE_URL)")
    parser.add_argument("--init-tables", action="store_true", help="Create tables if using a fresh local database like SQLite")
    args = parser.parse_args()

    target_url = args.db_url or os.getenv("DEMO_DATABASE_URL") or settings.DATABASE_URL

    if target_url.startswith("postgres://"):
        target_url = "postgresql+asyncpg://" + target_url[len("postgres://"):]
    elif target_url.startswith("postgresql://") and not target_url.startswith("postgresql+asyncpg://"):
        target_url = "postgresql+asyncpg://" + target_url[len("postgresql://"):]

    print(f"Connecting to database: {target_url.split('@')[-1] if '@' in target_url else target_url}")

    is_sqlite = target_url.startswith("sqlite")
    engine_kwargs = {"echo": False, "future": True}
    if not is_sqlite:
        engine_kwargs["pool_pre_ping"] = True

    engine = create_async_engine(target_url, **engine_kwargs)
    session_factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

    if args.init_tables or is_sqlite:
        print("Ensuring database tables exist...")
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    async with session_factory() as session:
        result = await seed_demo_blood_data(session)
        print(f"Seeding completed successfully!")
        print(f"- Seeded Donors: {result['seeded_donors_count']}")
        print(f"- Seeded Requesters: {result['seeded_requesters_count']}")
        print(f"- Seeded Requests: {result['seeded_requests_count']}")
        print(f"- Seeded Responses: {result['seeded_responses_count']}")
        print("\nRequest IDs for testing:")
        for name, req_id in result["requests"].items():
            print(f"  {name}: {req_id}")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
