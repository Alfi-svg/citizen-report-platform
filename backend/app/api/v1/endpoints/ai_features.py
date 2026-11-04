import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.api.deps import (
    get_current_user,
    get_optional_current_user,
    get_current_active_admin,
    get_current_moderator_or_admin,
)
from app.models.user import User
from app.models.category import Category
from app.models.report import Report, ReportStatus
from app.models.blood import BloodGroup, BloodUrgency
from app.schemas.blood import BloodRequestCreate
from app.schemas.ai_features import (
    RoadSafetyIntelligenceResponse,
    RouteRiskEvaluationRequest,
    RouteRiskEvaluationResponse,
    EmergencyAssistantRequest,
    EmergencyAssistantResponse,
    EmergencyConfirmationRequest,
    EmergencyConfirmationResponse,
    EmergencyType,
    ActionPlannerRequest,
    EmergencyActionPlanResponse,
    DuplicateCheckRequest,
    DuplicateDetectionResponse,
    ModeratorDuplicateActionRequest,
    BloodAssistantQueryRequest,
    BloodAssistantResponse,
    DonorCoordinationRequest,
    DonorCoordinationResponse,
    DonorCoordinationConfirmRequest,
    DonorCoordinationConfirmResponse,
    IncidentIntelligenceRequest,
    IncidentIntelligenceResponse,
    AdminCopilotRequest,
    AdminCopilotResponse,
    AdminCopilotConfirmRequest,
    AdminCopilotConfirmResponse,
    VoiceEmergencyIntakeRequest,
    VoiceEmergencyIntakeResponse,
)
from app.services import (
    road_safety as road_safety_service,
    emergency_assistant as emergency_assistant_service,
    action_planner as action_planner_service,
    duplicate_detection as duplicate_detection_service,
    blood_ai_assistant as blood_ai_service,
    blood as blood_service,
    donor_coordination as donor_coordination_service,
    incident_intelligence as incident_intelligence_service,
    admin_copilot as admin_copilot_service,
    voice_emergency_intake as voice_emergency_service,
)

router = APIRouter()

# In-memory duplicate protection store for confirmed emergency assistant drafts:
# Maps token or (user_id, conversation_id) -> record metadata
_CONFIRMED_DRAFTS: Dict[str, Dict[str, Any]] = {}


def _prune_confirmed_drafts() -> None:
    """Removes entries older than 24 hours and bounds memory store to 5,000 items."""
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=24)
    expired = [
        k for k, v in _CONFIRMED_DRAFTS.items()
        if v.get("created_at") and v["created_at"] < cutoff
    ]
    for k in expired:
        _CONFIRMED_DRAFTS.pop(k, None)
    if len(_CONFIRMED_DRAFTS) > 5000:
        sorted_keys = sorted(
            _CONFIRMED_DRAFTS.keys(),
            key=lambda k: _CONFIRMED_DRAFTS[k].get("created_at", now),
        )
        for k in sorted_keys[: len(_CONFIRMED_DRAFTS) - 5000]:
            _CONFIRMED_DRAFTS.pop(k, None)


# ---------------------------------------------------------------------------
# 1. Road Safety Intelligence Endpoints (Core Feature)
# ---------------------------------------------------------------------------

@router.get(
    "/safety/road-intelligence",
    response_model=RoadSafetyIntelligenceResponse,
    summary="Get AI-powered Road Safety Intelligence for a geographic coordinate",
)
async def get_road_safety_intelligence(
    latitude: float = Query(..., description="Latitude coordinate"),
    longitude: float = Query(..., description="Longitude coordinate"),
    radius_km: float = Query(3.0, ge=0.5, le=15.0, description="Analysis radius in km"),
    area_name: Optional[str] = Query(None, description="Optional neighborhood or road name"),
    lang: str = Query("en", pattern="^(en|bn)$", description="Response language"),
    db: AsyncSession = Depends(get_db),
):
    """
    Evaluates real historical accident reports in the database around the given coordinates,
    computes deterministic risk scores, extracts nearby alerts, and generates AI explanations.
    """
    return await road_safety_service.analyze_road_safety(
        db=db,
        latitude=latitude,
        longitude=longitude,
        radius_km=radius_km,
        area_name=area_name,
        lang=lang,
    )


