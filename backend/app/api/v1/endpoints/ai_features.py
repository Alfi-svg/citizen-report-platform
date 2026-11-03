import uuid
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.api.deps import get_optional_current_user, get_current_active_admin
from app.models.user import User
from app.schemas.ai_features import (
    RoadSafetyIntelligenceResponse,
    RouteRiskEvaluationRequest,
    RouteRiskEvaluationResponse,
    EmergencyAssistantRequest,
    EmergencyAssistantResponse,
    ActionPlannerRequest,
    EmergencyActionPlanResponse,
    DuplicateCheckRequest,
    DuplicateDetectionResponse,
    ModeratorDuplicateActionRequest,
    BloodAssistantQueryRequest,
    BloodAssistantResponse,
)
from app.services import (
    road_safety as road_safety_service,
    emergency_assistant as emergency_assistant_service,
    action_planner as action_planner_service,
    duplicate_detection as duplicate_detection_service,
    blood_ai_assistant as blood_ai_service,
)

router = APIRouter()


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
