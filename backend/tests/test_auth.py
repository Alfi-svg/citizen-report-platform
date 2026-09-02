import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.security import get_password_hash, create_access_token
from app.models.user import User, UserRole
from app.db.create_admin import create_or_update_admin


@pytest.mark.asyncio
async def test_register_success(async_client: AsyncClient):
    payload = {
        "username": "citizen_rahim",
        "email": "rahim@example.com",
        "password": "Password123!",
        "full_name": "Abdur Rahim",
    }
    response = await async_client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["username"] == "citizen_rahim"
    assert data["email"] == "rahim@example.com"
    assert data["full_name"] == "Abdur Rahim"
    assert data["role"] == "USER"
    assert data["is_active"] is True
    assert "password" not in data
    assert "hashed_password" not in data


@pytest.mark.asyncio
async def test_register_duplicate_email(async_client: AsyncClient, db_session: AsyncSession):
    user = User(
        email="existing@example.com",
        username="existing_user",
        hashed_password=get_password_hash("pw123456"),
    )
    db_session.add(user)
    await db_session.commit()

    payload = {
        "username": "new_unique_user",
        "email": "existing@example.com",
        "password": "Password123!",
    }
    response = await async_client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 400
    assert "email address already exists" in response.json()["detail"]


@pytest.mark.asyncio
async def test_register_duplicate_username(async_client: AsyncClient, db_session: AsyncSession):
    user = User(
        email="unique1@example.com",
        username="unique_handle",
        hashed_password=get_password_hash("pw123456"),
    )
    db_session.add(user)
    await db_session.commit()

    payload = {
        "username": "unique_handle",
        "email": "different@example.com",
        "password": "Password123!",
    }
    response = await async_client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 400
    assert "username is already taken" in response.json()["detail"]


