from typing import Any, Dict
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_current_user, get_current_active_admin
from app.core.security import get_password_hash, verify_password, create_access_token
from app.db.session import get_db
from app.models.user import User, UserRole
from app.schemas.auth import UserRegister, UserLogin, Token, LogoutResponse
from app.schemas.user import UserResponse

router = APIRouter()


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new citizen account",
)
async def register(
    user_in: UserRegister,
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Register a new standard citizen user account.
    - Password is validated and securely hashed with bcrypt.
    - Duplicate email and username checks are enforced.
    - Default role is unconditionally set to USER.
    """
    normalized_email = user_in.email.lower().strip()
    normalized_username = user_in.username.lower().strip()

    # Check for existing email or username
    stmt = select(User).where(
        or_(
            User.email == normalized_email,
            User.username == normalized_username,
        )
    )
    result = await db.execute(stmt)
    existing_user = result.scalar_one_or_none()

    if existing_user:
        if existing_user.email == normalized_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An account with this email address already exists.",
            )
        if existing_user.username == normalized_username:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An account with this username is already taken.",
            )

    # Hash the password and create the user
    user = User(
        email=normalized_email,
        username=normalized_username,
        full_name=user_in.full_name.strip() if user_in.full_name else None,
        hashed_password=get_password_hash(user_in.password),
        role=UserRole.USER,
        is_active=True,
        is_verified=False,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    return user


@router.post(
    "/login",
    response_model=Token,
    status_code=status.HTTP_200_OK,
    summary="Authenticate and receive an access token",
)
async def login(
    login_data: UserLogin,
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Authenticate a user via email or username and password.
    Returns a signed JWT bearer token and public user profile.
    """
    identifier = login_data.email_or_username.lower().strip()

    # Look up by email or username
    stmt = select(User).where(
        or_(
            User.email == identifier,
            User.username == identifier,
        )
    )
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email/username or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated.",
        )

    access_token = create_access_token(
        subject=user.id,
        role=user.role.value,
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user,
    }


@router.post(
    "/logout",
    response_model=LogoutResponse,
    status_code=status.HTTP_200_OK,
    summary="Log out active session",
)
async def logout(
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Invalidates client authentication session.
    """
    return {"message": "Successfully logged out"}


@router.get(
    "/me",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Get profile of currently authenticated user",
)
async def get_me(
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Returns the authenticated user's profile details.
    Password hashes and security internals are never exposed.
    """
    return current_user


@router.get(
    "/admin-check",
    response_model=Dict[str, Any],
    status_code=status.HTTP_200_OK,
    summary="Verify administrative permissions",
)
async def check_admin_access(
    admin_user: User = Depends(get_current_active_admin),
) -> Any:
    """
    Protected endpoint accessible exclusively by administrators.
    """
    return {
        "message": "Admin authorization confirmed",
        "admin_id": str(admin_user.id),
        "username": admin_user.username,
        "email": admin_user.email,
        "role": admin_user.role.value,
    }
