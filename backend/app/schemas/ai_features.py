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

class EmergencyType(str, enum.Enum):
    INCIDENT = "INCIDENT"
    BLOOD_REQUEST = "BLOOD_REQUEST"


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


class DraftBloodRequestPreview(BaseModel):
    blood_group: str
    units_required: int = 1
    hospital_name: str
    hospital_area: str
    district: str
    required_date: Optional[str] = None
    required_time: Optional[str] = None
    urgency: str = "URGENT"
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_method: str = "PHONE"
    additional_information: Optional[str] = None


class EmergencyAssistantResponse(BaseModel):
    reply: str
    follow_up_question: Optional[str] = None
    missing_fields: List[str] = []
    is_ready_for_review: bool = False
    emergency_type: EmergencyType = EmergencyType.INCIDENT
    extracted_fields: Dict[str, Any] = Field(default_factory=dict)
    draft_report: Optional[DraftReportPreview] = None
    draft_blood_request: Optional[DraftBloodRequestPreview] = None
    action_plan_summary: Optional[List[str]] = None
    emergency_notice: str = "If you or anyone nearby is in immediate life-threatening danger, dial 999 directly."
    conversation_id: str
    confirmation_token: Optional[str] = None


class EmergencyConfirmationRequest(BaseModel):
    conversation_id: str
    emergency_type: EmergencyType
    confirmation_token: Optional[str] = None
    draft_report: Optional[DraftReportPreview] = None
    draft_blood_request: Optional[DraftBloodRequestPreview] = None


class EmergencyConfirmationResponse(BaseModel):
    status: str = "CONFIRMED"
    emergency_type: EmergencyType
    record_id: str
    request_status: str
    redirect_url: str
    message: str


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
    approximate_latitude: Optional[float] = None
    approximate_longitude: Optional[float] = None
    match_explanation: Optional[str] = None


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


# ---------------------------------------------------------------------------
# 6. AI Donor Coordination Assistant Schemas (Phase B)
# ---------------------------------------------------------------------------

class DonorCoordinationIntent(str, enum.Enum):
    VIEW_REQUEST_STATUS = "VIEW_REQUEST_STATUS"
    FIND_MATCHING_DONORS = "FIND_MATCHING_DONORS"
    EXPLAIN_DONOR_MATCH = "EXPLAIN_DONOR_MATCH"
    VIEW_DONOR_RESPONSES = "VIEW_DONOR_RESPONSES"
    REQUEST_OUTREACH = "REQUEST_OUTREACH"
    EXPRESS_DONOR_INTEREST = "EXPRESS_DONOR_INTEREST"
    UPDATE_DONOR_RESPONSE = "UPDATE_DONOR_RESPONSE"
    CLARIFY_REQUEST = "CLARIFY_REQUEST"
    SEARCH_BLOOD_DONORS = "SEARCH_BLOOD_DONORS"


class ActionPreview(BaseModel):
    action_type: str  # "EXPRESS_INTEREST" | "TRIGGER_OUTREACH" | "UPDATE_RESPONSE"
    action_title: str
    action_description: str
    request_id: str
    details: Dict[str, Any] = Field(default_factory=dict)
    confirmation_token: str
    requires_confirmation: bool = True


class DonorMatchingExplanation(BaseModel):
    recipient_blood_group: str
    compatible_blood_groups: List[str]
    total_compatible_found: int
    district: str
    matching_criteria: List[str]
    privacy_notice: str


class DonorCoordinationRequest(BaseModel):
    message: str
    request_id: Optional[str] = None
    conversation_id: Optional[str] = None
    history: Optional[List[ChatMessage]] = None
    lang: str = "en"


