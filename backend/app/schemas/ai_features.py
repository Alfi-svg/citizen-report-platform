import enum
import uuid
from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# 1. Road Safety Intelligence Schemas
# ---------------------------------------------------------------------------

class RoadSafetyRiskLevel(str, enum.Enum):
    LOW = "Low"
    MODERATE = "Moderate"
    HIGH = "High"
    CRITICAL = "Critical"


class AccidentHistoryItem(BaseModel):
    report_id: uuid.UUID
    title: str
    location_text: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    distance_km: Optional[float] = None
    incident_date: Optional[datetime] = None
    created_at: datetime
    is_verified: bool
    severity: str = "Standard"


class NearbySafetyAlert(BaseModel):
    id: str
    report_id: uuid.UUID
    title: str
    location_text: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    distance_meters: int
    distance_text: str
    incident_date_text: str
    alert_reason: str
    report_url: str


class RoadSafetyExplanation(BaseModel):
    summary: str
    contributing_factors: List[str]
    precautions: List[str]
    data_source: str


class RoadSafetyMetrics(BaseModel):
    total_accidents: int
    verified_accidents: int
    recent_accidents_7d: int
    recent_accidents_30d: int
    accident_density_per_sq_km: float
    repeated_hotspots_count: int
    data_confidence: str  # "High", "Moderate", "Low - Limited Data"


class RoadSafetyHotspotItem(BaseModel):
    area_name: str
    latitude: float
    longitude: float
    accident_count: int
    risk_level: RoadSafetyRiskLevel
    recent_count_30d: int


class RoadSafetyIntelligenceResponse(BaseModel):
    center_latitude: float
    center_longitude: float
    radius_km: float
    area_name: Optional[str] = None
    risk_score: float  # 0 to 100
    risk_level: RoadSafetyRiskLevel
    metrics: RoadSafetyMetrics
    history: List[AccidentHistoryItem]
    nearby_alerts: List[NearbySafetyAlert]
    explanation: RoadSafetyExplanation
    hotspots: List[RoadSafetyHotspotItem]


class RouteRiskEvaluationRequest(BaseModel):
    waypoints: List[List[float]] = Field(..., description="List of [latitude, longitude] pairs along route")
    lang: str = "en"


class RouteRiskEvaluationResponse(BaseModel):
    route_risk_level: RoadSafetyRiskLevel
    route_risk_score: float
    total_hazards_count: int
    hazards_along_route: List[NearbySafetyAlert]
    high_risk_corridors_crossed: List[RoadSafetyHotspotItem]
    safety_advisory: str


# ---------------------------------------------------------------------------
# 2. AI Emergency Assistant Schemas
# ---------------------------------------------------------------------------

class ChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class EmergencyAssistantRequest(BaseModel):
    message: str
    history: Optional[List[ChatMessage]] = None
    conversation_id: Optional[str] = None
    current_latitude: Optional[float] = None
    current_longitude: Optional[float] = None
    current_location_text: Optional[str] = None
    lang: str = "en"


class DraftReportPreview(BaseModel):
    title: str
    category_id: Optional[str] = None
    category_name: Optional[str] = None
    category_slug: Optional[str] = None
    description: str
    location_text: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    incident_date: Optional[str] = None
    injuries_reported: Optional[str] = None
    severity: Optional[str] = None
    is_anonymous: bool = False


class EmergencyAssistantResponse(BaseModel):
    reply: str
    follow_up_question: Optional[str] = None
    missing_fields: List[str] = []
    is_ready_for_review: bool = False
    draft_report: Optional[DraftReportPreview] = None
    action_plan_summary: Optional[List[str]] = None
    emergency_notice: str = "If you or anyone nearby is in immediate life-threatening danger, dial 999 directly."
    conversation_id: str


# ---------------------------------------------------------------------------
# 3. AI Emergency Action Planner Schemas
# ---------------------------------------------------------------------------

class ActionPlannerRequest(BaseModel):
    emergency_type: str
    details: Optional[str] = None
    lang: str = "en"


class EmergencyActionPlanResponse(BaseModel):
    emergency_type: str
    title: str
    emergency_hotline: str = "999"
    immediate_steps: List[str]
    precautions_to_avoid: List[str]
    follow_up_steps: List[str]
    relevant_features: List[str]
    disclaimer: str


# ---------------------------------------------------------------------------
# 4. Duplicate Incident Detection Schemas
# ---------------------------------------------------------------------------

class DuplicateCheckRequest(BaseModel):
    report_id: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    category_id: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_text: Optional[str] = None


class DuplicateCandidateItem(BaseModel):
    report_id: str
    title: str
    category_name: str
    location_text: str
    incident_date: Optional[datetime] = None
    created_at: datetime
    distance_km: Optional[float] = None
    similarity_score: float
    match_reasons: List[str]
    is_confirmed_duplicate: bool = False


class DuplicateDetectionResponse(BaseModel):
    is_potential_duplicate: bool
    primary_report_id: Optional[str] = None
    suggested_action: str  # "NONE", "FLAG_DUPLICATE", "CONFIRM_PRIMARY"
    candidates: List[DuplicateCandidateItem]
    analysis_summary: str


class ModeratorDuplicateActionRequest(BaseModel):
    primary_report_id: uuid.UUID
    duplicate_report_id: uuid.UUID
    action: str = Field(..., pattern="^(confirm|reject)$")
    notes: Optional[str] = None


# ---------------------------------------------------------------------------
# 5. AI Blood Donation Assistant Schemas
# ---------------------------------------------------------------------------

class BloodAssistantQueryRequest(BaseModel):
    query: str
    district: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    lang: str = "en"


class BloodDonorResultItem(BaseModel):
    donor_id: str
    display_name: str
    blood_group: str
    district: str
    area: str
    availability_status: str
    last_donation_date: Optional[datetime] = None
    eligible_to_donate: bool
    contact_phone: Optional[str] = None
    preferred_contact_method: str
    distance_km: Optional[float] = None


class BloodAssistantResponse(BaseModel):
    parsed_blood_group: Optional[str] = None
    parsed_district: Optional[str] = None
    parsed_area: Optional[str] = None
    parsed_urgency: Optional[str] = None
    is_clarification_needed: bool
    clarification_question: Optional[str] = None
    donors: List[BloodDonorResultItem]
    total_donors_found: int
    explanation: str
    disclaimer: str
    create_request_url: str = "/blood-help/request"
