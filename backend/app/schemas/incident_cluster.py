import uuid
from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, ConfigDict, Field


# ==============================================================================
# 1. PUBLIC MAP SCHEMAS
# ==============================================================================

class PublicMapIncidentPoint(BaseModel):
    id: uuid.UUID
    title: str
    category_name: str
    category_slug: str
    location_text: str
    approximate_latitude: float
    approximate_longitude: float
    incident_date: Optional[datetime] = None
    created_at: datetime
    status: str = "APPROVED"
    cluster_id: Optional[uuid.UUID] = None
    cluster_title: Optional[str] = None
    is_missing_person: bool = False
    missing_person_alert_id: Optional[uuid.UUID] = None
    missing_person_status: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class PublicMapClusterPoint(BaseModel):
    id: uuid.UUID
    title: str
    title_bn: Optional[str] = None
    category_name: Optional[str] = None
    category_slug: Optional[str] = None
    summary: Optional[str] = None
    area: Optional[str] = None
    approximate_latitude: float
    approximate_longitude: float
    member_count: int = 0
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PublicSafetyMapResponse(BaseModel):
    incidents: List[PublicMapIncidentPoint]
    clusters: List[PublicMapClusterPoint]
    total_incidents: int
    total_clusters: int
    applied_filters: Dict[str, Any] = Field(default_factory=dict)


class PublicRelatedReportResponse(BaseModel):
    id: uuid.UUID
    title: str
    category_name: str
    category_slug: str
    location_text: str
    approximate_latitude: Optional[float] = None
    approximate_longitude: Optional[float] = None
    incident_date: Optional[datetime] = None
    created_at: datetime
    status: str = "APPROVED"
    relationship_type: Optional[str] = "SIMILAR_INCIDENT"
    similarity_score: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)


# ==============================================================================
# 2. ADMIN CLUSTER MANAGEMENT SCHEMAS
# ==============================================================================

class IncidentClusterCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=255)
    title_bn: Optional[str] = Field(None, max_length=255)
    category_id: Optional[uuid.UUID] = None
    summary: Optional[str] = None
    summary_bn: Optional[str] = None
    approximate_latitude: Optional[float] = None
    approximate_longitude: Optional[float] = None
    area: Optional[str] = Field(None, max_length=255)
    is_active: bool = True
    initial_report_ids: Optional[List[uuid.UUID]] = None


class IncidentClusterUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=3, max_length=255)
    title_bn: Optional[str] = Field(None, max_length=255)
    category_id: Optional[uuid.UUID] = None
    summary: Optional[str] = None
    summary_bn: Optional[str] = None
    approximate_latitude: Optional[float] = None
    approximate_longitude: Optional[float] = None
    area: Optional[str] = Field(None, max_length=255)
    is_active: Optional[bool] = None


class IncidentClusterMemberCreate(BaseModel):
    report_id: uuid.UUID
    relationship_type: str = Field("SIMILAR_INCIDENT", max_length=50)
    similarity_score: Optional[float] = None


class IncidentClusterMemberResponse(BaseModel):
    id: uuid.UUID
    cluster_id: uuid.UUID
    report_id: uuid.UUID
    report_title: str
    report_status: str
    report_category: str
    relationship_type: str
    similarity_score: Optional[float] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class IncidentClusterDetailResponse(BaseModel):
    id: uuid.UUID
    title: str
    title_bn: Optional[str] = None
    category_id: Optional[uuid.UUID] = None
    category_name: Optional[str] = None
    summary: Optional[str] = None
    summary_bn: Optional[str] = None
    approximate_latitude: Optional[float] = None
    approximate_longitude: Optional[float] = None
    area: Optional[str] = None
    is_active: bool
    member_count: int = 0
    members: List[IncidentClusterMemberResponse] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class IncidentClusterListResponse(BaseModel):
    items: List[IncidentClusterDetailResponse]
    total: int
    limit: int
    offset: int


# ==============================================================================
# 3. SIMILARITY & INTELLIGENCE SCHEMAS
# ==============================================================================

class SimilarityBreakdown(BaseModel):
    geo_score: float = 0.0
    time_score: float = 0.0
    category_score: float = 0.0
    text_score: float = 0.0
    total_score: float = 0.0
    distance_km: Optional[float] = None
    time_diff_hours: Optional[float] = None


class SuggestedRelatedReportResponse(BaseModel):
    report_id: uuid.UUID
    title: str
    category_name: str
    location_text: str
    created_at: datetime
    incident_date: Optional[datetime] = None
    status: str
    similarity: SimilarityBreakdown
