import uuid
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field
from app.models.missing_person import AlertStatus, SightingStatus


# ------------------------------------------------------------------------------
# 1. PROFILE SCHEMAS
# ------------------------------------------------------------------------------

class MissingPersonProfileBase(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=200)
    name_bn: Optional[str] = Field(None, max_length=200)
    age: Optional[int] = Field(None, ge=0, le=130)
    approximate_age: Optional[str] = Field(None, max_length=50)
    gender: Optional[str] = Field(None, max_length=50)
    photo_url: Optional[str] = Field(None, max_length=1000)
    height: Optional[str] = Field(None, max_length=100)
    clothing: Optional[str] = None
    clothing_bn: Optional[str] = None
    identifying_features: Optional[str] = None
    identifying_features_bn: Optional[str] = None
    last_seen_location: str = Field(..., min_length=1, max_length=255)
    last_seen_location_bn: Optional[str] = Field(None, max_length=255)
    last_seen_latitude: Optional[float] = Field(None, ge=-90.0, le=90.0)
    last_seen_longitude: Optional[float] = Field(None, ge=-180.0, le=180.0)
    last_seen_time: Optional[datetime] = None
    description: Optional[str] = None
    contact_information: Optional[str] = Field(None, max_length=255)
    reporting_authority: Optional[str] = Field(None, max_length=255)
    source: Optional[str] = Field(None, max_length=255)


class MissingPersonProfileCreate(MissingPersonProfileBase):
    pass


class MissingPersonProfileUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=1, max_length=200)
    name_bn: Optional[str] = None
    age: Optional[int] = Field(None, ge=0, le=130)
    approximate_age: Optional[str] = None
    gender: Optional[str] = None
    photo_url: Optional[str] = None
    height: Optional[str] = None
    clothing: Optional[str] = None
    clothing_bn: Optional[str] = None
    identifying_features: Optional[str] = None
    identifying_features_bn: Optional[str] = None
    last_seen_location: Optional[str] = None
    last_seen_location_bn: Optional[str] = None
    last_seen_latitude: Optional[float] = Field(None, ge=-90.0, le=90.0)
    last_seen_longitude: Optional[float] = Field(None, ge=-180.0, le=180.0)
    last_seen_time: Optional[datetime] = None
    description: Optional[str] = None
    contact_information: Optional[str] = None
    reporting_authority: Optional[str] = None
    source: Optional[str] = None


class MissingPersonProfileResponse(MissingPersonProfileBase):
    id: uuid.UUID
    report_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ------------------------------------------------------------------------------
# 2. SIGHTING SCHEMAS
# ------------------------------------------------------------------------------

class MissingPersonSightingCreate(BaseModel):
    approximate_location: str = Field(..., min_length=1, max_length=255)
    latitude: Optional[float] = Field(None, ge=-90.0, le=90.0)
    longitude: Optional[float] = Field(None, ge=-180.0, le=180.0)
    sighting_date: Optional[datetime] = None
    sighting_time: Optional[str] = Field(None, max_length=100)
    description: str = Field(..., min_length=5)
    clothing: Optional[str] = Field(None, max_length=500)
    direction: Optional[str] = Field(None, max_length=255)
    additional_information: Optional[str] = Field(None, max_length=1000)
    photo_url: Optional[str] = Field(None, max_length=1000)


class PublicMissingPersonSightingResponse(BaseModel):
    id: uuid.UUID
    alert_id: uuid.UUID
    approximate_location: str
    sighting_date: Optional[datetime] = None
    sighting_time: Optional[str] = None
    description: str
    clothing: Optional[str] = None
    direction: Optional[str] = None
    photo_url: Optional[str] = None
    status: SightingStatus
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AdminMissingPersonSightingResponse(PublicMissingPersonSightingResponse):
    user_id: Optional[uuid.UUID] = None
    additional_information: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    reviewed_by_admin_id: Optional[uuid.UUID] = None
    reviewed_at: Optional[datetime] = None
    admin_notes: Optional[str] = None
    is_potential_duplicate: bool = False
    duplicate_reason: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class AdminSightingModerationRequest(BaseModel):
    status: SightingStatus
    admin_notes: Optional[str] = None


# ------------------------------------------------------------------------------
# 3. ALERT ACTIVATION & LIFECYCLE SCHEMAS
# ------------------------------------------------------------------------------

class MissingPersonAlertActivateRequest(BaseModel):
    alert_radius_km: float = Field(10.0, ge=0.5, le=100.0)
    alert_expiry_days: Optional[int] = Field(30, ge=1, le=90)
    activation_notes: Optional[str] = None


class MissingPersonFoundRequest(BaseModel):
    found_notes: Optional[str] = None


class PublicMissingPersonAlertResponse(BaseModel):
    id: uuid.UUID
    report_id: uuid.UUID
    status: AlertStatus
    is_active: bool
    alert_radius_km: float
    alert_expiry: Optional[datetime] = None
    activated_at: Optional[datetime] = None
    found_at: Optional[datetime] = None
    profile: MissingPersonProfileResponse
    approved_sightings: List[PublicMissingPersonSightingResponse] = []
    approved_sightings_count: int = 0
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AdminMissingPersonAlertResponse(PublicMissingPersonAlertResponse):
    activated_by_admin_id: Optional[uuid.UUID] = None
    activation_notes: Optional[str] = None
    found_by_admin_id: Optional[uuid.UUID] = None
    found_notes: Optional[str] = None
    total_sightings_count: int = 0
    pending_sightings_count: int = 0
    duplicate_candidates_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class AdminMissingPersonAlertPagination(BaseModel):
    items: List[AdminMissingPersonAlertResponse]
    total: int
    limit: int
    offset: int


class PublicMissingPersonAlertPagination(BaseModel):
    items: List[PublicMissingPersonAlertResponse]
    total: int
    limit: int
    offset: int


# ------------------------------------------------------------------------------
# 4. USER NOTIFICATION PREFERENCES
# ------------------------------------------------------------------------------

class UserNotificationPreferenceResponse(BaseModel):
    user_id: uuid.UUID
    missing_person_alerts: bool
    nearby_safety_alerts: bool
    last_known_latitude: Optional[float] = None
    last_known_longitude: Optional[float] = None
    last_location_updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class UserNotificationPreferenceUpdate(BaseModel):
    missing_person_alerts: Optional[bool] = None
    nearby_safety_alerts: Optional[bool] = None
    latitude: Optional[float] = Field(None, ge=-90.0, le=90.0)
    longitude: Optional[float] = Field(None, ge=-180.0, le=180.0)
