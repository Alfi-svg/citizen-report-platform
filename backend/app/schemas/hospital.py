import enum
import uuid
from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class BloodInventoryStatusEnum(str, enum.Enum):
    AVAILABLE = "AVAILABLE"
    LOW_STOCK = "LOW_STOCK"
    OUT_OF_STOCK = "OUT_OF_STOCK"
    UNKNOWN = "UNKNOWN"


class BloodInventoryItem(BaseModel):
    blood_group: str
    available_units: int = 0
    availability_status: str = "UNKNOWN"
    is_verified: bool = False
    is_baseline_demo: bool = True
    stock_source_label: str = "Baseline Demo Stock"
    last_updated: Optional[datetime] = None
    last_staff_update: Optional[datetime] = None
    updated_by_name: Optional[str] = None


class HospitalSummary(BaseModel):
    id: uuid.UUID
    name: str
    name_bn: Optional[str] = None
    blood_bank_name: Optional[str] = None
    district: str
    area: str
    address: str
    address_bn: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    emergency_phone: str
    alternate_phone: Optional[str] = None
    verification_status: str = "VERIFIED"
    has_blood_bank: bool = True
    distance_km: Optional[float] = None
    road_distance_km: Optional[float] = None
    estimated_travel_minutes: Optional[float] = None
    distance_type: Optional[str] = "STRAIGHT_LINE"  # "ROAD" | "STRAIGHT_LINE" | "UNAVAILABLE"
    hospital_type: Optional[str] = "General / Specialized Hospital"
    emergency_department: Optional[str] = "24/7 Emergency & Trauma"
    google_maps_url: Optional[str] = None
    matching_inventory: Optional[BloodInventoryItem] = None
    available_groups: List[str] = []
    all_inventories: List[BloodInventoryItem] = []
    last_inventory_update: Optional[datetime] = None
    verification_label: str = "Verified Hospital"
    available_actions: List[str] = [
        "Call Hospital",
        "View Location",
        "View Blood Availability",
        "Open Hospital Details",
    ]


class HospitalListResponse(BaseModel):
    items: List[HospitalSummary]
    total: int


class HospitalDetailResponse(BaseModel):
    hospital: HospitalSummary
    inventories: List[BloodInventoryItem]
    audit_history: Optional[List[Dict[str, Any]]] = None


class HospitalSearchQuery(BaseModel):
    query: Optional[str] = None
    district: Optional[str] = None
    blood_group: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    radius_km: Optional[float] = 25.0
    verified_only: bool = False
    limit: int = 20


class AdminHospitalCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    name_bn: Optional[str] = None
    blood_bank_name: Optional[str] = None
    district: str = Field(min_length=2, max_length=100)
    area: str = Field(min_length=2, max_length=100)
    address: str = Field(min_length=5)
    address_bn: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    emergency_phone: str = Field(min_length=5, max_length=50)
    alternate_phone: Optional[str] = None
    verification_status: Optional[str] = "VERIFIED"
    has_blood_bank: bool = True


class AdminHospitalUpdate(BaseModel):
    name: Optional[str] = None
    name_bn: Optional[str] = None
    blood_bank_name: Optional[str] = None
    emergency_phone: Optional[str] = None
    alternate_phone: Optional[str] = None
    address: Optional[str] = None
    address_bn: Optional[str] = None
    district: Optional[str] = None
    area: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    verification_status: Optional[str] = None
    has_blood_bank: Optional[bool] = None


class AdminInventoryUpdateRequest(BaseModel):
    blood_group: str
    available_units: int = Field(ge=0, description="Available units must be non-negative")
    availability_status: Optional[str] = None
    is_verified: bool = True
    notes: Optional[str] = None


class AdminBulkInventoryUpdateRequest(BaseModel):
    items: List[AdminInventoryUpdateRequest]
    notes: Optional[str] = None


class BloodAIChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=1000)
    conversation_id: Optional[str] = None
    user_latitude: Optional[float] = None
    user_longitude: Optional[float] = None
    user_district: Optional[str] = None
    blood_group_preference: Optional[str] = None
    lang: str = "en"


class BloodAIChatResponse(BaseModel):
    reply: str
    conversation_id: str
    intent: str
    extracted_params: Dict[str, Any]
    is_clarification_needed: bool = False
    follow_up_question: Optional[str] = None
    hospitals: List[HospitalSummary] = []
    donors: List[Dict[str, Any]] = []
    total_hospitals_found: int = 0
    tools_called: List[str] = []
    suggested_actions: List[str] = []
    disclaimer: str
