import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field, field_validator
from app.models.flag import FlagTargetType, FlagStatus, ReportFlagReason, CommentFlagReason


class ReportFlagCreate(BaseModel):
    reason: ReportFlagReason
    details: Optional[str] = Field(None, max_length=500, description="Optional explanation for flag")

    @field_validator("details")
    @classmethod
    def clean_details(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        trimmed = v.strip()
        return trimmed if trimmed else None


class CommentFlagCreate(BaseModel):
    reason: CommentFlagReason
    details: Optional[str] = Field(None, max_length=500, description="Optional explanation for flag")

    @field_validator("details")
    @classmethod
    def clean_details(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        trimmed = v.strip()
        return trimmed if trimmed else None


class FlagResponse(BaseModel):
    id: uuid.UUID
    target_type: FlagTargetType
    report_id: Optional[uuid.UUID] = None
    comment_id: Optional[uuid.UUID] = None
    reason: str
    status: FlagStatus
    created_at: datetime
    message: str = "Thank you. Your flag has been submitted for moderation review."

    model_config = ConfigDict(from_attributes=True)


class AdminFlagUpdate(BaseModel):
    status: FlagStatus
    admin_notes: Optional[str] = Field(None, max_length=1000)


class AdminFlagResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    target_type: FlagTargetType
    report_id: Optional[uuid.UUID] = None
    comment_id: Optional[uuid.UUID] = None
    reason: str
    details: Optional[str] = None
    status: FlagStatus
    reviewed_by: Optional[uuid.UUID] = None
    reviewed_at: Optional[datetime] = None
    admin_notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    flagger_username: Optional[str] = None
    target_snippet: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class AdminFlagPagination(BaseModel):
    items: List[AdminFlagResponse]
    total: int
    limit: int
    offset: int
