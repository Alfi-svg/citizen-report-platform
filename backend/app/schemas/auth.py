import re
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, field_validator
from app.schemas.user import UserResponse


class UserRegister(BaseModel):
    username: str = Field(
        ...,
        min_length=3,
        max_length=50,
        description="Unique username containing letters, numbers, underscores, or hyphens.",
    )
    email: EmailStr = Field(..., description="Valid email address.")
    password: str = Field(
        ...,
        min_length=8,
        max_length=128,
        description="Password with at least 8 characters.",
    )
    full_name: Optional[str] = Field(
        None,
        max_length=255,
        description="Optional citizen display or full name.",
    )

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        v = v.strip().lower()
        if not re.match(r"^[a-zA-Z0-9_-]+$", v):
            raise ValueError("Username may only contain letters, numbers, hyphens, and underscores.")
        return v

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long.")
        return v


class UserLogin(BaseModel):
    email_or_username: str = Field(
        ...,
        description="Email address or username of the registered user.",
    )
    password: str = Field(..., description="Account plaintext password.")


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class TokenPayload(BaseModel):
    sub: Optional[str] = None
    role: Optional[str] = None
    exp: Optional[int] = None


class LogoutResponse(BaseModel):
    message: str = "Successfully logged out"
