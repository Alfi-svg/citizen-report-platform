import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field, field_validator
from app.models.emergency_service import ServiceType, VerificationStatus


class EmergencyServiceBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=255, description="Official English name")
    name_bn: Optional[str] = Field(None, max_length=255, description="Official Bangla name")
    service_type: ServiceType
    district: str = Field(..., min_length=2, max_length=100, description="District / Zila")
    area: str = Field(..., min_length=2, max_length=100, description="Thana / Area")
    address: str = Field(..., min_length=5, description="Physical address in English")
    address_bn: Optional[str] = Field(None, description="Physical address in Bangla")
    phone: str = Field(..., min_length=3, max_length=50, description="Primary official hotline / phone")
    alternate_phone: Optional[str] = Field(None, max_length=100, description="Alternate phone number")
    latitude: float = Field(..., ge=-90.0, le=90.0, description="WGS84 latitude")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="WGS84 longitude")
    source: str = Field(default="Official Bangladesh Police Directory", max_length=255)
    source_url: Optional[str] = Field(None, max_length=500)
    verification_status: VerificationStatus = Field(default=VerificationStatus.VERIFIED)
    is_active: bool = Field(default=True)

    @field_validator("name", "district", "area", "address", "phone")
    @classmethod
    def strip_and_validate(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("Field cannot be empty or whitespace.")
        return trimmed


class EmergencyServiceCreate(EmergencyServiceBase):
    pass


class EmergencyServiceUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    name_bn: Optional[str] = Field(None, max_length=255)
    service_type: Optional[ServiceType] = None
    district: Optional[str] = Field(None, min_length=2, max_length=100)
    area: Optional[str] = Field(None, min_length=2, max_length=100)
    address: Optional[str] = Field(None, min_length=5)
    address_bn: Optional[str] = None
    phone: Optional[str] = Field(None, min_length=3, max_length=50)
    alternate_phone: Optional[str] = None
    latitude: Optional[float] = Field(None, ge=-90.0, le=90.0)
    longitude: Optional[float] = Field(None, ge=-180.0, le=180.0)
    source: Optional[str] = None
    source_url: Optional[str] = None
    verification_status: Optional[VerificationStatus] = None
    is_active: Optional[bool] = None


class EmergencyServiceResponse(EmergencyServiceBase):
    id: uuid.UUID
    last_verified_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class NearbyServiceResponse(BaseModel):
    id: uuid.UUID
    name: str
    name_bn: Optional[str] = None
    service_type: ServiceType
    district: str
    area: str
    address: str
    address_bn: Optional[str] = None
    phone: str
    alternate_phone: Optional[str] = None
    latitude: float
    longitude: float
    verification_status: VerificationStatus
    distance_km: float
    distance_formatted: str
    directions_url: str

    model_config = ConfigDict(from_attributes=True)


class NationalEmergencyResponse(BaseModel):
    number: str = "999"
    name: str = "National Emergency Service"
    name_bn: str = "জাতীয় জরুরি সেবা"
    description: str = "24/7 Toll-Free National Hotline for Police, Fire, and Ambulance"
    description_bn: str = "পুলিশ, ফায়ার সার্ভিস ও অ্যাম্বুলেন্সের জন্য ২৪/৭ ফ্রি জাতীয় হটলাইন"
    call_action: str = "tel:999"


class NearbyEmergencyServicesResult(BaseModel):
    national_emergency: NationalEmergencyResponse = Field(default_factory=NationalEmergencyResponse)
    nearest_police_station: Optional[NearbyServiceResponse] = None
    nearest_police_box: Optional[NearbyServiceResponse] = None
    nearby_services: List[NearbyServiceResponse] = Field(default_factory=list)
    search_location: Optional[dict] = None
    total_found: int = 0


class AreaReference(BaseModel):
    id: str
    name: str
    name_bn: str
    district: str
    district_bn: str
    latitude: float
    longitude: float


class AdminEmergencyServicePagination(BaseModel):
    items: List[EmergencyServiceResponse]
    total: int
    limit: int
    offset: int
