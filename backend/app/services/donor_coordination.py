import re
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.core.geo import (
    BD_DISTRICT_COORDS,
    BD_HOSPITAL_AREAS,
    AREA_TO_DISTRICT,
    calculate_haversine_distance,
    resolve_location_coordinates,
)
from app.models.user import User, UserRole
from app.models.blood import (
    BloodGroup,
    BloodUrgency,
    BloodRequestStatus,
    DonorAvailability,
    ResponseStatus,
    BloodRequest,
    BloodDonorProfile,
    BloodRequestResponse,
)
from app.models.notification import Notification, NotificationType
from app.schemas.blood import (
    BloodRespondCreate,
    BloodResponseItem,
)
from app.schemas.ai_features import (
    ChatMessage,
    BloodDonorResultItem,
    DonorCoordinationIntent,
    ActionPreview,
    DonorMatchingExplanation,
    DonorCoordinationRequest,
    DonorCoordinationResponse,
    DonorCoordinationConfirmRequest,
    DonorCoordinationConfirmResponse,
    # Controlled Agent Tools Schemas
    SearchBloodDonorsInput,
    SearchBloodDonorsOutput,
    GetBloodRequestInput,
    GetBloodRequestOutput,
    GetDonorMatchesInput,
    GetDonorMatchesOutput,
    GetDonorResponseSummaryInput,
    GetDonorResponseSummaryOutput,
    ExplainMatchingResultsInput,
    ExplainMatchingResultsOutput,
    PrepareOutreachPreviewInput,
    PrepareOutreachPreviewOutput,
)
from app.services.blood import (
    BLOOD_COMPATIBILITY,
    DONOR_CAN_GIVE_TO,
    get_blood_request_by_id,
    create_request_response,
)
from app.services.ai_client import call_ai_json

logger = logging.getLogger("donor_coordination")

# In-memory store for action confirmation tokens to enforce idempotency and prevent duplicate executions
_COORDINATION_TOKENS: Dict[str, Dict[str, Any]] = {}


def _prune_coordination_tokens() -> None:
    """Removes expired active tokens and completed tokens older than 24h, keeping dictionary bounded."""
    now = datetime.now(timezone.utc)
    cutoff_completed = now - timedelta(hours=24)
    cutoff_active = now - timedelta(minutes=30)
    expired = []
    for k, v in _COORDINATION_TOKENS.items():
        if k.startswith("COMPLETED:"):
            if v.get("completed_at") and v["completed_at"] < cutoff_completed:
                expired.append(k)
        elif v.get("created_at") and v["created_at"] < cutoff_active:
            expired.append(k)
    for k in expired:
        _COORDINATION_TOKENS.pop(k, None)
    if len(_COORDINATION_TOKENS) > 5000:
        keys_to_drop = list(_COORDINATION_TOKENS.keys())[: len(_COORDINATION_TOKENS) - 5000]
        for k in keys_to_drop:
            _COORDINATION_TOKENS.pop(k, None)


# ---------------------------------------------------------------------------
# Natural Language Parameter Extraction Helpers
# ---------------------------------------------------------------------------
def extract_blood_group(text: str) -> Optional[BloodGroup]:
    """
    Identifies standard blood group from English, Bengali, or symbol representations.
    """
    t = text.upper()
    # Check AB first before A or B
    if re.search(r"\bAB\s*\+", t) or "AB POSITIVE" in t or "AB POS" in t:
        return BloodGroup.AB_POS
    if re.search(r"\bAB\s*\-", t) or "AB NEGATIVE" in t or "AB NEG" in t:
        return BloodGroup.AB_NEG
    if re.search(r"\bA\s*\+", t) or "A POSITIVE" in t or "A POS" in t:
        return BloodGroup.A_POS
    if re.search(r"\bA\s*\-", t) or "A NEGATIVE" in t or "A NEG" in t:
        return BloodGroup.A_NEG
    if re.search(r"\bB\s*\+", t) or "B POSITIVE" in t or "B POS" in t:
        return BloodGroup.B_POS
    if re.search(r"\bB\s*\-", t) or "B NEGATIVE" in t or "B NEG" in t:
        return BloodGroup.B_NEG
    if re.search(r"\bO\s*\+", t) or "O POSITIVE" in t or "O POS" in t:
        return BloodGroup.O_POS
    if re.search(r"\bO\s*\-", t) or "O NEGATIVE" in t or "O NEG" in t:
        return BloodGroup.O_NEG
    return None