class DonorCoordinationResponse(BaseModel):
    reply: str
    intent: DonorCoordinationIntent
    request_id: Optional[str] = None
    request_summary: Optional[Dict[str, Any]] = None
    matching_explanation: Optional[DonorMatchingExplanation] = None
    matched_donors: List[BloodDonorResultItem] = []
    action_preview: Optional[ActionPreview] = None
    follow_up_question: Optional[str] = None
    is_clarification_needed: bool = False
    conversation_id: str
    disclaimer: str = (
        "Medical Disclaimer: Blood compatibility and safety must always be clinically validated by attending hospital staff. Nirapotta AI provides coordination assistance only."
    )


class DonorCoordinationConfirmRequest(BaseModel):
    conversation_id: str
    confirmation_token: str
    action_type: str
    request_id: str
    message: Optional[str] = None
    contact_phone: Optional[str] = None


class DonorCoordinationConfirmResponse(BaseModel):
    status: str = "SUCCESS"
    action_type: str
    record_id: Optional[str] = None
    message: str
    details: Dict[str, Any] = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# 7. Agent Controlled Tools Schemas (Phase B Addendum)
# ---------------------------------------------------------------------------

class SearchBloodDonorsInput(BaseModel):
    blood_group: Optional[str] = None
    district: Optional[str] = None
    area: Optional[str] = None
    availability_only: bool = True
    eligible_only: bool = True
    nearby_lat: Optional[float] = None
    nearby_lng: Optional[float] = None
    radius_km: Optional[float] = 50.0
    limit: int = Field(default=10, ge=1, le=25)


class SearchBloodDonorsOutput(BaseModel):
    donors: List[BloodDonorResultItem]
    total_found: int
    criteria_applied: Dict[str, Any]


class GetBloodRequestInput(BaseModel):
    request_id: str


class GetBloodRequestOutput(BaseModel):
    request_id: str
    blood_group: str
    units_required: int
    hospital_name: str
    hospital_area: str
    district: str
    urgency: str
    status: str
    required_date: datetime
    required_time: Optional[str] = None
    additional_information: Optional[str] = None
    response_count: int
    is_own_request: bool
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None


class GetDonorMatchesInput(BaseModel):
    request_id: str
    limit: int = Field(default=10, ge=1, le=25)


class GetDonorMatchesOutput(BaseModel):
    request_id: str
    recipient_blood_group: str
    compatible_blood_groups: List[str]
    district: str
    matched_donors: List[BloodDonorResultItem]
    total_matches: int


class GetDonorResponseSummaryInput(BaseModel):
    request_id: str


class GetDonorResponseSummaryOutput(BaseModel):
    request_id: str
    is_authorized: bool
    error_message: Optional[str] = None
    total_responses: int = 0
    accepted_count: int = 0
    pending_count: int = 0
    declined_count: int = 0
    responses: List[Dict[str, Any]] = Field(default_factory=list)


class ExplainMatchingResultsInput(BaseModel):
    recipient_blood_group: str
    donor_blood_group: Optional[str] = None
    district: Optional[str] = None


class ExplainMatchingResultsOutput(BaseModel):
    recipient_blood_group: str
    compatible_donor_groups: List[str]
    is_compatible: Optional[bool] = None
    explanation: str
    safety_guidelines: List[str]


class PrepareOutreachPreviewInput(BaseModel):
    request_id: str
    max_donors: int = Field(default=20, ge=1, le=50)


class PrepareOutreachPreviewOutput(BaseModel):
    request_id: str
    is_authorized: bool
    error_message: Optional[str] = None
    eligible_donor_count: int = 0
    compatible_blood_groups: List[str] = Field(default_factory=list)
    district: str = ""
    action_preview: Optional[ActionPreview] = None


# ---------------------------------------------------------------------------
# 8. Incident Intelligence Agent Schemas (Phase C)
# ---------------------------------------------------------------------------

class IncidentIntelligenceIntent(str, enum.Enum):
    SEARCH_INCIDENTS = "SEARCH_INCIDENTS"
    GET_INCIDENT_REPORT = "GET_INCIDENT_REPORT"
    GET_INCIDENT_SUMMARY = "GET_INCIDENT_SUMMARY"
    ANALYZE_INCIDENT = "ANALYZE_INCIDENT"
    FIND_DUPLICATES = "FIND_DUPLICATES"
    PREPARE_REVIEW = "PREPARE_REVIEW"
    CLARIFY_QUERY = "CLARIFY_QUERY"