@router.post(
    "/safety/road-intelligence/route-risk",
    response_model=RouteRiskEvaluationResponse,
    summary="Evaluate road safety hazards and accident risks along a planned driving route",
)
async def evaluate_driving_route_risk(
    request: RouteRiskEvaluationRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Evaluates real database road incident hazards along the provided route waypoints,
    detects intersection with known regional corridors, and calculates a deterministic route safety score.
    """
    return await road_safety_service.evaluate_route_safety(
        db=db,
        waypoints=request.waypoints,
        lang=request.lang,
    )


# ---------------------------------------------------------------------------
# 2. AI Emergency Assistant Endpoint
# ---------------------------------------------------------------------------

@router.post(
    "/reports/ai-assistant/chat",
    response_model=EmergencyAssistantResponse,
    summary="Natural-language conversational assistant for structured emergency incident reporting",
)
async def chat_emergency_assistant(
    request: EmergencyAssistantRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Extracts structured emergency incident report fields from conversational Bangla or English,
    asks follow-up questions for missing required details, and provides a draft for user confirmation.
    """
    return await emergency_assistant_service.process_emergency_assistant_chat(
        db=db,
        request=request,
    )


@router.post(
    "/reports/ai-assistant/voice-intake",
    response_model=VoiceEmergencyIntakeResponse,
    summary="Process speech-to-text transcript into structured emergency draft with confirmation token",
)
@router.post(
    "/emergency/ai-assistant/voice-intake",
    response_model=VoiceEmergencyIntakeResponse,
    include_in_schema=False,
)
async def process_voice_emergency_intake(
    request: VoiceEmergencyIntakeRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Phase E: AI Voice & Audio Emergency Intake.
    Validates citizen-reviewed voice transcript, performs transient processing with zero audio retention,
    and returns a structured incident or blood request draft ready for explicit human confirmation.
    """
    return await voice_emergency_service.process_voice_emergency_intake(
        db=db,
        request=request,
    )


@router.post(
    "/reports/ai-assistant/confirm",
    response_model=EmergencyConfirmationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Explicit citizen confirmation to create an emergency request or incident report from AI draft",
)
async def confirm_emergency_draft(
    request: EmergencyConfirmationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Explicit confirmation endpoint:
    - Never triggers automatically without user submission.
    - Requires authenticated citizen session.
    - Protects against duplicate submissions.
    - Validates strictly against backend domain models.
    - Persists actual DB record in an atomic transaction.
    """
    # 1. Duplicate submission check
    _prune_confirmed_drafts()
    dedup_key = request.confirmation_token or f"{current_user.id}:{request.conversation_id}"
    if dedup_key in _CONFIRMED_DRAFTS:
        cached = _CONFIRMED_DRAFTS[dedup_key]
        return EmergencyConfirmationResponse(
            status="CONFIRMED",
            emergency_type=cached["emergency_type"],
            record_id=cached["record_id"],
            request_status=cached["request_status"],
            redirect_url=cached["redirect_url"],
            message="This emergency request has already been confirmed and created.",
        )

    # 2. Branch: Citizen Incident Report
    if request.emergency_type == EmergencyType.INCIDENT:
        draft = request.draft_report
        if not draft:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Draft report data is required for incident confirmation.",
            )

        if not draft.title or not draft.description or not draft.location_text:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Missing required incident report fields (title, description, or location_text).",
            )

        # Resolve category
        category = None
        if draft.category_id:
            try:
                cat_uuid = uuid.UUID(draft.category_id)
                cat_stmt = select(Category).where(Category.id == cat_uuid, Category.is_active == True)
                cat_res = await db.execute(cat_stmt)
                category = cat_res.scalar_one_or_none()
            except Exception:
                pass

        if not category and draft.category_slug:
            cat_stmt = select(Category).where(Category.slug == draft.category_slug, Category.is_active == True)
            cat_res = await db.execute(cat_stmt)
            category = cat_res.scalar_one_or_none()

        if not category:
            cat_stmt = select(Category).where(Category.is_active == True)
            cat_res = await db.execute(cat_stmt)
            category = cat_res.scalars().first()

        if not category:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No active incident category available in the database.",
            )

        lat = draft.latitude
        lng = draft.longitude
        if (lat is None or lng is None) and draft.location_text:
            from app.api.v1.endpoints.missing_person import resolve_bd_coordinates
            lat, lng = resolve_bd_coordinates(draft.location_text)

        report = Report(
            user_id=current_user.id,
            category_id=category.id,
            title=draft.title.strip(),
            description=draft.description.strip(),
            location_text=draft.location_text.strip(),
            latitude=lat,
            longitude=lng,
            incident_date=datetime.now(timezone.utc),
            status=ReportStatus.SUBMITTED,
            submitted_at=datetime.now(timezone.utc),
            is_anonymous=draft.is_anonymous,
        )
        db.add(report)
        await db.commit()
        await db.refresh(report)

        resp = EmergencyConfirmationResponse(
            status="CONFIRMED",
            emergency_type=EmergencyType.INCIDENT,
            record_id=str(report.id),
            request_status="SUBMITTED",
            redirect_url=f"/reports/{report.id}",
            message="Your incident report has been confirmed and submitted successfully.",
        )

        _CONFIRMED_DRAFTS[dedup_key] = {
            "emergency_type": EmergencyType.INCIDENT,
            "record_id": str(report.id),
            "request_status": "SUBMITTED",
            "redirect_url": f"/reports/{report.id}",
            "created_at": datetime.now(timezone.utc),
        }
        return resp

    # 3. Branch: Emergency Blood Request
    elif request.emergency_type == EmergencyType.BLOOD_REQUEST:
        draft_b = request.draft_blood_request
        if not draft_b:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Draft blood request data is required for confirmation.",
            )

        try:
            norm_bg = draft_b.blood_group.replace(" ", "+").strip()
            bg_enum = BloodGroup(norm_bg)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid blood group '{draft_b.blood_group}'. Must be one of {[bg.value for bg in BloodGroup]}.",
            )

        units = max(1, min(20, draft_b.units_required))
        hosp_name = draft_b.hospital_name.strip()
        hosp_area = (draft_b.hospital_area or draft_b.district or "Dhaka").strip()
        district = (draft_b.district or "Dhaka").strip()

        if len(hosp_name) < 2:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Hospital name must be at least 2 characters.",
            )

        urgency_val = BloodUrgency.URGENT
        if draft_b.urgency in BloodUrgency.__members__:
            urgency_val = BloodUrgency(draft_b.urgency)

        blood_in = BloodRequestCreate(
            blood_group=bg_enum,
            units_required=units,
            hospital_name=hosp_name,
            hospital_area=hosp_area,
            district=district,
            required_date=datetime.now(timezone.utc) + timedelta(hours=24),
            required_time=draft_b.required_time or "Immediate",
            urgency=urgency_val,
            contact_name=draft_b.contact_name or current_user.full_name or current_user.username,
            contact_phone=draft_b.contact_phone or current_user.phone_number or "01700000000",
            contact_method=draft_b.contact_method or "PHONE",
            additional_information=draft_b.additional_information,
        )

        blood_record = await blood_service.create_blood_request(
            db=db,
            user_id=current_user.id,
            data=blood_in,
        )

        resp = EmergencyConfirmationResponse(
            status="CONFIRMED",
            emergency_type=EmergencyType.BLOOD_REQUEST,
            record_id=str(blood_record.id),
            request_status="OPEN",
            redirect_url=f"/blood-help",
            message="Your emergency blood request has been published to registered community donors.",
        )

        _CONFIRMED_DRAFTS[dedup_key] = {
            "emergency_type": EmergencyType.BLOOD_REQUEST,
            "record_id": str(blood_record.id),
            "request_status": "OPEN",
            "redirect_url": f"/blood-help",
            "created_at": datetime.now(timezone.utc),
        }
        return resp

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown emergency type: {request.emergency_type}",
        )


