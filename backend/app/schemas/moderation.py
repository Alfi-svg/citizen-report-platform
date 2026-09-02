import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field
from app.models.moderation import ModerationAction
from app.schemas.user import UserResponse


class ModerationRecordBase(BaseModel):
    action: ModerationAction
    user_message: Optional[str] = None
    internal_notes: Optional[str] = None


class ModerationRecordCreate(ModerationRecordBase):
    report_id: uuid.UUID
    admin_id: Optional[uuid.UUID] = None


class ModerationRecordResponse(BaseModel):
    """Full moderation record view for authorized administrators."""
    id: uuid.UUID
    report_id: uuid.UUID
    admin_id: Optional[uuid.UUID] = None
    action: ModerationAction
    user_message: Optional[str] = None
    internal_notes: Optional[str] = None
    created_at: datetime
    admin: Optional[UserResponse] = None

    model_config = ConfigDict(from_attributes=True)


class UserFacingModerationResponse(BaseModel):
    """Sanitized moderation feedback exposed to the report owner."""
    id: uuid.UUID
    action: ModerationAction
    user_message: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ModerationActionRequest(BaseModel):
    """Request payload for admin moderation decisions."""
    user_message: Optional[str] = Field(
        None,
        max_length=2000,
        description="User-facing explanation visible to the reporter.",
    )
    internal_notes: Optional[str] = Field(
        None,
        max_length=2000,
        description="Private notes visible strictly to administrators.",
    )


class AdminDashboardStats(BaseModel):
    total_reports: int
    pending_reports: int
    under_review_reports: int
    approved_reports: int
    rejected_reports: int
    needs_more_info_reports: int
    archived_reports: int
    draft_reports: int
    total_users: int
    anonymous_reports_count: int
    total_flags: int = 0
    pending_flags: int = 0
    total_comments: int = 0
    hidden_comments: int = 0
    active_categories: int = 0


class AdminReportListResponse(BaseModel):
    items: List[dict]
    total: int
    limit: int
    offset: int