class ReportItemResult(BaseModel):
    id: str
    title: str
    category_name: str
    category_slug: str
    location_text: str
    district: Optional[str] = None
    area: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    incident_date: Optional[datetime] = None
    created_at: datetime
    status: str
    is_verified: bool
    is_anonymous: bool
    reporter_name: Optional[str] = None
    summary: str
    media_count: int = 0


class SearchIncidentReportsInput(BaseModel):
    category: Optional[str] = None
    district: Optional[str] = None
    area: Optional[str] = None
    status: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    verification_status: Optional[str] = None  # "VERIFIED" | "UNVERIFIED"
    query: Optional[str] = None
    limit: int = Field(default=10, ge=1, le=50)
    offset: int = Field(default=0, ge=0)


class SearchIncidentReportsOutput(BaseModel):
    reports: List[ReportItemResult]
    total_found: int
    criteria_applied: Dict[str, Any]


class GetIncidentReportInput(BaseModel):
    report_id: str


class GetIncidentReportOutput(BaseModel):
    report_id: str
    is_authorized: bool
    error_message: Optional[str] = None
    report: Optional[ReportItemResult] = None
    description: Optional[str] = None
    is_own_report: bool = False
    moderation_notes: Optional[str] = None  # Restricted to ADMIN / MODERATOR
    media_urls: List[str] = Field(default_factory=list)
    comments_count: int = 0
    reactions_count: int = 0


class GetIncidentSummaryInput(BaseModel):
    district: Optional[str] = None
    area: Optional[str] = None
    category: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    status: Optional[str] = None


class GetIncidentSummaryOutput(BaseModel):
    total_reports: int
    by_category: Dict[str, int]
    by_status: Dict[str, int]
    by_district: Dict[str, int]
    verified_count: int
    unverified_count: int
    date_range: Optional[str] = None
    summary_narrative: str


class AnalyzeIncidentReportInput(BaseModel):
    report_id: str


class AnalyzeIncidentReportOutput(BaseModel):
    report_id: str
    is_authorized: bool
    error_message: Optional[str] = None
    title: Optional[str] = None
    category: Optional[str] = None
    location_text: Optional[str] = None
    verified_facts: List[str] = Field(default_factory=list)
    missing_or_incomplete_info: List[str] = Field(default_factory=list)
    safety_concerns: List[str] = Field(default_factory=list)
    suggested_follow_ups: List[str] = Field(default_factory=list)
    ai_interpretation: str = ""
    confidence_score: float = 0.0
    grounding_disclaimer: str = (
        "Verified facts are extracted directly from authenticated database records. "
        "AI interpretations and suggestions are decision-support estimates."
    )


class CandidateDuplicateItem(BaseModel):
    report_id: str
    title: str
    category_name: str
    location_text: str
    incident_date: Optional[datetime] = None
    status: str
    similarity_score: float  # 0.0 to 1.0
    similarity_reasons: List[str]


class FindPossibleDuplicatesInput(BaseModel):
    report_id: Optional[str] = None
    category: Optional[str] = None
    district: Optional[str] = None
    area: Optional[str] = None
    location_text: Optional[str] = None
    query: Optional[str] = None
    time_window_hours: int = 72
    limit: int = Field(default=5, ge=1, le=10)


class FindPossibleDuplicatesOutput(BaseModel):
    target_report_id: Optional[str] = None
    candidate_duplicates: List[CandidateDuplicateItem]
    total_candidates: int
    safe_notice: str = "Candidate duplicates are advisory only. No records have been modified or merged."


class PrepareReportReviewInput(BaseModel):
    report_id: str


