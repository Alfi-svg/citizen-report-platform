import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict
from app.models.report import ReportStatus
from app.schemas.category import CategoryResponse
from app.schemas.report_media import ReportMediaResponse
from app.schemas.user import UserResponse


class ReportBase(BaseModel):
    title: str
    description: str
    location_text: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    incident_date: Optional[datetime] = None
    is_anonymous: bool = False


class ReportCreate(ReportBase):
    category_id: uuid.UUID


class ReportUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    location_text: Optional[str] = None
    category_id: Optional[uuid.UUID] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    incident_date: Optional[datetime] = None
    is_anonymous: Optional[bool] = None
    status: Optional[ReportStatus] = None


class ReportResponse(ReportBase):
    """Internal & Administrative report view with full reporter details."""
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