def extract_location_info(text: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Extracts district and approximate area from query text.
    Returns (district, area).
    """
    t = text.lower()
    detected_district = None
    detected_area = None

    # Check known medical/urban areas
    for area_key, dist_val in AREA_TO_DISTRICT.items():
        if re.search(r"\b" + re.escape(area_key) + r"\b", t):
            detected_area = area_key.title()
            detected_district = dist_val
            break

    # If district not yet found, check all 64 districts
    if not detected_district:
        for dist_key in BD_DISTRICT_COORDS.keys():
            if re.search(r"\b" + re.escape(dist_key) + r"\b", t):
                detected_district = dist_key.title()
                break

    return detected_district, detected_area


def _extract_request_id_from_text(text: str) -> Optional[uuid.UUID]:
    """Extracts standard UUID string from natural text."""
    m = re.search(r"\b([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\b", text)
    if m:
        try:
            return uuid.UUID(m.group(1))
        except ValueError:
            pass
    return None


# ---------------------------------------------------------------------------
# Heuristic Intent Classifier (Bengali, English, Banglish)
# ---------------------------------------------------------------------------
def _classify_intent_heuristically(text: str, has_request_context: bool = False) -> DonorCoordinationIntent:
    t = text.lower()

    # 1. View Donor Responses ("Who accepted", "How many donors interested", "কয়জন রাজি", "have responded")
    if any(w in t for w in [
        "who accepted", "which donors accepted", "which donors have already accepted", "already accepted",
        "have already accepted", "have accepted", "which donors", "how many donors interested",
        "how many donors have responded", "how many donors", "donor responses", "who responded",
        "accepted donors", "responses", "have responded", "donors responded", "has responded",
        "কয়জন donor interested", "কয়জন রাজি", "কে কে রাজি", "রেসপন্স কত", "রিসপন্স", "কারা একসেপ্ট করেছে",
        "কারা সাহায্য করতে চায়", "ডোনার রেসপন্স",
        "koyjon donor interested", "koyjon raji", "ke ke response dise", "kotojon accept korse", "koyjon donor"
    ]):
        return DonorCoordinationIntent.VIEW_DONOR_RESPONSES

    # 2. Outreach / Broadcast ("Outreach status", "Notify donors", "আউটরিচ")
    if any(w in t for w in [
        "outreach status", "outreach", "broadcast", "notify matching donors", "notify donors",
        "send notification", "alert donors", "request outreach",
        "আউটরিচ", "নোটিফিকেশন পাঠাও", "ডোনারদের জানাও", "ব্রডকাস্ট", "মেসেজ পাঠাও", "আউটরিচ স্ট্যাটাস",
        "outreach status ki", "donor der notify koro", "notification pathao", "outreach koro", "broadcast koro"
    ]):
        return DonorCoordinationIntent.REQUEST_OUTREACH

    # 3. Explain Donor Match ("Why these donors match", "কেন match করে")
    if any(w in t for w in [
        "why these donors match", "explain donor match", "why match", "explain compatibility",
        "match criteria", "why do they match",
        "কেন match করে", "কেন মিলল", "ম্যাচিং কারণ", "ম্যাচ করার কারণ", "কম্প্যাটিবল কেন", "কেন ম্যাচিং",
        "keno match kore", "match er reason", "keno match holo", "compatibility keno"
    ]):
        return DonorCoordinationIntent.EXPLAIN_DONOR_MATCH

    # 4. Natural Language Donor Search (e.g. "Find O+ donors", "Amar O+ blood lagbe", "Show available O positive donors")
    bg = extract_blood_group(text)
    if bg is not None or any(w in t for w in [
        "find donor", "find donors", "search donor", "search donors", "available donor", "available donors",
        "blood lagbe", "donor lagbe", "donor dekhao", "donors near", "donor near", "show available",
        "রক্তদাতা খুঁজুন", "রক্তদাতা দরকার", "ডোনার দরকার", "ডোনার দেখাও", "রক্ত লাগবে", "ডোনার খুঁজুন",
        "donor khujun", "donor dorkar", "rokto lagbe", "donor chai"
    ]):
        # If user explicitly asks for matching donors on an active request ("for my request", "amar request er jonno")
        if has_request_context and any(w in t for w in ["for my request", "for this request", "amar request", "ei request"]):
            return DonorCoordinationIntent.FIND_MATCHING_DONORS
        return DonorCoordinationIntent.SEARCH_BLOOD_DONORS

    # 5. Matching Donors for a Request ("Show matching donors", "Who can donate")
    if any(w in t for w in [
        "show matching donors", "find matching donors", "matching donors", "who can donate",
        "list donors", "eligible donors for my request", "how many eligible donors",
        "ম্যাচিং ডোনার দেখাও", "ডোনারদের তালিকা", "উপযুক্ত রক্তদাতা", "কারা রক্ত দিতে পারবে",
        "matching donor dekhaw", "donor list", "available donor kara"
    ]):
        return DonorCoordinationIntent.FIND_MATCHING_DONORS

    # 6. Express Donor Interest ("আমি আগ্রহী", "I can help", "interested to donate")
    if any(w in t for w in [
        "can help", "offer blood", "want to donate", "volunteer", "interested to donate", "interested to help",
        "willing to donate", "can donate", "help with this request", "i can help", "interested in donating",
        "interested",
        "রক্ত দিতে চাই", "সাহায্য করতে চাই", "ডোনেট করতে চাই", "ডোনার হতে চাই", "আগ্রহী", "দান করতে চাই",
        "rokto dite chai", "help korte chai", "interested hote chai", "donate korbo", "shajjo korte chai"
    ]):
        return DonorCoordinationIntent.EXPRESS_DONOR_INTEREST

    # 7. View Request Status ("What is the status", "স্ট্যাটাস কী")
    if any(w in t for w in [
        "donor status", "request status", "status of this request", "is this request active",
        "what is the status", "status",
        "request এর donor status কী", "স্ট্যাটাস কী", "রিকোয়েস্টের অবস্থা", "রিকোয়েস্ট কি চালু আছে", "স্ট্যাটাস কি",
        "request er status ki", "donor status ki", "request active kina"
    ]):
        return DonorCoordinationIntent.VIEW_REQUEST_STATUS

    # Default fallback
    if has_request_context:
        return DonorCoordinationIntent.VIEW_REQUEST_STATUS
    return DonorCoordinationIntent.SEARCH_BLOOD_DONORS


# ---------------------------------------------------------------------------
# 6 Controlled Backend Tools
# ---------------------------------------------------------------------------

async def tool_search_blood_donors(
    db: AsyncSession,
    params: SearchBloodDonorsInput,
    current_user: Optional[User] = None,
) -> SearchBloodDonorsOutput:
    """
    Controlled Tool: Search blood donors in database with typed filtering and privacy safeguards.
    Never executes arbitrary SQL; arguments strictly validated via SearchBloodDonorsInput schema.
    """
    target_bg: Optional[BloodGroup] = None
    if params.blood_group:
        norm = params.blood_group.replace(" ", "+").upper().strip()
        try:
            target_bg = BloodGroup(norm)
        except ValueError:
            target_bg = extract_blood_group(params.blood_group)

    conditions = []
    if target_bg:
        conditions.append(BloodDonorProfile.blood_group == target_bg)

    if params.district and params.district.strip():
        conditions.append(func.lower(BloodDonorProfile.district) == params.district.lower().strip())

    if params.area and params.area.strip():
        conditions.append(BloodDonorProfile.area.ilike(f"%{params.area.strip()}%"))

    if params.availability_only:
        conditions.append(BloodDonorProfile.availability_status == DonorAvailability.AVAILABLE)

    if current_user:
        conditions.append(BloodDonorProfile.user_id != current_user.id)

    stmt = (
        select(BloodDonorProfile)
        .where(and_(*conditions))
        .order_by(BloodDonorProfile.updated_at.desc())
        .limit(params.limit * 3)  # buffer for post-filtering
    )
    result = await db.execute(stmt)
    profiles = list(result.scalars().all())

    now = datetime.now(timezone.utc)
    donor_items: List[BloodDonorResultItem] = []

    for p in profiles:
        eligible = True
        if p.last_donation_date:
            dt = p.last_donation_date
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            if (now - dt).total_seconds() / 86400.0 < 90.0:
                eligible = False

        if params.eligible_only and not eligible:
            continue

        donor_name = (p.user.full_name or p.user.username) if p.user else "Volunteer Donor"

        lat, lng = resolve_location_coordinates(
            district=p.district,
            area=p.area,
            seed_key=p.id,
        )

        dist_km = None
        if params.nearby_lat is not None and params.nearby_lng is not None:
            dist_km = calculate_haversine_distance(params.nearby_lat, params.nearby_lng, lat, lng)
            if params.radius_km is not None and dist_km > params.radius_km:
                continue

        explanation = f"Registered {p.blood_group.value} donor in {p.area}, {p.district}."
        if eligible:
            explanation += " Clinically eligible (>90d donation cooldown)."
        else:
            explanation += " Recent donation interval pending (<90d)."

        donor_items.append(
            BloodDonorResultItem(
                donor_id=str(p.id),
                display_name=donor_name,
                blood_group=p.blood_group.value,
                district=p.district,
                area=p.area,
                availability_status=p.availability_status.value,
                last_donation_date=p.last_donation_date,
                eligible_to_donate=eligible,
                contact_phone="Protected by Nirapotta",
                preferred_contact_method=p.preferred_contact_method,
                distance_km=dist_km,
                approximate_latitude=lat,
                approximate_longitude=lng,
                match_explanation=explanation,
            )
        )
        if len(donor_items) >= params.limit:
            break

    criteria = {
        "blood_group": target_bg.value if target_bg else "ANY",
        "district": params.district or "ANY",
        "area": params.area or "ANY",
        "availability_only": params.availability_only,
        "eligible_only": params.eligible_only,
    }
    return SearchBloodDonorsOutput(
        donors=donor_items,
        total_found=len(donor_items),
        criteria_applied=criteria,
    )


async def tool_get_blood_request(
    db: AsyncSession,
    params: GetBloodRequestInput,
    current_user: Optional[User] = None,
) -> GetBloodRequestOutput:
    """
    Controlled Tool: Retrieve details of a specific blood request with permission-aware field filtering.
    """
    req_uuid = uuid.UUID(params.request_id.strip())
    blood_req = await get_blood_request_by_id(db, req_uuid)
    if not blood_req:
        raise ValueError(f"Blood request '{params.request_id}' not found.")

    is_owner = bool(current_user and current_user.id == blood_req.user_id)
    is_admin = bool(current_user and current_user.role == UserRole.ADMIN)

    contact_name = blood_req.contact_name if (is_owner or is_admin) else None
    contact_phone = blood_req.contact_phone if (is_owner or is_admin) else None

    return GetBloodRequestOutput(
        request_id=str(blood_req.id),
        blood_group=blood_req.blood_group.value,
        units_required=blood_req.units_required,
        hospital_name=blood_req.hospital_name,
        hospital_area=blood_req.hospital_area,
        district=blood_req.district,
        urgency=blood_req.urgency.value,
        status=blood_req.status.value,
        required_date=blood_req.required_date,
        required_time=blood_req.required_time,
        additional_information=blood_req.additional_information,
        response_count=len(blood_req.responses) if blood_req.responses else 0,
        is_own_request=is_owner,
        contact_name=contact_name,
        contact_phone=contact_phone,
    )


async def tool_get_donor_matches(
    db: AsyncSession,
    params: GetDonorMatchesInput,
    current_user: Optional[User] = None,
) -> GetDonorMatchesOutput:
    """
    Controlled Tool: Retrieve medically compatible active donors in the hospital district.
    """
    req_uuid = uuid.UUID(params.request_id.strip())
    blood_req = await get_blood_request_by_id(db, req_uuid)
    if not blood_req:
        raise ValueError(f"Blood request '{params.request_id}' not found.")

    compatible_groups = BLOOD_COMPATIBILITY.get(blood_req.blood_group, [blood_req.blood_group])
    comp_strings = [bg.value for bg in compatible_groups]

    stmt = (
        select(BloodDonorProfile)
        .where(
            BloodDonorProfile.blood_group.in_(compatible_groups),
            func.lower(BloodDonorProfile.district) == blood_req.district.lower().strip(),
            BloodDonorProfile.availability_status == DonorAvailability.AVAILABLE,
            BloodDonorProfile.user_id != blood_req.user_id,
        )
        .order_by(BloodDonorProfile.updated_at.desc())
        .limit(params.limit)
    )
    res = await db.execute(stmt)
    profiles = list(res.scalars().all())

    now = datetime.now(timezone.utc)
    donor_items: List[BloodDonorResultItem] = []
    for p in profiles:
        eligible = True
        if p.last_donation_date:
            dt = p.last_donation_date
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            if (now - dt).total_seconds() / 86400.0 < 90.0:
                eligible = False

        donor_name = (p.user.full_name or p.user.username) if p.user else "Volunteer Donor"
        lat, lng = resolve_location_coordinates(
            district=p.district,
            area=p.area,
            seed_key=p.id,
        )

        donor_items.append(
            BloodDonorResultItem(
                donor_id=str(p.id),
                display_name=donor_name,
                blood_group=p.blood_group.value,
                district=p.district,
                area=p.area,
                availability_status=p.availability_status.value,
                last_donation_date=p.last_donation_date,
                eligible_to_donate=eligible,
                contact_phone="Protected by Nirapotta",
                preferred_contact_method=p.preferred_contact_method,
                approximate_latitude=lat,
                approximate_longitude=lng,
                match_explanation=f"Compatible {p.blood_group.value} donor in {p.area}, {p.district}.",
            )
        )

    return GetDonorMatchesOutput(
        request_id=str(blood_req.id),
        recipient_blood_group=blood_req.blood_group.value,
        compatible_blood_groups=comp_strings,
        district=blood_req.district,
        matched_donors=donor_items,
        total_matches=len(donor_items),
    )


async def tool_get_donor_response_summary(
    db: AsyncSession,
    params: GetDonorResponseSummaryInput,
    current_user: Optional[User] = None,
) -> GetDonorResponseSummaryOutput:
    """
    Controlled Tool: Retrieve volunteer donor responses for a blood request.
    Strictly verifies that current_user is the request owner or an administrator.
    """
    req_uuid = uuid.UUID(params.request_id.strip())
    blood_req = await get_blood_request_by_id(db, req_uuid)
    if not blood_req:
        return GetDonorResponseSummaryOutput(
            request_id=params.request_id,
            is_authorized=False,
            error_message="Blood request not found.",
        )

    is_owner = bool(current_user and current_user.id == blood_req.user_id)
    is_admin = bool(current_user and current_user.role == UserRole.ADMIN)

    if not is_owner and not is_admin:
        return GetDonorResponseSummaryOutput(
            request_id=params.request_id,
            is_authorized=False,
            error_message="Authorization Denied: Only the request owner or an administrator can inspect volunteer donor responses.",
        )

    resp_stmt = select(BloodRequestResponse).where(BloodRequestResponse.request_id == blood_req.id)
    responses = list((await db.execute(resp_stmt)).scalars().all())

    accepted_count = sum(1 for r in responses if r.status == ResponseStatus.ACCEPTED)
    pending_count = sum(1 for r in responses if r.status == ResponseStatus.PENDING)
    declined_count = sum(1 for r in responses if r.status == ResponseStatus.DECLINED)

    serialized_responses = []
    for r in responses:
        d_name = (r.donor.full_name or r.donor.username) if r.donor else "Volunteer Donor"
        phone = r.contact_phone or ""
        masked_phone = f"{phone[:3]}*****{phone[-2:]}" if len(phone) >= 7 else "Masked"
        serialized_responses.append({
            "response_id": str(r.id),
            "donor_display_name": d_name,
            "status": r.status.value,
            "masked_phone": masked_phone,
            "created_at": r.created_at.isoformat(),
        })

    return GetDonorResponseSummaryOutput(
        request_id=str(blood_req.id),
        is_authorized=True,
        total_responses=len(responses),
        accepted_count=accepted_count,
        pending_count=pending_count,
        declined_count=declined_count,
        responses=serialized_responses,
    )


def tool_explain_matching_results(
    params: ExplainMatchingResultsInput,
) -> ExplainMatchingResultsOutput:
    """
    Controlled Tool: Returns authoritative medical explanation grounded in BLOOD_COMPATIBILITY matrix.
    Never hallucinates or overrides clinical transfusion rules.
    """
    try:
        recip_bg = BloodGroup(params.recipient_blood_group.replace(" ", "+").upper().strip())
    except ValueError:
        raise ValueError(f"Invalid recipient blood group: '{params.recipient_blood_group}'")

    comp_groups = BLOOD_COMPATIBILITY.get(recip_bg, [recip_bg])
    comp_strings = [bg.value for bg in comp_groups]

    is_compatible = None
    if params.donor_blood_group:
        try:
            donor_bg = BloodGroup(params.donor_blood_group.replace(" ", "+").upper().strip())
            is_compatible = (donor_bg in comp_groups)
        except ValueError:
            pass

    guidelines = [
        f"ABO/Rh Transfusion Safety: Recipient {recip_bg.value} can receive blood from [{', '.join(comp_strings)}].",
        "Universal Donor Property: O- red blood cells can be transfused to any blood group in emergencies.",
        "Universal Recipient Property: AB+ individuals can safely receive red blood cells from all blood groups.",
        "Clinical Freshness Interval: 90-day clinical cooldown between whole blood donations enforced.",
    ]

    if is_compatible is True:
        explanation = f"Compatible: A donor with blood group {params.donor_blood_group} can safely donate red blood cells to a patient with blood group {recip_bg.value}."
    elif is_compatible is False:
        explanation = f"Incompatible: A donor with blood group {params.donor_blood_group} CANNOT donate red blood cells to a patient with blood group {recip_bg.value} due to antigen mismatch."
    else:
        explanation = f"Patients with blood group {recip_bg.value} can safely receive red blood cells from donors with groups: {', '.join(comp_strings)}."

    return ExplainMatchingResultsOutput(
        recipient_blood_group=recip_bg.value,
        compatible_donor_groups=comp_strings,
        is_compatible=is_compatible,
        explanation=explanation,
        safety_guidelines=guidelines,
    )


async def tool_prepare_outreach_preview(
    db: AsyncSession,
    params: PrepareOutreachPreviewInput,
    current_user: Optional[User] = None,
) -> PrepareOutreachPreviewOutput:
    """
    Controlled Tool: Prepare an outreach preview for a blood request to broadcast alerts to compatible donors.
    Enforces owner authorization and prepares a single-use token. Never mutates the database.
    """
    req_uuid = uuid.UUID(params.request_id.strip())
    blood_req = await get_blood_request_by_id(db, req_uuid)
    if not blood_req:
        return PrepareOutreachPreviewOutput(
            request_id=params.request_id,
            is_authorized=False,
            error_message="Blood request not found.",
        )

    is_owner = bool(current_user and current_user.id == blood_req.user_id)
    is_admin = bool(current_user and current_user.role == UserRole.ADMIN)

    if not is_owner and not is_admin:
        return PrepareOutreachPreviewOutput(
            request_id=params.request_id,
            is_authorized=False,
            error_message="Authorization Denied: Only the request owner or an administrator can prepare outreach notifications.",
        )

    if blood_req.status not in (BloodRequestStatus.OPEN, BloodRequestStatus.RESPONDED):
        return PrepareOutreachPreviewOutput(
            request_id=params.request_id,
            is_authorized=False,
            error_message=f"Cannot prepare outreach: Request is currently {blood_req.status.value}.",
        )

    compatible_groups = BLOOD_COMPATIBILITY.get(blood_req.blood_group, [blood_req.blood_group])
    comp_strings = [bg.value for bg in compatible_groups]

    outreach_stmt = (
        select(BloodDonorProfile.user_id)
        .where(
            BloodDonorProfile.district.ilike(blood_req.district),
            BloodDonorProfile.availability_status == DonorAvailability.AVAILABLE,
            BloodDonorProfile.blood_group.in_(compatible_groups),
            BloodDonorProfile.user_id != blood_req.user_id,
        )
        .limit(params.max_donors)
    )
    eligible_user_ids = list((await db.execute(outreach_stmt)).scalars().all())
    count = len(eligible_user_ids)

    _prune_coordination_tokens()
    token = str(uuid.uuid4())
    preview = ActionPreview(
        action_type="TRIGGER_OUTREACH",
        action_title="Approve Community Donor Outreach",
        action_description=f"Confirm broadcasting an urgent in-app alert to {count} verified compatible donor(s) registered in {blood_req.district}.",
        request_id=str(blood_req.id),
        details={
            "eligible_recipient_count": count,
            "selected_channel": "IN_APP_NOTIFICATION",
            "blood_group": blood_req.blood_group.value,
            "district": blood_req.district,
            "deduplication_applied": True,
        },
        confirmation_token=token,
        requires_confirmation=True,
    )

    _COORDINATION_TOKENS[token] = {
        "action_type": "TRIGGER_OUTREACH",
        "request_id": str(blood_req.id),
        "user_id": current_user.id if current_user else None,
        "eligible_user_ids": eligible_user_ids,
        "created_at": datetime.now(timezone.utc),
    }

    return PrepareOutreachPreviewOutput(
        request_id=str(blood_req.id),
        is_authorized=True,
        eligible_donor_count=count,
        compatible_blood_groups=comp_strings,
        district=blood_req.district,
        action_preview=preview,
    )


# ---------------------------------------------------------------------------
# Core Service: Process Donor Coordination Natural Language Chat
# ---------------------------------------------------------------------------
async def process_donor_coordination_chat(
    db: AsyncSession,
    request_data: DonorCoordinationRequest,
    current_user: Optional[User],
) -> DonorCoordinationResponse:
    """
    Coordinates blood requests and donor discovery through natural language using controlled backend tools.
    Never constructs unrestricted database queries. Strictly validates schemas and grounds responses in DB records.
    """
    conversation_id = request_data.conversation_id or str(uuid.uuid4())
    is_bn = (request_data.lang == "bn")
    query_text = request_data.message.strip()

    # 1. Resolve Target Request UUID (if any)
    target_uuid: Optional[uuid.UUID] = None
    if request_data.request_id:
        try:
            target_uuid = uuid.UUID(request_data.request_id.strip())
        except ValueError:
            target_uuid = None

    if not target_uuid:
        target_uuid = _extract_request_id_from_text(query_text)

    if not target_uuid and request_data.history:
        for msg in reversed(request_data.history):
            extracted = _extract_request_id_from_text(msg.content)
            if extracted:
                target_uuid = extracted
                break

    auto_associated = False
    if not target_uuid and current_user:
        active_stmt = (
            select(BloodRequest)
            .where(
                BloodRequest.user_id == current_user.id,
                BloodRequest.is_active == True,
                BloodRequest.status.in_([BloodRequestStatus.OPEN, BloodRequestStatus.RESPONDED]),
            )
            .order_by(BloodRequest.created_at.desc())
            .limit(1)
        )
        active_req = (await db.execute(active_stmt)).scalar_one_or_none()
        if active_req:
            target_uuid = active_req.id
            auto_associated = True

    has_request = (target_uuid is not None)

    # 2. Heuristic and Natural Language Intent Classification
    intent = _classify_intent_heuristically(query_text, has_request_context=has_request)

    # -----------------------------------------------------------------------
    # INTENT: SEARCH_BLOOD_DONORS (Natural language donor search by group/location)
    # -----------------------------------------------------------------------
    if intent == DonorCoordinationIntent.SEARCH_BLOOD_DONORS:
        bg = extract_blood_group(query_text)
        district, area = extract_location_info(query_text)

        # If user says "find donors" but no blood group or request context is present
        if not bg and not has_request:
            clarification_bn = (
                "রক্তদাতা খুঁজতে অনুগ্রহ করে রক্তের গ্রুপ উল্লেখ করুন (যেমন: O+, A+, B+, AB+, O-)। "
                "আপনি এলাকা বা জেলার নামও দিতে পারেন (যেমন: 'সাভারে O+ ডোনার দরকার')।"
            )
            clarification_en = (
                "To search for matching donors, please specify the required blood group (e.g., O+, A+, B+, AB+, O-). "
                "You can also specify an area or district (e.g., 'Show available O positive donors near Savar')."
            )
            return DonorCoordinationResponse(
                reply=clarification_bn if is_bn else clarification_en,
                intent=DonorCoordinationIntent.CLARIFY_REQUEST,
                request_id=None,
                is_clarification_needed=True,
                follow_up_question=clarification_bn if is_bn else clarification_en,
                conversation_id=conversation_id,
            )

        # Call controlled tool: search_blood_donors
        tool_input = SearchBloodDonorsInput(
            blood_group=bg.value if bg else None,
            district=district,
            area=area,
            availability_only=True,
            eligible_only=True,
            limit=10,
        )
        search_out = await tool_search_blood_donors(db, tool_input, current_user)

        loc_str = f"{area}, {district}" if (area and district) else (district or area or "Bangladesh")
        bg_str = bg.value if bg else "specified"

        if search_out.total_found > 0:
            if is_bn:
                reply = (
                    f"ডেটাবেস অনুসন্ধান ফলাফল:\n"
                    f"- রক্তের গ্রুপ: {bg_str}\n"
                    f"- এলাকা/জেলা: {loc_str}\n"
                    f"- সক্রিয় ও উপযুক্ত ডোনার পাওয়া গেছে: {search_out.total_found} জন।\n"
                    f"রক্তদাতাদের বিস্তারিত তালিকা নিচে দেখুন। নিরাপত্তার স্বার্থে যোগাযোগের তথ্য সুরক্ষিত রাখা হয়েছে।"
                )
            else:
                reply = (
                    f"Database Search Results:\n"
                    f"- Blood Group: {bg_str}\n"
                    f"- Area/District: {loc_str}\n"
                    f"- Active & Eligible Donors Found: {search_out.total_found}.\n"
                    f"View the donor cards below. Contact details are protected by Nirapotta privacy controls."
                )
        else:
            if is_bn:
                reply = (
                    f"দুঃখিত, বর্তমানে ডেটাবেসে '{loc_str}' এলাকায় কোনো সক্রিয় ও উপযুক্ত {bg_str} রক্তদাতা পাওয়া যায়নি।\n"
                    f"জরুরি প্রয়োজনে নতুন রক্তের আবেদন তৈরি করুন যাতে নিকটবর্তী স্বেচ্ছাসেবকদের স্বয়ংক্রিয় নোটিফিকেশন পাঠানো যায়।"
                )
            else:
                reply = (
                    f"No active and eligible {bg_str} donors were found in {loc_str} in the database.\n"
                    f"If you need blood urgently, please post a blood request at /blood-help/request to alert nearby volunteers."
                )

        return DonorCoordinationResponse(
            reply=reply,
            intent=intent,
            request_id=str(target_uuid) if target_uuid else None,
            matched_donors=search_out.donors,
            conversation_id=conversation_id,
        )

    # If the user did not supply a request UUID and intent is not a general search, ask clarification
    if not target_uuid:
        clarification_bn = (
            "আপনি কোন রক্তের আবেদনটি (Blood Request) সম্পর্কে জানতে বা সমন্বয় করতে চাচ্ছেন? "
            "অনুগ্রহ করে নির্দিষ্ট রিকোয়েস্টের লিঙ্কটি খুলুন অথবা আবেদন আইডিটি প্রদান করুন।"
        )
        clarification_en = (
            "Which blood request would you like to coordinate or check? "
            "Please open the specific blood request page or provide its Request ID."
        )
        return DonorCoordinationResponse(
            reply=clarification_bn if is_bn else clarification_en,
            intent=DonorCoordinationIntent.CLARIFY_REQUEST,
            request_id=None,
            is_clarification_needed=True,
            follow_up_question=clarification_bn if is_bn else clarification_en,
            conversation_id=conversation_id,
        )

    # 3. Retrieve authoritative BloodRequest from DB
    blood_req = await get_blood_request_by_id(db, target_uuid)
    if not blood_req or not blood_req.is_active:
        msg_bn = f"অনুরোধ আইডি '{target_uuid}' খুঁজে পাওয়া যায়নি অথবা এটি নিষ্ক্রিয় করা হয়েছে।"
        msg_en = f"Blood request '{target_uuid}' was not found or is no longer active."
        return DonorCoordinationResponse(
            reply=msg_bn if is_bn else msg_en,
            intent=DonorCoordinationIntent.VIEW_REQUEST_STATUS,
            request_id=str(target_uuid),
            is_clarification_needed=False,
            conversation_id=conversation_id,
        )

    is_owner = bool(current_user and current_user.id == blood_req.user_id)
    is_admin = bool(current_user and current_user.role == UserRole.ADMIN)
    is_authed = bool(current_user is not None)

    req_summary = {
        "id": str(blood_req.id),
        "blood_group": blood_req.blood_group.value,
        "units_required": blood_req.units_required,
        "hospital_name": blood_req.hospital_name,
        "hospital_area": blood_req.hospital_area,
        "district": blood_req.district,
        "urgency": blood_req.urgency.value,
        "status": blood_req.status.value,
        "is_active": blood_req.is_active,
        "is_own_request": is_owner,
        "response_count": len(blood_req.responses) if blood_req.responses else 0,
    }

    # -----------------------------------------------------------------------
    # INTENT: VIEW_REQUEST_STATUS
    # -----------------------------------------------------------------------
    if intent == DonorCoordinationIntent.VIEW_REQUEST_STATUS:
        req_out = await tool_get_blood_request(db, GetBloodRequestInput(request_id=str(blood_req.id)), current_user)

        resp_stmt = select(BloodRequestResponse).where(BloodRequestResponse.request_id == blood_req.id)
        responses = list((await db.execute(resp_stmt)).scalars().all())
        total_resp = len(responses)
        accepted_resp = sum(1 for r in responses if r.status == ResponseStatus.ACCEPTED)
        pending_resp = total_resp - accepted_resp

        if is_bn:
            reply = (
                f"রক্তের আবেদন সারসংক্ষেপ (আইডি: {str(blood_req.id)[:8]}...):\n"
                f"- রক্তের গ্রুপ: {req_out.blood_group} ({req_out.units_required} ব্যাগ)\n"
                f"- হাসপাতাল: {req_out.hospital_name}, {req_out.hospital_area}, {req_out.district}\n"
                f"- জরুরি মাত্রা: {req_out.urgency}\n"
                f"- বর্তমান স্ট্যাটাস: {req_out.status}\n"
                f"- সাড়াদানকারী ডোনার: মোট {total_resp} জন (গৃহীত: {accepted_resp}, অপেক্ষমাণ: {pending_resp})।"
            )
            if auto_associated:
                reply = "আপনার সক্রিয় রক্তের আবেদনের তথ্য নিচে প্রদান করা হলো:\n" + reply
        else:
            reply = (
                f"Blood Request Summary (ID: {str(blood_req.id)[:8]}...):\n"
                f"- Blood Group: {req_out.blood_group} ({req_out.units_required} bag(s))\n"
                f"- Hospital: {req_out.hospital_name}, {req_out.hospital_area}, {req_out.district}\n"
                f"- Urgency: {req_out.urgency}\n"
                f"- Current Status: {req_out.status}\n"
                f"- Donor Responses: Total {total_resp} (Accepted: {accepted_resp}, Pending: {pending_resp})."
            )
            if auto_associated:
                reply = "Here is the status for your current active blood request:\n" + reply

        return DonorCoordinationResponse(
            reply=reply,
            intent=intent,
            request_id=str(blood_req.id),
            request_summary=req_summary,
            conversation_id=conversation_id,
        )

    # -----------------------------------------------------------------------
    # INTENT: VIEW_DONOR_RESPONSES
    # -----------------------------------------------------------------------
    elif intent == DonorCoordinationIntent.VIEW_DONOR_RESPONSES:
        summary_out = await tool_get_donor_response_summary(
            db, GetDonorResponseSummaryInput(request_id=str(blood_req.id)), current_user
        )

        if not summary_out.is_authorized:
            refusal_bn = "অনুরোধের নিরাপত্তা ও রক্তদাতাদের গোপনীয়তা রক্ষায় কেবল আবেদনকারী অথবা অ্যাডমিন সাড়াদানকারী ডোনারদের বিস্তারিত তথ্য দেখতে পারেন।"
            refusal_en = "To safeguard donor privacy, only the creator of this blood request or an administrator can view donor response details."
            return DonorCoordinationResponse(
                reply=refusal_bn if is_bn else refusal_en,
                intent=intent,
                request_id=str(blood_req.id),
                request_summary=req_summary,
                conversation_id=conversation_id,
            )

        if summary_out.total_responses == 0:
            msg_bn = (
                f"বর্তমানে এই আবেদনের জন্য কোনো স্বেচ্ছাসেবী ডোনারের রেসপন্স নেই। "
                f"আপনি চাইলে এআই সহকারীর মাধ্যমে নিকটবর্তী {blood_req.blood_group.value} রক্তদাতাদের নোটিফিকেশন পাঠানোর অনুরোধ (Outreach) করতে পারেন।"
            )
            msg_en = (
                f"There are currently no volunteer donor responses for this request. "
                f"You can ask the assistant to prepare community outreach to notify nearby compatible {blood_req.blood_group.value} donors."
            )
            return DonorCoordinationResponse(
                reply=msg_bn if is_bn else msg_en,
                intent=intent,
                request_id=str(blood_req.id),
                request_summary=req_summary,
                conversation_id=conversation_id,
            )

        if is_bn:
            reply = (
                f"স্বেচ্ছাসেবী রক্তদাতাদের রেসপন্স বিবরণী (মোট: {summary_out.total_responses} জন):\n"
                f"- নিশ্চিত / গৃহীত রক্তদাতা: {summary_out.accepted_count} জন\n"
                f"- অপেক্ষমাণ রেসপন্স: {summary_out.pending_count} জন\n\n"
                f"বিস্তারিত দেখতে রক্তের আবেদনের বিবরণী পাতার Responses ট্যাব ব্যবহার করুন।"
            )
        else:
            reply = (
                f"Volunteer Donor Responses Summary (Total: {summary_out.total_responses}):\n"
                f"- Accepted Donors: {summary_out.accepted_count}\n"
                f"- Pending Expressions of Interest: {summary_out.pending_count}\n\n"
                f"You can contact the responding donors directly from the responses tab on the request details page."
            )

        return DonorCoordinationResponse(
            reply=reply,
            intent=intent,
            request_id=str(blood_req.id),
            request_summary=req_summary,
            conversation_id=conversation_id,
        )

    # -----------------------------------------------------------------------
    # INTENT: EXPLAIN_DONOR_MATCH or FIND_MATCHING_DONORS
    # -----------------------------------------------------------------------
    elif intent in (DonorCoordinationIntent.EXPLAIN_DONOR_MATCH, DonorCoordinationIntent.FIND_MATCHING_DONORS):
        matches_out = await tool_get_donor_matches(
            db, GetDonorMatchesInput(request_id=str(blood_req.id), limit=10), current_user
        )

        explain_out = tool_explain_matching_results(
            ExplainMatchingResultsInput(
                recipient_blood_group=blood_req.blood_group.value,
                district=blood_req.district,
            )
        )

        matching_explanation = DonorMatchingExplanation(
            recipient_blood_group=blood_req.blood_group.value,
            compatible_blood_groups=matches_out.compatible_blood_groups,
            total_compatible_found=matches_out.total_matches,
            district=blood_req.district,
            matching_criteria=explain_out.safety_guidelines,
            privacy_notice="Donor contact numbers are strictly protected and only shared through authorized coordination.",
        )

        if is_bn:
            reply = (
                f"রক্তদাতা ম্যাচিং ব্যাখ্যা (অনুরোধ গ্রুপ: {blood_req.blood_group.value}, জেলা: {blood_req.district}):\n"
                f"- সামঞ্জস্যপূর্ণ রক্তের গ্রুপ: {', '.join(matches_out.compatible_blood_groups)}\n"
                f"- ডেটাবেসে প্রাপ্ত সক্রিয় উপযুক্ত রক্তদাতা: {matches_out.total_matches} জন\n"
                f"- ম্যাচিং নীতিমালা: চিকিৎসা বিজ্ঞানসম্মত সামঞ্জস্যপূর্ণ গ্রুপ, ভৌগোলিক অবস্থান ({blood_req.district}) এবং সক্রিয় উপস্থিতি নিশ্চিত করা হয়েছে।"
            )
        else:
            reply = (
                f"Donor Matching Explanation (Recipient: {blood_req.blood_group.value}, District: {blood_req.district}):\n"
                f"- Medically Compatible Groups: {', '.join(matches_out.compatible_blood_groups)}\n"
                f"- Compatible Active Donors in Database: {matches_out.total_matches}\n"
                f"- Criteria: Blood group compatibility, geographical proximity ({blood_req.district}), and active status verification."
            )

        return DonorCoordinationResponse(
            reply=reply,
            intent=intent,
            request_id=str(blood_req.id),
            request_summary=req_summary,
            matching_explanation=matching_explanation,
            matched_donors=matches_out.matched_donors,
            conversation_id=conversation_id,
        )

    # -----------------------------------------------------------------------
    # INTENT: EXPRESS_DONOR_INTEREST
    # -----------------------------------------------------------------------
    elif intent == DonorCoordinationIntent.EXPRESS_DONOR_INTEREST:
        if not is_authed:
            login_msg_bn = "রক্তদান করতে আগ্রহ প্রকাশ করতে অনুগ্রহ করে আপনার সিটিজেন অ্যাকাউন্টে লগইন করুন।"
            login_msg_en = "Please sign in to your citizen account to express interest in volunteering for this blood request."
            return DonorCoordinationResponse(
                reply=login_msg_bn if is_bn else login_msg_en,
                intent=intent,
                request_id=str(blood_req.id),
                request_summary=req_summary,
                conversation_id=conversation_id,
            )

        if is_owner:
            owner_err_bn = "আপনি আপনার নিজের রক্তের আবেদনে ডোনার হিসেবে আবেদন করতে পারবেন না।"
            owner_err_en = "You cannot respond as a volunteer donor to your own blood request."
            return DonorCoordinationResponse(
                reply=owner_err_bn if is_bn else owner_err_en,
                intent=intent,
                request_id=str(blood_req.id),
                request_summary=req_summary,
                conversation_id=conversation_id,
            )

        if blood_req.status in (BloodRequestStatus.FULFILLED, BloodRequestStatus.CANCELLED):
            closed_bn = f"এই রক্তের আবেদনটি বর্তমানে {blood_req.status.value.lower()} অবস্থায় আছে, নতুন ডোনার রেসপন্স গ্রহণ বন্ধ।"
            closed_en = f"This blood request is currently {blood_req.status.value.lower()}; new donor responses are closed."
            return DonorCoordinationResponse(
                reply=closed_bn if is_bn else closed_en,
                intent=intent,
                request_id=str(blood_req.id),
                request_summary=req_summary,
                conversation_id=conversation_id,
            )

        already_responded = any(r.donor_user_id == current_user.id for r in blood_req.responses) if blood_req.responses else False
        if already_responded:
            dup_bn = "আপনি ইতোমধ্যে এই অনুরোধে সহায়তার আগ্রহ প্রকাশ করেছেন। আবেদনকারী প্রয়োজন অনুযায়ী আপনার সাথে যোগাযোগ করবেন।"
            dup_en = "You have already responded to this request. The requester will contact you if needed."
            return DonorCoordinationResponse(
                reply=dup_bn if is_bn else dup_en,
                intent=intent,
                request_id=str(blood_req.id),
                request_summary=req_summary,
                conversation_id=conversation_id,
            )

        _prune_coordination_tokens()
        token = str(uuid.uuid4())
        action_preview = ActionPreview(
            action_type="EXPRESS_INTEREST",
            action_title="রক্তদানে আগ্রহ নিশ্চিতকরণ" if is_bn else "Confirm Offering Blood Donation",
            action_description=(
                f"আপনি কি নিশ্চিত যে আপনি {blood_req.hospital_name} হাসপাতালে ভর্তি রোগীর জন্য {blood_req.blood_group.value} রক্তদানে সহায়তা করতে চান?"
                if is_bn else
                f"Confirm that you wish to volunteer and offer blood donation for the patient at {blood_req.hospital_name} ({blood_req.blood_group.value})."
            ),
            request_id=str(blood_req.id),
            details={
                "hospital": blood_req.hospital_name,
                "blood_group": blood_req.blood_group.value,
                "district": blood_req.district,
            },
            confirmation_token=token,
            requires_confirmation=True,
        )

        _COORDINATION_TOKENS[token] = {
            "action_type": "EXPRESS_INTEREST",
            "request_id": str(blood_req.id),
            "user_id": current_user.id,
            "created_at": datetime.now(timezone.utc),
        }

        reply = (
            f"আপনার রক্তদানের আগ্রহের বিবরণ প্রস্তুত করা হয়েছে। সহায়তার নিশ্চয়তা দিতে নিচের প্রিভিউ দেখে নিশ্চিত (Confirm) করুন।"
            if is_bn else
            f"I have prepared your response offer. Please review the action preview below and confirm to notify the requester."
        )

        return DonorCoordinationResponse(
            reply=reply,
            intent=intent,
            request_id=str(blood_req.id),
            request_summary=req_summary,
            action_preview=action_preview,
            conversation_id=conversation_id,
        )

    # -----------------------------------------------------------------------
    # INTENT: REQUEST_OUTREACH
    # -----------------------------------------------------------------------
    elif intent == DonorCoordinationIntent.REQUEST_OUTREACH:
        outreach_out = await tool_prepare_outreach_preview(
            db, PrepareOutreachPreviewInput(request_id=str(blood_req.id), max_donors=25), current_user
        )

        if not outreach_out.is_authorized:
            refusal_bn = "কেবলমাত্র আবেদনকারী অথবা প্ল্যাটফর্ম অ্যাডমিন রক্তদাতাদের জন্য নোটিফিকেশন আউটরিচ ব্রডকাস্ট প্রস্তুত ও অনুমোদন করতে পারেন।"
            refusal_en = "Only the request owner or an administrator can prepare and broadcast outreach notifications."
            return DonorCoordinationResponse(
                reply=refusal_bn if is_bn else refusal_en,
                intent=intent,
                request_id=str(blood_req.id),
                request_summary=req_summary,
                conversation_id=conversation_id,
            )

        if is_bn:
            reply = (
                f"আউটরিচ ব্রডকাস্ট প্রিভিউ প্রস্তুত করা হয়েছে। "
                f"{blood_req.district} জেলার সক্রিয় {outreach_out.eligible_donor_count} জন উপযুক্ত রক্তদাতাকে নোটিফিকেশন পাঠাতে নিচের কনফার্মেশন বাটনে ক্লিক করুন।"
            )
        else:
            reply = (
                f"Outreach broadcast preview is prepared. "
                f"To send urgent alerts to {outreach_out.eligible_donor_count} compatible donor(s) in {blood_req.district}, please review and confirm below."
            )

        return DonorCoordinationResponse(
            reply=reply,
            intent=intent,
            request_id=str(blood_req.id),
            request_summary=req_summary,
            action_preview=outreach_out.action_preview,
            conversation_id=conversation_id,
        )

    # Fallback to status
    return DonorCoordinationResponse(
        reply="I am here to coordinate blood requests and search for donors. How can I assist you?",
        intent=DonorCoordinationIntent.VIEW_REQUEST_STATUS,
        request_id=str(blood_req.id),
        request_summary=req_summary,
        conversation_id=conversation_id,
    )


# ---------------------------------------------------------------------------
# Confirmed Action Execution (Atomic Mutation with Re-validation)
# ---------------------------------------------------------------------------
async def execute_donor_coordination_confirmation(
    db: AsyncSession,
    confirm_data: Optional[DonorCoordinationConfirmRequest] = None,
    current_user: User = None,
    request_data: Optional[DonorCoordinationConfirmRequest] = None,
) -> DonorCoordinationConfirmResponse:
    """
    Executes a confirmed state-changing action (donor response creation or community outreach).
    Enforces atomic token consumption, parameter re-validation, and database transaction commit.
    """
    data = confirm_data or request_data
    if not data:
        raise ValueError("Missing confirmation request payload.")

    token = data.confirmation_token.strip()
    _prune_coordination_tokens()

    if f"COMPLETED:{token}" in _COORDINATION_TOKENS or token.startswith("COMPLETED:"):
        return DonorCoordinationConfirmResponse(
            status="ALREADY_PROCESSED",
            action_type=data.action_type,
            message="This action has already been confirmed and executed.",
        )

    token_data = _COORDINATION_TOKENS.get(token)
    if not token_data:
        raise ValueError("Invalid, expired, or previously consumed confirmation token.")

    action_type = token_data.get("action_type")
    req_id_str = token_data.get("request_id")

    req_uuid = uuid.UUID(req_id_str)
    blood_req = await get_blood_request_by_id(db, req_uuid)
    if not blood_req or not blood_req.is_active:
        raise ValueError("Target blood request is no longer active.")

    if action_type == "EXPRESS_INTEREST":
        resp_data = BloodRespondCreate(
            message=data.message or "I am willing to donate blood for this patient (coordinated via Nirapotta AI).",
            contact_phone=data.contact_phone,
        )
        response_record = await create_request_response(
            db=db,
            request=blood_req,
            donor_user_id=current_user.id,
            data=resp_data,
        )

        del _COORDINATION_TOKENS[token]
        _COORDINATION_TOKENS[f"COMPLETED:{token}"] = {"completed_at": datetime.now(timezone.utc)}

        return DonorCoordinationConfirmResponse(
            status="SUCCESS",
            action_type=action_type,
            record_id=str(response_record.id),
            message="আপনার রক্তদানের আগ্রহ সফলভাবে গ্রহণকারীর নিকট পাঠানো হয়েছে। (Response registered successfully)",
            details={
                "request_id": str(blood_req.id),
                "hospital": blood_req.hospital_name,
                "donor_status": response_record.status.value,
            },
        )

    elif action_type == "TRIGGER_OUTREACH":
        is_owner = (current_user.id == blood_req.user_id)
        is_admin = (current_user.role == UserRole.ADMIN)
        if not is_owner and not is_admin:
            raise ValueError("Unauthorized to trigger outreach for this request.")

        compatible_groups = BLOOD_COMPATIBILITY.get(blood_req.blood_group, [blood_req.blood_group])
        outreach_stmt = (
            select(BloodDonorProfile.user_id)
            .where(
                BloodDonorProfile.district.ilike(blood_req.district),
                BloodDonorProfile.availability_status == DonorAvailability.AVAILABLE,
                BloodDonorProfile.blood_group.in_(compatible_groups),
                BloodDonorProfile.user_id != blood_req.user_id,
            )
            .limit(25)
        )
        eligible_user_ids = list((await db.execute(outreach_stmt)).scalars().all())

        notif_count = 0
        for uid in eligible_user_ids:
            notif = Notification(
                user_id=uid,
                type=NotificationType.BLOOD_REQUEST_MATCH,
                title=f"জরুরি রক্ত সহায়তা প্রয়োজন ({blood_req.blood_group.value})",
                message=f"{blood_req.hospital_name} ({blood_req.district})-এ {blood_req.blood_group.value} রক্তের প্রয়োজন। রোগীর সহায়তায় এগিয়ে আসুন।",
            )
            db.add(notif)
            notif_count += 1

        if notif_count > 0:
            await db.commit()

        del _COORDINATION_TOKENS[token]
        _COORDINATION_TOKENS[f"COMPLETED:{token}"] = {"completed_at": datetime.now(timezone.utc)}

        return DonorCoordinationConfirmResponse(
            status="SUCCESS",
            action_type=action_type,
            record_id=str(blood_req.id),
            message=f"{notif_count} জন উপযুক্ত রক্তদাতার নিকট জরুরি আউটরিচ নোটিফিকেশন সফলভাবে পাঠানো হয়েছে।",
            details={
                "recipients_notified": notif_count,
                "district": blood_req.district,
                "blood_group": blood_req.blood_group.value,
            },
        )

    raise ValueError(f"Unknown action type: {action_type}")