class PrepareReportReviewOutput(BaseModel):
    report_id: str
    is_authorized: bool
    error_message: Optional[str] = None
    current_status: Optional[str] = None
    suggested_priority: Optional[str] = None  # "LOW" | "NORMAL" | "HIGH" | "CRITICAL"
    suggested_action: Optional[str] = None    # "APPROVE" | "REQUEST_MORE_INFO" | "REJECT" | "ESCALATE"
    ai_reasoning: Optional[str] = None
    checklist: List[Dict[str, Any]] = Field(default_factory=list)
    review_preview: Dict[str, Any] = Field(default_factory=dict)
    disclaimer: str = (
        "Moderation preview is decision-support only. Final action must be executed explicitly by an authorized human moderator."
    )


class IncidentIntelligenceRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    report_id: Optional[str] = None
    history: Optional[List[ChatMessage]] = None
    lang: str = "en"


class IncidentIntelligenceResponse(BaseModel):
    reply: str
    intent: IncidentIntelligenceIntent
    report_id: Optional[str] = None
    tool_executed: Optional[str] = None
    search_results: Optional[SearchIncidentReportsOutput] = None
    report_details: Optional[GetIncidentReportOutput] = None
    summary: Optional[GetIncidentSummaryOutput] = None
    analysis: Optional[AnalyzeIncidentReportOutput] = None
    duplicate_candidates: Optional[FindPossibleDuplicatesOutput] = None
    review_preview: Optional[PrepareReportReviewOutput] = None
    follow_up_question: Optional[str] = None
    is_clarification_needed: bool = False
    conversation_id: str
    disclaimer: str = (
        "Factual incident data is retrieved directly from Nirapotta's verified database. "
        "AI analysis provides decision support and does not replace official civic or law enforcement verification."
    )


# ---------------------------------------------------------------------------
# 9. Admin & Moderator Copilot Schemas (Phase D)
# ---------------------------------------------------------------------------

class AdminCopilotIntent(str, enum.Enum):
    SEARCH_MODERATION_REPORTS = "SEARCH_MODERATION_REPORTS"
    GET_MODERATION_REPORT = "GET_MODERATION_REPORT"
    GET_MODERATION_SUMMARY = "GET_MODERATION_SUMMARY"
    SEARCH_BLOOD_REQUESTS = "SEARCH_BLOOD_REQUESTS"
    GET_PLATFORM_ACTIVITY = "GET_PLATFORM_ACTIVITY"
    GET_PENDING_SUMMARY = "GET_PENDING_SUMMARY"
    GET_RECENT_ACTIVITY = "GET_RECENT_ACTIVITY"
    IDENTIFY_ATTENTION_ITEMS = "IDENTIFY_ATTENTION_ITEMS"
    PREPARE_MODERATION_REVIEW = "PREPARE_MODERATION_REVIEW"
    PREPARE_MODERATION_ACTION = "PREPARE_MODERATION_ACTION"
    CLARIFY_QUERY = "CLARIFY_QUERY"


class SearchModerationReportsInput(BaseModel):
    category: Optional[str] = None
    district: Optional[str] = None
    area: Optional[str] = None
    status: Optional[str] = None
    verification_status: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    query: Optional[str] = None
    priority: Optional[str] = None
    limit: int = Field(default=10, ge=1, le=50)
    offset: int = Field(default=0, ge=0)


class SearchModerationReportsOutput(BaseModel):
    reports: List[ReportItemResult]
    total_found: int
    criteria_applied: Dict[str, Any]


class GetModerationReportInput(BaseModel):
    report_id: str


class GetModerationReportOutput(BaseModel):
    report_id: str
    title: str
    description: str
    category_name: str
    category_slug: str
    location_text: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    status: str
    is_anonymous: bool
    reporter_username: Optional[str] = None
    reporter_email: Optional[str] = None
    incident_date: Optional[datetime] = None
    created_at: datetime
    moderation_history: List[Dict[str, Any]] = Field(default_factory=list)
    media_urls: List[str] = Field(default_factory=list)
    flags_count: int = 0


