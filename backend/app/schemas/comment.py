import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field, field_validator
from app.models.comment import CommentStatus
from app.schemas.user import UserResponse


class CommentCreate(BaseModel):
    body: str = Field(..., min_length=1, max_length=1000, description="Comment text")

    @field_validator("body")
    @classmethod
    def validate_body(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("Comment body cannot be empty or whitespace only.")
        return trimmed


class CommentStatusUpdate(BaseModel):
    status: CommentStatus


class PublicCommentResponse(BaseModel):
    id: uuid.UUID
    report_id: uuid.UUID
    body: str
    status: CommentStatus
    created_at: datetime
    user_display_name: str
    is_own_comment: bool = False

    model_config = ConfigDict(from_attributes=True)


class AdminCommentResponse(BaseModel):
    id: uuid.UUID
    report_id: uuid.UUID
    user_id: uuid.UUID
    body: str
    status: CommentStatus
    created_at: datetime
    updated_at: datetime
    user: Optional[UserResponse] = None

    model_config = ConfigDict(from_attributes=True)


class CommentPagination(BaseModel):
    items: List[PublicCommentResponse]
    total: int
    limit: int
    offset: int
