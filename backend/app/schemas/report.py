import uuid
from datetime import datetime, timezone
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field, field_validator
from app.models.report import ReportStatus
from app.schemas.category import CategoryResponse
from app.schemas.report_media import ReportMediaResponse
from app.schemas.user import UserResponse
from app.schemas.moderation import UserFacingModerationResponse, ModerationRecordResponse


class ReportBase(BaseModel):
    title: str = Field(
        ...,
        min_length=5,
        max_length=255,
        description="Clear and concise incident title.",
    )
    description: str = Field(
        ...,
        min_length=10,
        max_length=5000,
        description="Detailed description of the incident.",
    )
    location_text: str = Field(
        ...,
        min_length=3,
        max_length=255,
        description="Physical location or landmark in Bangladesh.",
    )
    latitude: Optional[float] = Field(None, ge=-90.0, le=90.0)
    longitude: Optional[float] = Field(None, ge=-180.0, le=180.0)
    incident_date: Optional[datetime] = None
    is_anonymous: bool = Field(
        default=False,
        description="True if citizen desires reporter identity masked from public view.",
    )

    @field_validator("title", "description", "location_text")
    @classmethod
    def strip_whitespace(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Field cannot be empty or whitespace only.")
        return v

    @field_validator("incident_date")
    @classmethod
    def validate_incident_date(cls, v: Optional[datetime]) -> Optional[datetime]:
        if v is not None:
            now = datetime.now(timezone.utc)
            if v.tzinfo is None:
                v = v.replace(tzinfo=timezone.utc)
            if v > now:
                raise ValueError("Incident date and time cannot be in the future.")
        return v


class ReportCreate(ReportBase):
    category_id: uuid.UUID
    status: Optional[ReportStatus] = Field(
        default=ReportStatus.DRAFT,
        description="Initial status: DRAFT or SUBMITTED.",
    )

    @field_validator("status")
    @classmethod
    def validate_initial_status(cls, v: Optional[ReportStatus]) -> Optional[ReportStatus]:
        if v is not None and v not in (ReportStatus.DRAFT, ReportStatus.SUBMITTED):
            raise ValueError("New reports may only be created in DRAFT or SUBMITTED status.")
        return v


class ReportUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=5, max_length=255)
    description: Optional[str] = Field(None, min_length=10, max_length=5000)
    location_text: Optional[str] = Field(None, min_length=3, max_length=255)
    category_id: Optional[uuid.UUID] = None
    latitude: Optional[float] = Field(None, ge=-90.0, le=90.0)
    longitude: Optional[float] = Field(None, ge=-180.0, le=180.0)
    incident_date: Optional[datetime] = None
    is_anonymous: Optional[bool] = None
    status: Optional[ReportStatus] = None

    @field_validator("title", "description", "location_text")
    @classmethod
    def strip_optional_whitespace(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            if not v:
                raise ValueError("Field cannot be empty or whitespace only.")
        return v

    @field_validator("incident_date")
    @classmethod
    def validate_update_incident_date(cls, v: Optional[datetime]) -> Optional[datetime]:
        if v is not None:
            now = datetime.now(timezone.utc)
            if v.tzinfo is None:
                v = v.replace(tzinfo=timezone.utc)
            if v > now:
                raise ValueError("Incident date and time cannot be in the future.")
        return v


class ReportResponse(ReportBase):
    """User-facing report view. Only includes user-visible feedback."""
    id: uuid.UUID
    user_id: Optional[uuid.UUID] = None
    category_id: uuid.UUID
    status: ReportStatus
    submitted_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    category: Optional[CategoryResponse] = None
    user: Optional[UserResponse] = None
    media: Optional[List[ReportMediaResponse]] = None
    moderation_records: Optional[List[UserFacingModerationResponse]] = None

    model_config = ConfigDict(from_attributes=True)


class AdminReportResponse(ReportBase):
    """Full administrative report view with complete moderation audit records."""
    id: uuid.UUID
    user_id: Optional[uuid.UUID] = None
    category_id: uuid.UUID
    status: ReportStatus
    submitted_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    category: Optional[CategoryResponse] = None
    user: Optional[UserResponse] = None
    media: Optional[List[ReportMediaResponse]] = None
    moderation_records: Optional[List[ModerationRecordResponse]] = None

    model_config = ConfigDict(from_attributes=True)


class ReportPublicResponse(ReportBase):
    """Public report view where reporter identity is sanitized if report is anonymous."""
    id: uuid.UUID
    category_id: uuid.UUID
    status: ReportStatus
    submitted_at: Optional[datetime] = None
    created_at: datetime
    category: Optional[CategoryResponse] = None
    media: Optional[List[ReportMediaResponse]] = None

    # Exposed reporter username only when not anonymous
    reporter_username: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class AdminReportPagination(BaseModel):
    items: List[AdminReportResponse]
    total: int
    limit: int
    offset: int