class GetModerationSummaryInput(BaseModel):
    district: Optional[str] = None
    category: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class GetModerationSummaryOutput(BaseModel):
    total_reports: int
    pending_review_count: int
    approved_count: int
    rejected_count: int
    needs_info_count: int
    by_category: Dict[str, int]
    by_district: Dict[str, int]
    summary_narrative: str


class SearchBloodRequestsAdminInput(BaseModel):
    status: Optional[str] = None
    district: Optional[str] = None
    blood_group: Optional[str] = None
    urgency: Optional[str] = None
    limit: int = Field(default=10, ge=1, le=50)


class AdminBloodRequestItem(BaseModel):
    id: str
    patient_name: Optional[str] = None
    blood_group: str
    units_required: int
    hospital_name: str
    district: str
    status: str
    urgency: str
    response_count: int = 0
    created_at: datetime


class SearchBloodRequestsAdminOutput(BaseModel):
    requests: List[AdminBloodRequestItem]
    total_found: int


class PlatformActivitySummaryOutput(BaseModel):
    total_reports: int
    pending_reports: int
    approved_reports: int
    total_blood_requests: int
    active_blood_requests: int
    total_donors_registered: int
    total_safety_flags: int
    active_missing_persons: int
    summary_narrative: str


class RecentModerationActivityOutput(BaseModel):
    recent_records: List[Dict[str, Any]]
    total_records: int


class OperationalAttentionItem(BaseModel):
    item_type: str
    record_id: str
    title: str
    severity: str
    reason: str
    recommended_action: str
    created_at: datetime


class OperationalAttentionOutput(BaseModel):
    items: List[OperationalAttentionItem]
    total_items: int
    summary: str


class ModerationActionPreview(BaseModel):
    action_type: str
    target_record_id: str
    target_title: str
    current_status: str
    proposed_status: str
    reason: str
    details: Dict[str, Any] = Field(default_factory=dict)
    confirmation_token: str
    requires_confirmation: bool = True
    expires_at: datetime


class AdminCopilotRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    report_id: Optional[str] = None
    history: Optional[List[ChatMessage]] = None
    lang: str = "en"


class AdminCopilotResponse(BaseModel):
    reply: str
    intent: AdminCopilotIntent
    tool_executed: Optional[str] = None
    reports_result: Optional[SearchModerationReportsOutput] = None
    report_details: Optional[GetModerationReportOutput] = None
    moderation_summary: Optional[GetModerationSummaryOutput] = None
    blood_requests_result: Optional[SearchBloodRequestsAdminOutput] = None
    platform_activity: Optional[PlatformActivitySummaryOutput] = None
    recent_activity: Optional[RecentModerationActivityOutput] = None
    attention_items: Optional[OperationalAttentionOutput] = None
    review_preview: Optional[PrepareReportReviewOutput] = None
    action_preview: Optional[ModerationActionPreview] = None
    follow_up_question: Optional[str] = None
    is_clarification_needed: bool = False
    conversation_id: str
    disclaimer: str = (
        "Admin Copilot provides operational intelligence and decision-support based on authenticated database records. "
        "State-changing actions require explicit human confirmation."
    )


class AdminCopilotConfirmRequest(BaseModel):
    conversation_id: str
    confirmation_token: str
    action_type: str
    target_record_id: str
    user_message: Optional[str] = None
    internal_notes: Optional[str] = None


class AdminCopilotConfirmResponse(BaseModel):
    status: str = "SUCCESS"
    action_type: str
    record_id: str
    previous_status: str
    new_status: str
    message: str
    details: Dict[str, Any] = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# Phase E: Voice & Audio Emergency Intake Schemas
# ---------------------------------------------------------------------------

