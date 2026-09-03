import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field
from app.models.blood import (
    BloodGroup,
    BloodUrgency,
    BloodRequestStatus,
    DonorAvailability,
    ResponseStatus,
    BloodFlagStatus,
)


class BloodRequestCreate(BaseModel):
    blood_group: BloodGroup
    units_required: int = Field(default=1, ge=1, le=20)
    hospital_name: str = Field(..., min_length=2, max_length=255)
    hospital_area: str = Field(..., min_length=2, max_length=150)
    district: str = Field(..., min_length=2, max_length=100)
    required_date: datetime
    required_time: Optional[str] = Field(None, max_length=100)
    urgency: BloodUrgency = BloodUrgency.URGENT
    contact_name: Optional[str] = Field(None, max_length=150)
    contact_phone: Optional[str] = Field(None, max_length=50)
    contact_method: str = Field("PHONE", max_length=50)
    additional_information: Optional[str] = Field(None, max_length=2000)


class BloodRequestUpdate(BaseModel):
    units_required: Optional[int] = Field(None, ge=1, le=20)
    hospital_name: Optional[str] = Field(None, min_length=2, max_length=255)
    hospital_area: Optional[str] = Field(None, min_length=2, max_length=150)
    district: Optional[str] = Field(None, min_length=2, max_length=100)
    required_date: Optional[datetime] = None
    required_time: Optional[str] = None
    urgency: Optional[BloodUrgency] = None
    status: Optional[BloodRequestStatus] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_method: Optional[str] = None
    additional_information: Optional[str] = None


class PublicBloodRequest(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    blood_group: BloodGroup
    units_required: int
    hospital_name: str
    hospital_area: str
    district: str
    required_date: datetime
    required_time: Optional[str] = None
    urgency: BloodUrgency
    status: BloodRequestStatus
    additional_information: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    is_own_request: bool = False
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_method: Optional[str] = None
    response_count: int = 0


class BloodRequestPagination(BaseModel):
    items: List[PublicBloodRequest]
    total: int
    limit: int
    offset: int


class DonorProfileCreate(BaseModel):
    blood_group: BloodGroup
    district: str = Field(..., min_length=2, max_length=100)
    area: str = Field(..., min_length=2, max_length=150)
    availability_status: DonorAvailability = DonorAvailability.AVAILABLE
    last_donation_date: Optional[datetime] = None
    preferred_contact_method: str = Field("IN_APP", max_length=50)
    contact_phone: Optional[str] = Field(None, max_length=50)
    additional_notes: Optional[str] = Field(None, max_length=1000)


class DonorProfileUpdate(BaseModel):
    blood_group: Optional[BloodGroup] = None
    district: Optional[str] = Field(None, min_length=2, max_length=100)
    area: Optional[str] = Field(None, min_length=2, max_length=150)
    availability_status: Optional[DonorAvailability] = None
    last_donation_date: Optional[datetime] = None
    preferred_contact_method: Optional[str] = None
    contact_phone: Optional[str] = None
    additional_notes: Optional[str] = None


class DonorProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    blood_group: BloodGroup
    district: str
    area: str
    availability_status: DonorAvailability
    last_donation_date: Optional[datetime] = None
    preferred_contact_method: str
    contact_phone: Optional[str] = None
    additional_notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class BloodRespondCreate(BaseModel):
    message: Optional[str] = Field(None, max_length=1000)
    contact_phone: Optional[str] = Field(None, max_length=50)


class BloodResponseItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    request_id: uuid.UUID
    donor_user_id: uuid.UUID
    donor_display_name: str
    message: Optional[str] = None
    contact_phone: Optional[str] = None
    status: ResponseStatus
    created_at: datetime


class BloodFlagCreate(BaseModel):
    reason: str = Field(..., min_length=2, max_length=100)
    details: Optional[str] = Field(None, max_length=1000)


class BloodFlagItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    request_id: uuid.UUID
    reporter_user_id: uuid.UUID
    reason: str
    details: Optional[str] = None
    status: BloodFlagStatus
    created_at: datetime
