#!/usr/bin/env python3
"""
Seed Repeatable Demo Incident Intelligence Data Script for Nirapotta AI.
Usage:
    python scripts/seed_demo_incidents.py [--db-url SQLALCHEMY_URL] [--reset]
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
from app.db.seed_demo_incidents import seed_demo_incidents_data


async def main():
    parser = argparse.ArgumentParser(description="Seed synthetic demo incident reports for Nirapotta AI Incident Intelligence.")
    parser.add_argument("--db-url", type=str, default=None, help="Custom database URL for testing/demo (defaults to settings.DATABASE_URL)")
    parser.add_argument("--init-tables", action="store_true", help="Create tables if using a fresh local database like SQLite")
    parser.add_argument("--reset", action="store_true", help="Reset/clean previously seeded demo incidents first")
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
        result = await seed_demo_incidents_data(session, reset_first=args.reset)
        print("--- Demo Incident Seeding Result ---")
        print(f"Status: {result.get('status')}")
        print(f"Demo Reports Seeded: {result.get('demo_reports_seeded')}")
        print(f"Total Demo Incidents: {result.get('total_demo_incidents')}")
        for key, r_id in result.get("report_ids", {}).items():
            print(f"  - {key}: {r_id}")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