# ---------------------------------------------------------------------------
# 3. AI Emergency Action Planner Endpoint
# ---------------------------------------------------------------------------

@router.post(
    "/safety/action-plan",
    response_model=EmergencyActionPlanResponse,
    summary="Generate contextual emergency action plans and safety checklists",
)
async def get_emergency_action_plan(
    request: ActionPlannerRequest,
):
    """
    Returns concise, practical safety instructions and 999 hotline access based on emergency type.
    """
    return await action_planner_service.generate_emergency_action_plan(
        emergency_type=request.emergency_type,
        details=request.details,
        lang=request.lang,
    )


# ---------------------------------------------------------------------------
# 4. Duplicate Incident Detection Endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/reports/duplicate-check",
    response_model=DuplicateDetectionResponse,
    summary="Analyze potential duplicate reports for an incident or draft",
)
async def check_incident_duplicates(
    request: DuplicateCheckRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Identifies potential duplicate reports using geographic proximity, temporal window,
    and text token overlap.
    """
    return await duplicate_detection_service.check_for_duplicates(
        db=db,
        candidate_data=request,
    )


@router.post(
    "/admin/duplicates/action",
    summary="Moderator confirmation or rejection of duplicate incident relationships",
)
async def handle_duplicate_action(
    request: ModeratorDuplicateActionRequest,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_current_active_admin),
):
    """
    Allows authorized administrators/moderators to confirm or reject duplicate reports,
    organizing them into non-destructive incident clusters.
    """
    if request.action == "confirm":
        cluster = await duplicate_detection_service.confirm_duplicate_relationship(
            db=db,
            primary_report_id=request.primary_report_id,
            duplicate_report_id=request.duplicate_report_id,
            admin_id=admin_user.id,
            notes=request.notes,
        )
        return {
            "status": "confirmed",
            "cluster_id": str(cluster.id),
            "message": "Duplicate incident relationship confirmed and clustered.",
        }
    else:
        return {
            "status": "rejected",
            "message": "Duplicate suggestion rejected. Reports remain independent.",
        }


# ---------------------------------------------------------------------------
# 5. AI Blood Donation Assistant Endpoint
# ---------------------------------------------------------------------------

@router.post(
    "/blood/ai-assistant",
    response_model=BloodAssistantResponse,
    summary="Natural-language donor discovery searching real database records",
)
async def query_blood_donors_ai(
    request: BloodAssistantQueryRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    """
    Parses natural language blood requests (in Bangla or English), queries real registered volunteer donors,
    applies strict exact-match blood group compatibility, and returns privacy-filtered contact details.
    """
    return await blood_ai_service.search_blood_donors_ai(
        db=db,
        request=request,
        current_user=current_user,
    )


# ---------------------------------------------------------------------------
# 6. AI Donor Coordination Assistant Endpoints (Phase B)
# ---------------------------------------------------------------------------

@router.post(
    "/reports/ai-assistant/donor-coordination",
    response_model=DonorCoordinationResponse,
    summary="Natural-language blood request donor coordination assistant (Phase B)",
)
async def chat_donor_coordination(
    request: DonorCoordinationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    """
    Coordinates blood requests, explains matching criteria, details donor responses,
    and prepares outreach previews using verified database records.
    """
    return await donor_coordination_service.process_donor_coordination_chat(
        db=db,
        request_data=request,
        current_user=current_user,
    )


@router.post(
    "/reports/ai-assistant/donor-coordination/confirm",
    response_model=DonorCoordinationConfirmResponse,
    status_code=status.HTTP_200_OK,
    summary="Explicit execution of confirmed donor coordination actions (e.g. outreach or interest)",
)
async def confirm_donor_coordination_action(
    request: DonorCoordinationConfirmRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Explicit user confirmation endpoint:
    - Never triggers without authenticated user confirmation.
    - Consumes single-use token to guarantee idempotency.
    - Executes actual mutation via existing backend domain services.
    """
    try:
        return await donor_coordination_service.execute_donor_coordination_confirmation(
            db=db,
            confirm_data=request,
            current_user=current_user,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )


# ---------------------------------------------------------------------------
# 7. Incident Intelligence Agent Endpoints (Phase C)
# ---------------------------------------------------------------------------

@router.post(
    "/reports/ai-assistant/incident-intelligence",
    response_model=IncidentIntelligenceResponse,
    summary="Agentic incident intelligence, grounded DB analysis, and report assistance (Phase C)",
)
async def chat_incident_intelligence(
    request: IncidentIntelligenceRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    """
    Understands citizen and moderator incident requests across Bangla, English, and Banglish.
    Dispatches to controlled database tools, enforces field-level privacy and role-based permissions,
    distinguishes verified database facts from AI interpretation, and returns grounded intelligence.
    """
    return await incident_intelligence_service.process_incident_intelligence_chat(
        db=db,
        request_data=request,
        current_user=current_user,
    )


# ---------------------------------------------------------------------------
# 8. Admin & Moderator Copilot Endpoints (Phase D)
# ---------------------------------------------------------------------------

@router.post(
    "/admin/ai-assistant/copilot",
    response_model=AdminCopilotResponse,
    summary="Agentic Admin & Moderator Copilot for platform operational intelligence (Phase D)",
)
async def chat_admin_copilot(
    request: AdminCopilotRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_moderator_or_admin),
):
    """
    Authorized operational intelligence agent for administrators and safety moderators.
    Queries real database records, provides report and queue analysis, identifies bottlenecks,
    and prepares safe moderation actions requiring explicit human confirmation.
    """
    return await admin_copilot_service.process_admin_copilot_chat(
        db=db,
        request_data=request,
        current_user=current_user,
    )


@router.post(
    "/admin/ai-assistant/copilot/confirm",
    response_model=AdminCopilotConfirmResponse,
    status_code=status.HTTP_200_OK,
    summary="Explicit human execution of confirmed moderation actions (Phase D)",
)
async def confirm_admin_copilot_action(
    request: AdminCopilotConfirmRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_moderator_or_admin),
):
    """
    Human confirmation endpoint for state-changing moderation actions.
    Validates single-use token, revalidates report status, applies state transition,
    records audit trail, and returns verified backend result.
    """
    try:
        return await admin_copilot_service.execute_admin_copilot_confirmation(
            db=db,
            confirm_data=request,
            current_user=current_user,
        )
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(val_err),
        )
    except PermissionError as perm_err:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(perm_err),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )


