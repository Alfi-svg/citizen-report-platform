import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field, computed_field
from app.schemas.category import CategoryResponse


class PublicMediaResponse(BaseModel):
    id: uuid.UUID
    file_name: str
    mime_type: str
    file_size: int
    caption: Optional[str] = None
    media_type: str
    download_url: str

    model_config = ConfigDict(from_attributes=True)


class PublicReportListItem(BaseModel):
    id: uuid.UUID
    category_id: uuid.UUID
    category: Optional[CategoryResponse] = None
    title: str
    description: str
    location_text: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    incident_date: Optional[datetime] = None
    submitted_at: Optional[datetime] = None
    created_at: datetime
    is_anonymous: bool
    reporter_display_name: Optional[str] = None
    media: List[PublicMediaResponse] = Field(default_factory=list)
    media_count: int = 0
    has_evidence: bool = False
    review_status: str = "Platform Reviewed"

    model_config = ConfigDict(from_attributes=True)


class PublicReportDetailResponse(PublicReportListItem):
    pass


class PublicCategoryResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    description: Optional[str] = None
    approved_reports_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class PublicReportPagination(BaseModel):
    items: List[PublicReportListItem]
    total: int
    limit: int
    offset: int
