import re
import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field, field_validator
from app.models.emergency_service import ServiceType, VerificationStatus, SourceCategory

# Bangladesh phone number validation regex:
# Accepts:
# - Standard 3 to 5 digit official hotlines (999, 109, 333, 106, 16163)
# - Mobile numbers (+8801XXXXXXXXX or 01XXXXXXXXX)
# - Landline numbers (+8802XXXXXXX or 02-XXXXXXX / 031XXXXXXX etc.)
BD_PHONE_REGEX = re.compile(
    r"^(?:\+?880|0)?(?:1[3-9]\d{8}|[2-9]\d{6,9}|999|109|333|106|16163)$"
)


def validate_bangladesh_phone(phone_str: str) -> str:
    cleaned = re.sub(r"[\s\-\(\)]", "", phone_str.strip())
    if not BD_PHONE_REGEX.match(cleaned):
        raise ValueError(
            f"Invalid Bangladesh phone or hotline number '{phone_str}'. "
            "Must be an official emergency short code (e.g. 999), 11-digit mobile, or valid landline."
        )
    return phone_str.strip()


def validate_bangladesh_coordinates(
    lat: Optional[float], lng: Optional[float]
) -> None:
    if lat is not None:
        if not (20.0 <= lat <= 27.0):
            raise ValueError(f"Latitude {lat} is outside Bangladesh geographic bounds (20.0 to 27.0).")
    if lng is not None:
        if not (88.0 <= lng <= 93.0):
            raise ValueError(f"Longitude {lng} is outside Bangladesh geographic bounds (88.0 to 93.0).")


class EmergencyServiceBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=255, description="Official English name")
    name_bn: Optional[str] = Field(None, max_length=255, description="Official Bangla name")
    service_type: ServiceType
    division: Optional[str] = Field(None, max_length=100, description="Division / Bibhag")
    district: str = Field(..., min_length=2, max_length=100, description="District / Zila")
    area: str = Field(..., min_length=2, max_length=100, description="Thana / Area")
    address: str = Field(..., min_length=5, description="Physical address in English")
    address_bn: Optional[str] = Field(None, description="Physical address in Bangla")
    phone: str = Field(..., min_length=3, max_length=50, description="Primary official hotline / phone")
    alternate_phone: Optional[str] = Field(None, max_length=100, description="Alternate phone number")
    latitude: Optional[float] = Field(None, description="WGS84 latitude")
    longitude: Optional[float] = Field(None, description="WGS84 longitude")
    source: str = Field(default="Official Bangladesh Police Directory", max_length=255)
    source_url: Optional[str] = Field(None, max_length=500)
    verification_status: VerificationStatus = Field(default=VerificationStatus.UNVERIFIED)
    is_active: bool = Field(default=True)

    @field_validator("name", "district", "area", "address", "phone")
    @classmethod
    def strip_and_validate(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("Field cannot be empty or whitespace.")
        return trimmed

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        return validate_bangladesh_phone(v)

    @field_validator("latitude")
    @classmethod
    def validate_lat(cls, v: Optional[float]) -> Optional[float]:
        if v is not None:
            validate_bangladesh_coordinates(v, None)
        return v

    @field_validator("longitude")
    @classmethod
    def validate_lng(cls, v: Optional[float]) -> Optional[float]:
        if v is not None:
            validate_bangladesh_coordinates(None, v)
        return v


class EmergencyServiceCreate(EmergencyServiceBase):
    pass


class EmergencyServiceUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    name_bn: Optional[str] = Field(None, max_length=255)
    service_type: Optional[ServiceType] = None
    division: Optional[str] = Field(None, max_length=100)
    district: Optional[str] = Field(None, min_length=2, max_length=100)
    area: Optional[str] = Field(None, min_length=2, max_length=100)
    address: Optional[str] = Field(None, min_length=5)
    address_bn: Optional[str] = None
    phone: Optional[str] = Field(None, min_length=3, max_length=50)
    alternate_phone: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    source: Optional[str] = None
    source_url: Optional[str] = None
    verification_status: Optional[VerificationStatus] = None
    verification_notes_internal: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator("phone")
    @classmethod
    def validate_phone_update(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            return validate_bangladesh_phone(v)
        return v


class EmergencyServiceResponse(EmergencyServiceBase):
    id: uuid.UUID
    verified_by_admin_id: Optional[uuid.UUID] = None
    verification_notes_internal: Optional[str] = None
    last_verified_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class PublicEmergencyServiceResponse(BaseModel):
    id: uuid.UUID
    name: str
    name_bn: Optional[str] = None
    service_type: ServiceType
    division: Optional[str] = None
    district: str
    area: str
    address: str
    address_bn: Optional[str] = None
    phone: str
    alternate_phone: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    source: str
    source_url: Optional[str] = None
    verification_status: VerificationStatus
    last_verified_at: Optional[datetime] = None
    is_fresh: bool = True

    model_config = ConfigDict(from_attributes=True)


class NearbyServiceResponse(BaseModel):
    id: uuid.UUID
    name: str
    name_bn: Optional[str] = None
    service_type: ServiceType
    division: Optional[str] = None
    district: str
    area: str
    address: str
    address_bn: Optional[str] = None
    phone: str
    alternate_phone: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    source: str
    source_url: Optional[str] = None
    verification_status: VerificationStatus
    last_verified_at: Optional[datetime] = None
    is_fresh: bool = True
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
    warning_message: Optional[str] = None


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


class SafetyServiceVerificationAuditResponse(BaseModel):
    id: uuid.UUID
    service_id: uuid.UUID
    admin_id: Optional[uuid.UUID] = None
    previous_status: VerificationStatus
    new_status: VerificationStatus
    changed_fields: Optional[str] = None
    verification_notes: Optional[str] = None
    source: Optional[str] = None
    source_url: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SafetyServiceVerifyRequest(BaseModel):
    source: str = Field(..., min_length=2, max_length=255, description="Confirmed official source name")
    source_url: Optional[str] = Field(None, max_length=500, description="Official portal/directory URL")
    verification_notes: Optional[str] = Field(None, description="Admin verification rationale and details")


class SafetyServiceReviewRequest(BaseModel):
    verification_notes: str = Field(..., min_length=3, description="Reason this service needs review")


class SafetyDirectoryMetricsResponse(BaseModel):
    total_services: int
    verified_count: int
    unverified_count: int
    needs_review_count: int
    outdated_count: int
    inactive_count: int
    recently_verified_count: int


class SafetyDirectoryBulkActionRequest(BaseModel):
    service_ids: List[uuid.UUID] = Field(..., min_length=1, max_length=100)
    action: str = Field(..., description="'NEEDS_REVIEW' or 'DEACTIVATE'")
    admin_notes: Optional[str] = None

    @field_validator("action")
    @classmethod
    def validate_action(cls, v: str) -> str:
        allowed = {"NEEDS_REVIEW", "DEACTIVATE"}
        val = v.upper().strip()
        if val not in allowed:
            raise ValueError(
                f"Invalid bulk action '{v}'. Bulk action only supports {allowed}. "
                "Bulk 'VERIFIED' is strictly prohibited to ensure each record is verified with an explicit source."
            )
        return val


class SafetyServiceImportRow(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    name_bn: Optional[str] = None
    service_type: ServiceType
    division: Optional[str] = None
    district: str = Field(..., min_length=2, max_length=100)
    area: str = Field(..., min_length=2, max_length=100)
    address: str = Field(..., min_length=5)
    address_bn: Optional[str] = None
    phone: str = Field(..., min_length=3, max_length=50)
    alternate_phone: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    source: str = Field(default="Official Import Dataset", max_length=255)
    source_url: Optional[str] = None

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        return validate_bangladesh_phone(v)


class SafetyServiceImportRequest(BaseModel):
    rows: List[SafetyServiceImportRow] = Field(..., min_length=1, max_length=200)


class SafetyServiceImportResponse(BaseModel):
    total_rows: int
    imported_count: int
    duplicate_count: int
    error_count: int
    errors: List[str]


class SafetyServiceDuplicateCandidate(BaseModel):
    service_id: uuid.UUID
    service_name: str
    district: str
    phone: str
    duplicate_with_id: uuid.UUID
    duplicate_with_name: str
    duplicate_with_phone: str
    reason: str