@pytest.mark.asyncio
async def test_register_validation_errors(async_client: AsyncClient):
    # Short password (< 8 chars)
    response = await async_client.post(
        "/api/v1/auth/register",
        json={
            "username": "valid_user",
            "email": "valid@example.com",
            "password": "123",
        },
    )
    assert response.status_code == 422

    # Invalid email format
    response = await async_client.post(
        "/api/v1/auth/register",
        json={
            "username": "valid_user",
            "email": "not-an-email",
            "password": "ValidPassword123!",
        },
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_login_flow(async_client: AsyncClient, db_session: AsyncSession):
    plain_password = "SecurePassword2026!"
    user = User(
        email="login_test@example.com",
        username="login_test_user",
        full_name="Login Test User",
        hashed_password=get_password_hash(plain_password),
        role=UserRole.USER,
    )
    db_session.add(user)
    await db_session.commit()

    # Login with email
    response = await async_client.post(
        "/api/v1/auth/login",
        json={"email_or_username": "login_test@example.com", "password": plain_password},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "login_test@example.com"

    # Login with username
    response = await async_client.post(
        "/api/v1/auth/login",
        json={"email_or_username": "login_test_user", "password": plain_password},
    )
    assert response.status_code == 200
    assert "access_token" in response.json()

    # Login with incorrect password
    bad_resp = await async_client.post(
        "/api/v1/auth/login",
        json={"email_or_username": "login_test@example.com", "password": "WrongPassword!"},
    )
    assert bad_resp.status_code == 401

    # Login with non-existent account
    non_existent = await async_client.post(
        "/api/v1/auth/login",
        json={"email_or_username": "nobody@example.com", "password": "AnyPassword123!"},
    )
    assert non_existent.status_code == 401


@pytest.mark.asyncio
async def test_get_me_and_logout(async_client: AsyncClient, db_session: AsyncSession):
    user = User(
        email="me_test@example.com",
        username="me_tester",
        hashed_password=get_password_hash("password123"),
        role=UserRole.USER,
    )
    db_session.add(user)
    await db_session.commit()

    token = create_access_token(subject=user.id, role=user.role.value)
    headers = {"Authorization": f"Bearer {token}"}

    # Authenticated /me
    response = await async_client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["username"] == "me_tester"
    assert data["email"] == "me_test@example.com"
    assert "password" not in data
    assert "hashed_password" not in data

    # Unauthenticated /me
    unauth = await async_client.get("/api/v1/auth/me")
    assert unauth.status_code == 401

    # Logout
    logout_resp = await async_client.post("/api/v1/auth/logout", headers=headers)
    assert logout_resp.status_code == 200
    assert logout_resp.json()["message"] == "Successfully logged out"


@pytest.mark.asyncio
async def test_admin_authorization(async_client: AsyncClient, db_session: AsyncSession):
    # Create regular user
    user = User(
        email="regular@example.com",
        username="regular_user",
        hashed_password=get_password_hash("password123"),
        role=UserRole.USER,
    )
    # Create admin user
    admin = User(
        email="admin_auth@example.com",
        username="admin_auth_user",
        hashed_password=get_password_hash("password123"),
        role=UserRole.ADMIN,
    )
    db_session.add_all([user, admin])
    await db_session.commit()

    user_token = create_access_token(subject=user.id, role=user.role.value)
    admin_token = create_access_token(subject=admin.id, role=admin.role.value)

    # 1. Unauthenticated -> 401
    resp_unauth = await async_client.get("/api/v1/auth/admin-check")
    assert resp_unauth.status_code == 401

    # 2. Regular user accessing admin route -> 403 Forbidden
    resp_user = await async_client.get(
        "/api/v1/auth/admin-check",
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert resp_user.status_code == 403
    assert "Administrative privileges required" in resp_user.json()["detail"]

    # 3. Admin user accessing admin route -> 200 OK
    resp_admin = await async_client.get(
        "/api/v1/auth/admin-check",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp_admin.status_code == 200
    assert resp_admin.json()["role"] == "ADMIN"
    assert resp_admin.json()["username"] == "admin_auth_user"


@pytest.mark.asyncio
async def test_end_to_end_auth_flow(async_client: AsyncClient):
    # 1. Register a new user
    reg_resp = await async_client.post(
        "/api/v1/auth/register",
        json={
            "username": "e2e_citizen",
            "email": "e2e@example.com",
            "password": "SecurePassword123!",
            "full_name": "E2E Citizen User",
        },
    )
    assert reg_resp.status_code == 201

    # 2. Login
    login_resp = await async_client.post(
        "/api/v1/auth/login",
        json={
            "email_or_username": "e2e@example.com",
            "password": "SecurePassword123!",
        },
    )
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]

    # 3. Access current user profile
    headers = {"Authorization": f"Bearer {token}"}
    me_resp = await async_client.get("/api/v1/auth/me", headers=headers)
    assert me_resp.status_code == 200
    assert me_resp.json()["username"] == "e2e_citizen"

    # 4. Try accessing admin check (expect 403 Forbidden)
    admin_check_resp = await async_client.get("/api/v1/auth/admin-check", headers=headers)
    assert admin_check_resp.status_code == 403

    # 5. Logout
    logout_resp = await async_client.post("/api/v1/auth/logout", headers=headers)
    assert logout_resp.status_code == 200


@pytest.mark.asyncio
async def test_create_or_update_admin_bootstrap(db_session: AsyncSession, async_client: AsyncClient):
    from app.db.create_admin import create_or_update_admin

    # 1. Create a regular user first
    reg_user = User(
        email="bootstrap_candidate@example.com",
        username="candidate_user",
        hashed_password=get_password_hash("oldpassword123"),
        role=UserRole.USER,
        is_active=False,
    )
    db_session.add(reg_user)
    await db_session.commit()

    # 2. Upgrade to ADMIN using bootstrap helper
    from unittest.mock import patch
    with patch("app.db.create_admin.async_session_factory") as mock_factory:
        mock_factory.return_value.__aenter__.return_value = db_session
        mock_factory.return_value.__aexit__.return_value = None

        await create_or_update_admin(
            email="bootstrap_candidate@example.com",
            username="candidate_user",
            password="NewAdminPassword2026!",
            full_name="Upgraded Admin",
        )

    # 3. Verify user is now active ADMIN
    from sqlalchemy import select
    result = await db_session.execute(select(User).where(User.username == "candidate_user"))
    user = result.scalar_one()
    assert user.role == UserRole.ADMIN
    assert user.is_active is True
    assert user.is_verified is True
    assert user.full_name == "Upgraded Admin"