class VoiceEmergencyIntakeRequest(BaseModel):
    transcript: str = Field(
        ...,
        min_length=1,
        max_length=4000,
        description="Recognized speech transcript reviewed and submitted by the citizen",
    )
    raw_transcript: Optional[str] = Field(
        None,
        max_length=4000,
        description="Initial automated transcript before citizen edits",
    )
    audio_duration_seconds: Optional[float] = Field(
        None,
        ge=0.0,
        le=600.0,
        description="Duration of the transient voice recording in seconds",
    )
    conversation_id: Optional[str] = None
    current_latitude: Optional[float] = None
    current_longitude: Optional[float] = None
    current_location_text: Optional[str] = None
    lang: str = "en"
    history: Optional[List[ChatMessage]] = None


class VoiceEmergencyIntakeResponse(BaseModel):
    reply: str
    follow_up_question: Optional[str] = None
    missing_fields: List[str] = Field(default_factory=list)
    is_ready_for_review: bool = False
    emergency_type: EmergencyType = EmergencyType.INCIDENT
    extracted_fields: Dict[str, Any] = Field(default_factory=dict)
    draft_report: Optional[DraftReportPreview] = None
    draft_blood_request: Optional[DraftBloodRequestPreview] = None
    action_plan_summary: Optional[List[str]] = None
    emergency_notice: str = "If you or anyone nearby is in immediate life-threatening danger, dial 999 directly."
    conversation_id: str
    confirmation_token: Optional[str] = None
    # Voice-specific metadata
    input_mode: str = "voice"
    transcript: str
    raw_transcript: Optional[str] = None
    audio_duration_seconds: Optional[float] = None
    was_edited: bool = False
    audio_retention_policy: str = "TRANSIENT_PROCESSED_NOT_STORED"
    speech_synthesis_hint: Optional[str] = None
    disclaimer: str = (
        "Nirapotta AI is an assistive civic reporting tool, not an emergency dispatcher. "
        "Audio is processed transiently and raw recordings are never retained on disk. "
        "In life-threatening situations, call National Emergency 999 directly."
    )


# ---------------------------------------------------------------------------
# Phase F: Safe Route & Interactive Safety Map Schemas
# ---------------------------------------------------------------------------

class EmergencyServiceAlongRoute(BaseModel):
    id: str
    name: str
    service_type: str  # "POLICE", "HOSPITAL", "FIRE_SERVICE"
    phone_number: Optional[str] = None
    latitude: float
    longitude: float
    distance_meters: int
    distance_text: str


class AccidentZoneItem(BaseModel):
    id: str
    zone_name: str
    zone_name_bn: Optional[str] = None
    road_name: str
    district: str
    division: str
    latitude: float
    longitude: float
    radius_meters: int
    accident_count: Optional[int] = None
    observation_period: Optional[str] = None
    data_source: str
    source_url: Optional[str] = None
    verification_status: str
    risk_level: str
    description: Optional[str] = None
    distance_meters: Optional[int] = None
    data_type: str = "ESTIMATED_HAZARD_DATA"
    is_estimated: bool = True
    hazard_density_label: str = "Estimated Hazard Index"
    data_limitation_notice: str = "Estimated corridor density based on historical road safety models. Not live telematics or certified casualty statistics."


class RouteAlternativeComparison(BaseModel):
    route_id: str  # "route_0", "route_1", etc.
    label: str  # "Shortest Route", "Safest Available Route"
    distance_km: float
    duration_minutes: float
    risk_level: RoadSafetyRiskLevel
    risk_score: float
    accident_zones_count: int
    hazards_count: int
    is_safest: bool
    is_shortest: bool
    recommendation_summary: str


