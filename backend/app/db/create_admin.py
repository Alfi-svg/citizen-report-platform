import argparse
import asyncio
import os
import sys
from sqlalchemy import select
from app.core.security import get_password_hash
from app.db.session import async_session_factory
from app.models.user import User, UserRole


async def create_or_update_admin(email: str, username: str, password: str, full_name: str = "System Administrator"):
    """Bootstraps or updates an initial administrator account."""
    normalized_email = email.lower().strip()
    normalized_username = username.lower().strip()

    async with async_session_factory() as session:
        stmt = select(User).where(
            (User.email == normalized_email) | (User.username == normalized_username)
        )
        result = await session.execute(stmt)
        user = result.scalar_one_or_none()

        if user:
            user.role = UserRole.ADMIN
            user.is_active = True
            user.is_verified = True
            user.hashed_password = get_password_hash(password)
            if full_name:
                user.full_name = full_name
            await session.commit()
            print(f"Updated existing user '{user.username}' with ADMIN role.")
        else:
            admin = User(
                email=normalized_email,
                username=normalized_username,
                full_name=full_name,
                hashed_password=get_password_hash(password),
                role=UserRole.ADMIN,
                is_active=True,
                is_verified=True,
            )
            session.add(admin)
            await session.commit()
            print(f"Successfully created initial administrator '{admin.username}' ({admin.email}).")


def main():
    parser = argparse.ArgumentParser(description="Bootstrap an initial administrator user.")
    parser.add_argument("--email", default=os.getenv("ADMIN_EMAIL", "admin@citizenreport.gov.bd"), help="Admin email")
    parser.add_argument("--username", default=os.getenv("ADMIN_USERNAME", "admin"), help="Admin username")
    parser.add_argument("--password", default=os.getenv("ADMIN_PASSWORD", "Admin@Secure2026!"), help="Admin password")
    parser.add_argument("--name", default=os.getenv("ADMIN_NAME", "Lead Administrator"), help="Admin full name")

    args = parser.parse_args()

    if len(args.password) < 8:
        print("Error: Admin password must be at least 8 characters.")
        sys.exit(1)

    asyncio.run(create_or_update_admin(
        email=args.email,
        username=args.username,
        password=args.password,
        full_name=args.name,
    ))


if __name__ == "__main__":
    main()