class AgenticRouteCandidate(BaseModel):
    route_id: str  # "route_0", "route_1", etc.
    label: str  # "AI Recommended Route", "Fastest Route", "Safest Route"
    distance_km: float
    duration_minutes: float
    risk_level: RoadSafetyRiskLevel
    risk_score: float  # 0 to 100
    risk_confidence: str = "HIGH"  # "HIGH", "MODERATE", "LOW", "UNKNOWN"
    accident_zones_count: int
    hazards_count: int
    is_recommended: bool = False
    is_fastest: bool = False
    is_safest: bool = False
    tradeoff_rationale: str
    tradeoff_score: float = 0.0
    waypoints: List[List[float]] = Field(default_factory=list)
    summary_road_names: Optional[str] = None


class AgenticRouteRecommendation(BaseModel):
    recommended_route_id: str
    primary_reason: str
    time_vs_safety_tradeoff: str
    fastest_route_id: str
    safest_route_id: str
    candidates: List[AgenticRouteCandidate] = Field(default_factory=list)
    confidence_assessment: str = "High confidence grounded in official ARI BUET and verified community reports"
    data_freshness_label: str = "Real-time & Verified Records"


class SafeRouteAnalysisRequest(BaseModel):
    origin_latitude: float = Field(..., ge=-90.0, le=90.0, description="Origin latitude")
    origin_longitude: float = Field(..., ge=-180.0, le=180.0, description="Origin longitude")
    destination_latitude: float = Field(..., ge=-90.0, le=90.0, description="Destination latitude")
    destination_longitude: float = Field(..., ge=-180.0, le=180.0, description="Destination longitude")
    origin_name: Optional[str] = None
    destination_name: Optional[str] = None
    waypoints: Optional[List[List[float]]] = Field(
        None,
        description="List of [latitude, longitude] pairs representing route geometry from routing engine",
    )
    route_distance_km: Optional[float] = Field(None, ge=0.0, le=2000.0)
    route_duration_minutes: Optional[float] = Field(None, ge=0.0, le=10000.0)
    vehicle_type: Optional[str] = Field("MOTORCYCLE", description="MOTORCYCLE or CAR")
    safety_confirmed: Optional[bool] = Field(False, description="Helmet or seatbelt safety confirmation")
    preference: Optional[str] = Field("RECOMMENDED", description="RECOMMENDED, FASTEST, or SAFEST")
    alternative_geometries: Optional[List[Dict[str, Any]]] = Field(
        None,
        description="List of alternative routes geometry and metrics from OSRM",
    )
    lang: str = "en"


class SafeRouteAnalysisResponse(BaseModel):
    origin_name: str
    destination_name: str
    route_distance_km: Optional[float] = None
    route_duration_minutes: Optional[float] = None
    routing_mode: str = "ROAD_NETWORK"  # "ROAD_NETWORK" or "DIRECT_CORRIDOR_FALLBACK"
    is_fallback: bool = False
    fallback_notice: Optional[str] = None
    route_risk_level: RoadSafetyRiskLevel
    route_risk_score: float  # 0 to 100
    total_hazards_count: int
    hazards_by_category: Dict[str, int] = Field(default_factory=dict)
    hazards_along_route: List[NearbySafetyAlert] = Field(default_factory=list)
    emergency_services_along_route: List[EmergencyServiceAlongRoute] = Field(default_factory=list)
    high_risk_corridors_crossed: List[RoadSafetyHotspotItem] = Field(default_factory=list)
    accident_zones_along_route: List[AccidentZoneItem] = Field(default_factory=list)
    route_alternatives: List[RouteAlternativeComparison] = Field(default_factory=list)
    agentic_recommendation: Optional[AgenticRouteRecommendation] = None
    vehicle_type: Optional[str] = None
    safety_verification_status: Optional[str] = None  # "VERIFIED" | "PENDING" | "WARNING"
    road_ai_guidance: Optional[str] = None
    safety_advisory: str
    ai_interpretation: str
    data_limitations: str
    emergency_notice: str = "In life-threatening emergencies, dial National Emergency 999 directly."
    disclaimer: str = (
        "Safe Route recommendations are informational advisories calculated from verified database incidents and documented accident-prone zones. "
        "Road conditions change dynamically; routes cannot be guaranteed 100% safe."
    )




