import re
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy import select, and_, or_, func
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
from app.models.category import Category
from app.models.report import Report, ReportStatus
from app.models.moderation import ModerationRecord, ModerationAction
from app.schemas.ai_features import (
    ChatMessage,
    IncidentIntelligenceIntent,
    ReportItemResult,
    SearchIncidentReportsInput,
    SearchIncidentReportsOutput,
    GetIncidentReportInput,
    GetIncidentReportOutput,
    GetIncidentSummaryInput,
    GetIncidentSummaryOutput,
    AnalyzeIncidentReportInput,
    AnalyzeIncidentReportOutput,
    CandidateDuplicateItem,
    FindPossibleDuplicatesInput,
    FindPossibleDuplicatesOutput,
    PrepareReportReviewInput,
    PrepareReportReviewOutput,
    IncidentIntelligenceRequest,
    IncidentIntelligenceResponse,
)
from app.services.ai_client import call_ai_json

logger = logging.getLogger("incident_intelligence")

# Category mapping from synonyms (Bengali, English, Banglish) to canonical Category slugs
CATEGORY_SYNONYMS: Dict[str, str] = {
    # Crime / Robbery / Mugging
    "crime": "crime",
    "criminal": "crime",
    "robbery": "crime",
    "mugging": "crime",
    "theft": "crime",
    "churi": "crime",
    "chintai": "crime",
    "dakati": "crime",
    "অপরাধ": "crime",
    "ছিনতাই": "crime",
    "ডাকাতি": "crime",
    "চুরি": "crime",
    # Violence / Assault
    "violence": "violence",
    "assault": "violence",
    "clash": "violence",
    "attack": "violence",
    "maramari": "violence",
    "hamla": "violence",
    "সহিংসতা": "violence",
    "মারামারি": "violence",
    "হামলা": "violence",
    # Public Safety / Hazards / Fire / Accident
    "public-safety": "public-safety",
    "public safety": "public-safety",
    "safety": "public-safety",
    "hazard": "public-safety",
    "manhole": "public-safety",
    "accident": "public-safety",
    "fire": "public-safety",
    "দুর্যোগ": "public-safety",
    "আগুন": "public-safety",
    "ম্যানহোল": "public-safety",
    "জননিরাপত্তা": "public-safety",
    "নিরাপত্তা": "public-safety",
    "দুর্ঘটনা": "public-safety",
    # Environmental
    "environmental-issue": "environmental-issue",
    "environmental": "environmental-issue",
    "pollution": "environmental-issue",
    "waste": "environmental-issue",
    "river": "environmental-issue",
    "effluent": "environmental-issue",
    "canal": "environmental-issue",
    "পরিবেশ": "environmental-issue",
    "নদী দূষণ": "environmental-issue",
    "বর্জ্য": "environmental-issue",
    # Fraud / Extortion
    "fraud": "fraud",
    "scam": "fraud",
    "phishing": "fraud",
    "extortion": "fraud",
    "cyber": "fraud",
    "mfs": "fraud",
    "protarona": "fraud",
    "chandabaji": "fraud",
    "প্রতারণা": "fraud",
    "চাঁদাবাজি": "fraud",
    "জালিয়াতি": "fraud",
    # Abuse / Harassment
    "abuse": "abuse",
    "harassment": "abuse",
    "eve-teasing": "abuse",
    "eveteasing": "abuse",
    "nirjaton": "abuse",
    "hoyrani": "abuse",
    "নির্যাতন": "abuse",
    "হয়রানি": "abuse",
    "উত্ত্যক্ত": "abuse",
    # Corruption
    "corruption": "corruption",
    "bribe": "corruption",
    "ghush": "corruption",
    "durriti": "corruption",
    "দুর্নীতি": "corruption",
    "ঘুষ": "corruption",
    # Murder
    "murder": "murder",
    "homicide": "murder",
    "khun": "murder",
    "খুন": "murder",
    "হত্যা": "murder",
    # Missing Person
    "missing-person": "missing-person",
    "missing": "missing-person",
    "nikhoj": "missing-person",
    "নিখোঁজ": "missing-person",
}


def is_bengali_text(text: str) -> bool:
    """Detects whether text contains Bengali unicode characters."""
    return bool(re.search(r"[\u0980-\u09FF]", text))


def extract_location_from_text(text: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Extracts district and specific neighborhood/area from query text.
    """
    t = text.lower()
    found_district: Optional[str] = None
    found_area: Optional[str] = None

    # Check known hospital and neighborhood areas
    for area_key, dist_name in AREA_TO_DISTRICT.items():
        if area_key in t:
            found_area = area_key.capitalize()
            found_district = dist_name
            break

    # If no area found, check all 64 districts
    if not found_district:
        for dist_key in BD_DISTRICT_COORDS.keys():
            if dist_key in t:
                found_district = dist_key.capitalize()
                break

    # Common Bengali location terms
    bengali_locations = {
        "সাভার": ("Dhaka", "Savar"),
        "মিরপুর": ("Dhaka", "Mirpur"),
        "ধানমন্ডি": ("Dhaka", "Dhanmondi"),
        "গুলশান": ("Dhaka", "Gulshan"),
        "উত্তরা": ("Dhaka", "Uttara"),
        "মতিঝিল": ("Dhaka", "Motijheel"),
        "আগ্রাবাদ": ("Chattogram", "Agrabad"),
        "জিইসি": ("Chattogram", "GEC"),
        "জিন্দাবাজার": ("Sylhet", "Zindabazar"),
        "ঢাকা": ("Dhaka", None),
        "চট্টগ্রাম": ("Chattogram", None),
        "সিলেট": ("Sylhet", None),
        "রাজশাহী": ("Rajshahi", None),
        "খুলনা": ("Khulna", None),
        "বরিশাল": ("Barishal", None),
        "রংপুর": ("Rangpur", None),
        "ময়মনসিংহ": ("Mymensingh", None),
    }

    for bn_key, (dist, area) in bengali_locations.items():
        if bn_key in text:
            found_district = dist
            if area:
                found_area = area
            break

    return found_district, found_area


def extract_category_slug(text: str) -> Optional[str]:
    """Identifies category slug from query text."""
    t = text.lower()
    for syn, slug in CATEGORY_SYNONYMS.items():
        # Match as word boundary or exact substring
        if re.search(rf"\b{re.escape(syn)}\b", t) or syn in t:
            return slug
    return None


def extract_report_uuid(text: str) -> Optional[str]:
    """Extracts a standard UUID v4 from the query if present."""
    match = re.search(r"\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b", text)
    if match:
        return match.group(0)
    return None


# ---------------------------------------------------------------------------
# Controlled Tool 1: search_incident_reports
# ---------------------------------------------------------------------------

async def tool_search_incident_reports(
    db: AsyncSession,
    input_data: SearchIncidentReportsInput,
    current_user: Optional[User],
) -> SearchIncidentReportsOutput:
    """
    Controlled tool: Searches incident reports from real database records
    with strict field-level privacy and role-based access control.
    """
    stmt = select(Report).join(Category)

    # 1. Access Control Filter:
    # Public & citizens: only APPROVED reports OR reports authored by current user.
    # Moderators & Admins: all statuses allowed.
    is_mod = current_user and current_user.role in (UserRole.ADMIN, UserRole.MODERATOR)

    if not is_mod:
        if current_user:
            stmt = stmt.where(
                or_(
                    Report.status == ReportStatus.APPROVED,
                    Report.user_id == current_user.id,
                )
            )
        else:
            stmt = stmt.where(Report.status == ReportStatus.APPROVED)
    else:
        # If moderator requested specific status, apply it
        if input_data.status:
            try:
                stat_enum = ReportStatus(input_data.status.upper())
                stmt = stmt.where(Report.status == stat_enum)
            except Exception:
                pass

    # 2. Category Filter
    if input_data.category:
        cat_slug = input_data.category.lower().strip()
        stmt = stmt.where(
            or_(
                Category.slug == cat_slug,
                Category.name.ilike(f"%{cat_slug}%"),
            )
        )

    # 3. Location Filter (District / Area)
    if input_data.area:
        stmt = stmt.where(Report.location_text.ilike(f"%{input_data.area}%"))
    elif input_data.district:
        stmt = stmt.where(Report.location_text.ilike(f"%{input_data.district}%"))

    # 4. Text Query Filter
    if input_data.query:
        q = input_data.query.strip()
        stmt = stmt.where(
            or_(
                Report.title.ilike(f"%{q}%"),
                Report.description.ilike(f"%{q}%"),
                Report.location_text.ilike(f"%{q}%"),
            )
        )

    # 5. Date Range Filter
    if input_data.start_date:
        stmt = stmt.where(Report.incident_date >= input_data.start_date)
    if input_data.end_date:
        stmt = stmt.where(Report.incident_date <= input_data.end_date)

    # 6. Verification Status Filter
    if input_data.verification_status:
        v_stat = input_data.verification_status.upper().strip()
        if v_stat == "VERIFIED":
            stmt = stmt.where(Report.status == ReportStatus.APPROVED)
        elif v_stat == "UNVERIFIED":
            stmt = stmt.where(Report.status != ReportStatus.APPROVED)

    # Order by newest incident date or created_at
    stmt = stmt.order_by(Report.created_at.desc())

    # Count total matching query before pagination
    count_stmt = select(func.count()).select_from(stmt.subquery())
    count_res = await db.execute(count_stmt)
    total_found = count_res.scalar_one_or_none() or 0

    # Apply bounded limit & offset
    limit = min(max(input_data.limit, 1), 50)
    offset = max(input_data.offset, 0)
    stmt = stmt.offset(offset).limit(limit)

    result = await db.execute(stmt)
    reports = result.scalars().all()

    report_items: List[ReportItemResult] = []
    for r in reports:
        # Determine privacy-filtered reporter name
        if r.is_anonymous:
            rep_name = "Anonymous Citizen"
        elif r.user:
            rep_name = r.user.full_name or r.user.username
        else:
            rep_name = "Citizen Reporter"

        # Extract approximate district/area from location text
        dist, area = extract_location_from_text(r.location_text)

        # Brief summary
        clean_desc = (r.description or "").strip()
        summary_text = (clean_desc[:140] + "...") if len(clean_desc) > 140 else clean_desc

        report_items.append(
            ReportItemResult(
                id=str(r.id),
                title=r.title,
                category_name=r.category.name if r.category else "Uncategorized",
                category_slug=r.category.slug if r.category else "other",
                location_text=r.location_text,
                district=dist,
                area=area,
                latitude=r.latitude,
                longitude=r.longitude,
                incident_date=r.incident_date,
                created_at=r.created_at,
                status=r.status.value,
                is_verified=(r.status == ReportStatus.APPROVED),
                is_anonymous=r.is_anonymous,
                reporter_name=rep_name,
                summary=summary_text,
                media_count=len(r.media) if r.media else 0,
            )
        )

    criteria_applied = {
        "category": input_data.category,
        "district": input_data.district,
        "area": input_data.area,
        "status": input_data.status,
        "verification_status": input_data.verification_status,
        "query": input_data.query,
        "limit": limit,
        "offset": offset,
        "is_moderator_view": is_mod,
    }

    return SearchIncidentReportsOutput(
        reports=report_items,
        total_found=total_found,
        criteria_applied=criteria_applied,
    )


# ---------------------------------------------------------------------------
# Controlled Tool 2: get_incident_report
# ---------------------------------------------------------------------------

async def tool_get_incident_report(
    db: AsyncSession,
    input_data: GetIncidentReportInput,
    current_user: Optional[User],
) -> GetIncidentReportOutput:
    """
    Controlled tool: Retrieves authorized report details with field-level privacy.
    Internal moderation notes are strictly shielded from normal users.
    """
    try:
        req_uuid = uuid.UUID(input_data.report_id)
    except Exception:
        return GetIncidentReportOutput(
            report_id=input_data.report_id,
            is_authorized=False,
            error_message="Invalid incident report identifier format.",
        )

    stmt = select(Report).where(Report.id == req_uuid)
    result = await db.execute(stmt)
    report = result.scalar_one_or_none()

    if not report:
        return GetIncidentReportOutput(
            report_id=str(req_uuid),
            is_authorized=False,
            error_message="Incident report not found in the database.",
        )

    is_mod = current_user and current_user.role in (UserRole.ADMIN, UserRole.MODERATOR)
    is_owner = current_user and (report.user_id == current_user.id)

    # If report is not approved and caller is not owner and not moderator/admin: forbidden
    if report.status != ReportStatus.APPROVED and not is_mod and not is_owner:
        return GetIncidentReportOutput(
            report_id=str(req_uuid),
            is_authorized=False,
            error_message="You are not authorized to view this report before it is verified and published.",
        )

    # Privacy filtering for reporter name
    if report.is_anonymous and not is_mod:
        rep_name = "Anonymous Citizen"
    elif report.user:
        rep_name = report.user.full_name or report.user.username
    else:
        rep_name = "Citizen Reporter"

    dist, area = extract_location_from_text(report.location_text)

    # Internal moderation notes: strictly shielded for non-moderators
    moderation_notes: Optional[str] = None
    if is_mod and report.moderation_records:
        notes_list = [
            f"[{mr.action.value} - {mr.created_at.strftime('%Y-%m-%d %H:%M')}]: {mr.internal_notes or mr.user_message or 'No notes'}"
            for mr in report.moderation_records
            if mr.internal_notes or mr.user_message
        ]
        if notes_list:
            moderation_notes = "\n".join(notes_list)

    media_urls = [m.media_url for m in report.media if hasattr(m, "media_url") and m.media_url]

    item = ReportItemResult(
        id=str(report.id),
        title=report.title,
        category_name=report.category.name if report.category else "Uncategorized",
        category_slug=report.category.slug if report.category else "other",
        location_text=report.location_text,
        district=dist,
        area=area,
        latitude=report.latitude,
        longitude=report.longitude,
        incident_date=report.incident_date,
        created_at=report.created_at,
        status=report.status.value,
        is_verified=(report.status == ReportStatus.APPROVED),
        is_anonymous=report.is_anonymous,
        reporter_name=rep_name,
        summary=report.description[:140] + ("..." if len(report.description) > 140 else ""),
        media_count=len(report.media) if report.media else 0,
    )

    return GetIncidentReportOutput(
        report_id=str(report.id),
        is_authorized=True,
        report=item,
        description=report.description,
        is_own_report=bool(is_owner),
        moderation_notes=moderation_notes,
        media_urls=media_urls,
        comments_count=len(report.comments) if report.comments else 0,
        reactions_count=len(report.reactions) if report.reactions else 0,
    )


# ---------------------------------------------------------------------------
# Controlled Tool 3: get_incident_summary
# ---------------------------------------------------------------------------

async def tool_get_incident_summary(
    db: AsyncSession,
    input_data: GetIncidentSummaryInput,
    current_user: Optional[User],
) -> GetIncidentSummaryOutput:
    """
    Controlled tool: Generates factual aggregate statistics from actual database records.
    Never hallucinates numbers or non-existent incidents.
    """
    stmt = select(Report).join(Category)

    is_mod = current_user and current_user.role in (UserRole.ADMIN, UserRole.MODERATOR)

    # Access control
    if not is_mod:
        if current_user:
            stmt = stmt.where(
                or_(
                    Report.status == ReportStatus.APPROVED,
                    Report.user_id == current_user.id,
                )
            )
        else:
            stmt = stmt.where(Report.status == ReportStatus.APPROVED)

    # Location filter
    if input_data.area:
        stmt = stmt.where(Report.location_text.ilike(f"%{input_data.area}%"))
    elif input_data.district:
        stmt = stmt.where(Report.location_text.ilike(f"%{input_data.district}%"))

    # Category filter
    if input_data.category:
        stmt = stmt.where(
            or_(
                Category.slug == input_data.category.lower(),
                Category.name.ilike(f"%{input_data.category}%"),
            )
        )

    # Date filters
    if input_data.start_date:
        stmt = stmt.where(Report.incident_date >= input_data.start_date)
    if input_data.end_date:
        stmt = stmt.where(Report.incident_date <= input_data.end_date)

    result = await db.execute(stmt)
    reports = result.scalars().all()

    total_reports = len(reports)
    by_category: Dict[str, int] = {}
    by_status: Dict[str, int] = {}
    by_district: Dict[str, int] = {}
    verified_count = 0
    unverified_count = 0

    for r in reports:
        cat_name = r.category.name if r.category else "Uncategorized"
        by_category[cat_name] = by_category.get(cat_name, 0) + 1

        stat_val = r.status.value
        by_status[stat_val] = by_status.get(stat_val, 0) + 1

        if r.status == ReportStatus.APPROVED:
            verified_count += 1
        else:
            unverified_count += 1

        dist, _ = extract_location_from_text(r.location_text)
        dist_name = dist or "Other"
        by_district[dist_name] = by_district.get(dist_name, 0) + 1

    # Date range description
    date_range_desc = None
    if input_data.start_date or input_data.end_date:
        s_str = input_data.start_date.strftime("%Y-%m-%d") if input_data.start_date else "Earliest"
        e_str = input_data.end_date.strftime("%Y-%m-%d") if input_data.end_date else "Present"
        date_range_desc = f"{s_str} to {e_str}"

    loc_str = input_data.area or input_data.district or "Bangladesh"
    if total_reports == 0:
        summary_narrative = (
            f"No matching incident reports found in the Nirapotta database for {loc_str}. "
            f"The database currently records 0 incidents matching these parameters."
        )
    else:
        top_cats = sorted(by_category.items(), key=lambda x: x[1], reverse=True)[:3]
        top_cats_str = ", ".join([f"{k} ({v})" for k, v in top_cats])
        summary_narrative = (
            f"Database summary for {loc_str}: Found {total_reports} total recorded incident report(s), "
            f"including {verified_count} verified/approved and {unverified_count} unverified or under-review. "
            f"Leading categories: {top_cats_str}."
        )

    return GetIncidentSummaryOutput(
        total_reports=total_reports,
        by_category=by_category,
        by_status=by_status,
        by_district=by_district,
        verified_count=verified_count,
        unverified_count=unverified_count,
        date_range=date_range_desc,
        summary_narrative=summary_narrative,
    )


# ---------------------------------------------------------------------------
# Controlled Tool 4: analyze_incident_report
# ---------------------------------------------------------------------------

async def tool_analyze_incident_report(
    db: AsyncSession,
    input_data: AnalyzeIncidentReportInput,
    current_user: Optional[User],
) -> AnalyzeIncidentReportOutput:
    """
    Controlled tool: Analyzes report completeness, facts, safety concerns,
    and suggested follow-ups while clearly distinguishing verified DB facts from AI interpretation.
    """
    # Fetch report via tool 2 logic
    rep_res = await tool_get_incident_report(
        db, GetIncidentReportInput(report_id=input_data.report_id), current_user
    )

    if not rep_res.is_authorized or not rep_res.report:
        return AnalyzeIncidentReportOutput(
            report_id=input_data.report_id,
            is_authorized=False,
            error_message=rep_res.error_message or "Report not accessible for analysis.",
        )

    r = rep_res.report
    desc = rep_res.description or ""

    # 1. Verified Facts (Ground Truth strictly from DB)
    verified_facts: List[str] = [
        f"Incident Category: {r.category_name} (Registered in Nirapotta schema)",
        f"Location on Record: {r.location_text}",
        f"Moderation Status: {r.status} ({'Verified and published to community feed' if r.is_verified else 'Not yet publicly approved'})",
        f"Report Creation: {r.created_at.strftime('%Y-%m-%d %H:%M UTC')}",
    ]
    if r.incident_date:
        verified_facts.append(f"Recorded Incident Timestamp: {r.incident_date.strftime('%Y-%m-%d %H:%M UTC')}")
    if r.latitude and r.longitude:
        verified_facts.append(f"Verified Geolocation: Coordinates ({r.latitude:.4f}, {r.longitude:.4f}) recorded")
    else:
        verified_facts.append("Geolocation: Approximate text address only (No exact GPS coordinates)")

    verified_facts.append(f"Evidence Attached: {r.media_count} media file(s)")

    # 2. Missing or Incomplete Information
    missing_info: List[str] = []
    if not (r.latitude and r.longitude):
        missing_info.append("Precise GPS Coordinates: Exact pinpoint coordinates missing; reliant on civic street text.")
    if r.media_count == 0:
        missing_info.append("Physical Evidence: Zero photographic or video evidence files attached.")
    if len(desc.split()) < 15:
        missing_info.append("Narrative Detail: Incident description is brief and lacks sequential chronology or suspect descriptions.")
    if r.is_anonymous:
        missing_info.append("Reporter Attribution: Submitted anonymously; community reputation cannot be factored into verification.")

    # 3. Safety Concerns
    cat_slug = r.category_slug.lower()
    safety_concerns: List[str] = []
    if cat_slug in ("crime", "violence", "murder"):
        safety_concerns.append("Physical Harm Risk: Violent or criminal threat poses immediate safety danger to nearby pedestrians and commuters.")
        safety_concerns.append("Recurrence Risk: Unchecked criminal activity in transit corridors often leads to repeated repeat incidents.")
    elif cat_slug == "public-safety":
        safety_concerns.append("Infrastructure Hazard: Open manholes, electrical failures, or unbarricaded work zones create imminent accident risk.")
    elif cat_slug == "environmental-issue":
        safety_concerns.append("Public Health Hazard: Toxic effluent or hazardous waste discharge endangers municipal water tables and resident health.")
    elif cat_slug == "fraud":
        safety_concerns.append("Financial Security Risk: Active phishing or extortion campaigns target vulnerable local merchants and citizens.")
    else:
        safety_concerns.append("Community Safety Impact: Civic issue requires routine monitoring and field resolution.")

    # 4. Suggested Follow-ups
    suggested_follow_ups: List[str] = [
        "Cross-reference nearby police station GD logs or emergency 999 records.",
        "Check for potential duplicate reports filed within the same time window and vicinity.",
    ]
    if r.media_count == 0:
        suggested_follow_ups.append("Request reporter or local witnesses to upload supplementary photographic evidence.")
    if not (r.latitude and r.longitude):
        suggested_follow_ups.append("Dispatch field verification or request landmark clarification to pin exact coordinates.")

    # 5. Labeled AI Interpretation
    severity_label = "High" if cat_slug in ("crime", "violence", "murder", "public-safety") else "Moderate"
    ai_interpretation = (
        f"[AI Interpretation - Advisory Only]: Based on the reported category ({r.category_name}) and location ({r.location_text}), "
        f"this incident represents a {severity_label}-priority civic concern. "
        f"Completeness is evaluated at {'satisfactory' if len(missing_info) <= 1 else 'partial'} with "
        f"{len(verified_facts)} verified ground truth attributes and {len(missing_info)} information gaps."
    )

    # Confidence score (0.0 to 1.0)
    base_conf = 0.5
    if r.latitude and r.longitude:
        base_conf += 0.15
    if r.media_count > 0:
        base_conf += 0.15
    if r.is_verified:
        base_conf += 0.10
    if len(desc.split()) >= 15:
        base_conf += 0.10
    confidence_score = min(round(base_conf, 2), 1.0)

    return AnalyzeIncidentReportOutput(
        report_id=str(r.id),
        is_authorized=True,
        title=r.title,
        category=r.category_name,
        location_text=r.location_text,
        verified_facts=verified_facts,
        missing_or_incomplete_info=missing_info,
        safety_concerns=safety_concerns,
        suggested_follow_ups=suggested_follow_ups,
        ai_interpretation=ai_interpretation,
        confidence_score=confidence_score,
    )


# ---------------------------------------------------------------------------
# Controlled Tool 5: find_possible_duplicate_reports
# ---------------------------------------------------------------------------

async def tool_find_possible_duplicate_reports(
    db: AsyncSession,
    input_data: FindPossibleDuplicatesInput,
    current_user: Optional[User],
) -> FindPossibleDuplicatesOutput:
    """
    Controlled tool: Discovers potential duplicate incident reports in the database
    using multi-factor matching: category, geographic proximity, time window, and text similarity.
    Advisory and read-only: Never modifies, deletes, or merges database records.
    """
    target_report: Optional[Report] = None
    target_id_str: Optional[str] = None

    if input_data.report_id:
        try:
            t_uuid = uuid.UUID(input_data.report_id)
            stmt = select(Report).where(Report.id == t_uuid)
            res = await db.execute(stmt)
            target_report = res.scalar_one_or_none()
            if target_report:
                target_id_str = str(target_report.id)
        except Exception:
            pass

    # Query candidate reports from DB
    stmt = select(Report).join(Category)

    is_mod = current_user and current_user.role in (UserRole.ADMIN, UserRole.MODERATOR)
    if not is_mod:
        # Citizens only compare with approved reports or own reports
        if current_user:
            stmt = stmt.where(
                or_(
                    Report.status == ReportStatus.APPROVED,
                    Report.user_id == current_user.id,
                )
            )
        else:
            stmt = stmt.where(Report.status == ReportStatus.APPROVED)

    # Exclude target report itself
    if target_report:
        stmt = stmt.where(Report.id != target_report.id)

    # If target report exists, narrow query to same category or nearby location
    if target_report:
        stmt = stmt.where(
            or_(
                Report.category_id == target_report.category_id,
                Report.location_text.ilike(f"%{target_report.location_text.split(',')[0].strip()}%"),
            )
        )
    else:
        # Filter by input params
        if input_data.category:
            stmt = stmt.where(
                or_(
                    Category.slug == input_data.category.lower(),
                    Category.name.ilike(f"%{input_data.category}%"),
                )
            )
        if input_data.area or input_data.district:
            loc = input_data.area or input_data.district
            stmt = stmt.where(Report.location_text.ilike(f"%{loc}%"))

    result = await db.execute(stmt.limit(50))
    candidates = result.scalars().all()

    duplicate_items: List[CandidateDuplicateItem] = []

    target_title = (target_report.title if target_report else (input_data.query or "")).lower()
    target_desc = (target_report.description if target_report else "").lower()
    target_loc = (
        target_report.location_text
        if target_report
        else (input_data.location_text or input_data.area or input_data.district or "")
    ).lower()
    target_time = (
        target_report.incident_date or target_report.created_at
        if target_report
        else datetime.now(timezone.utc)
    )

    # Tokenize target text for keyword overlap
    target_words = set(re.findall(r"\b\w{4,}\b", f"{target_title} {target_desc} {target_loc}"))

    for c in candidates:
        score = 0.0
        reasons: List[str] = []

        # 1. Category Match (+0.30)
        if target_report and c.category_id == target_report.category_id:
            score += 0.30
            reasons.append(f"Matching category: {c.category.name if c.category else 'Same'}")
        elif input_data.category and c.category and c.category.slug == input_data.category.lower():
            score += 0.30
            reasons.append(f"Matching category filter: {c.category.name}")

        # 2. Location / Proximity Match (+0.30)
        c_loc = (c.location_text or "").lower()
        dist_km: Optional[float] = None
        if target_report and target_report.latitude and target_report.longitude and c.latitude and c.longitude:
            dist_km = calculate_haversine_distance(
                target_report.latitude, target_report.longitude, c.latitude, c.longitude
            )
            if dist_km <= 2.0:
                score += 0.30
                reasons.append(f"Geographic proximity: within {dist_km:.2f} km")
            elif dist_km <= 5.0:
                score += 0.20
                reasons.append(f"Geographic proximity: within {dist_km:.2f} km")
        elif any(part in c_loc for part in target_loc.split(",") if len(part.strip()) > 3):
            score += 0.25
            reasons.append(f"Shared area or neighborhood: '{c.location_text}'")

        # 3. Time Window Match (+0.20)
        c_time = c.incident_date or c.created_at
        if c_time and target_time:
            # Handle naive vs aware datetime comparison
            t1 = target_time.replace(tzinfo=timezone.utc) if target_time.tzinfo is None else target_time
            t2 = c_time.replace(tzinfo=timezone.utc) if c_time.tzinfo is None else c_time
            time_diff_hours = abs((t1 - t2).total_seconds()) / 3600.0

            if time_diff_hours <= 24:
                score += 0.20
                reasons.append(f"Time proximity: Occurred within {int(time_diff_hours)} hours of each other")
            elif time_diff_hours <= 72:
                score += 0.15
                reasons.append(f"Time proximity: Occurred within {int(time_diff_hours)} hours")

        # 4. Text Keyword Overlap (+0.20)
        c_words = set(re.findall(r"\b\w{4,}\b", f"{c.title} {c.description} {c.location_text}".lower()))
        common_words = target_words.intersection(c_words)
        # Exclude generic words
        common_filtered = [w for w in common_words if w not in ("demo", "report", "incident", "near", "road")]
        if len(common_filtered) >= 3:
            score += 0.20
            reasons.append(f"Significant keyword overlap ({len(common_filtered)} terms: {', '.join(common_filtered[:3])})")
        elif len(common_filtered) >= 1:
            score += 0.10
            reasons.append(f"Overlapping terminology: {', '.join(common_filtered[:2])}")

        final_score = min(round(score, 2), 1.0)
        if final_score >= 0.40:
            duplicate_items.append(
                CandidateDuplicateItem(
                    report_id=str(c.id),
                    title=c.title,
                    category_name=c.category.name if c.category else "Uncategorized",
                    location_text=c.location_text,
                    incident_date=c.incident_date,
                    status=c.status.value,
                    similarity_score=final_score,
                    similarity_reasons=reasons,
                )
            )

    # Sort candidates by similarity score descending
    duplicate_items.sort(key=lambda x: x.similarity_score, reverse=True)
    limit = min(max(input_data.limit, 1), 10)
    top_candidates = duplicate_items[:limit]

    return FindPossibleDuplicatesOutput(
        target_report_id=target_id_str,
        candidate_duplicates=top_candidates,
        total_candidates=len(duplicate_items),
        safe_notice="Candidate duplicates are advisory only. No records have been modified or merged.",
    )


# ---------------------------------------------------------------------------
# Controlled Tool 6: prepare_report_review
# ---------------------------------------------------------------------------

async def tool_prepare_report_review(
    db: AsyncSession,
    input_data: PrepareReportReviewInput,
    current_user: Optional[User],
) -> PrepareReportReviewOutput:
    """
    Controlled tool: Moderation review preparation strictly restricted to authorized
    moderators and administrators. Provides decision support preview without mutating the database.
    """
    is_mod = current_user and current_user.role in (UserRole.ADMIN, UserRole.MODERATOR)
    if not is_mod:
        return PrepareReportReviewOutput(
            report_id=input_data.report_id,
            is_authorized=False,
            error_message="Moderation review preparation is strictly restricted to authorized safety moderators and administrators.",
        )

    try:
        req_uuid = uuid.UUID(input_data.report_id)
    except Exception:
        return PrepareReportReviewOutput(
            report_id=input_data.report_id,
            is_authorized=False,
            error_message="Invalid report identifier format.",
        )

    stmt = select(Report).where(Report.id == req_uuid)
    result = await db.execute(stmt)
    report = result.scalar_one_or_none()

    if not report:
        return PrepareReportReviewOutput(
            report_id=str(req_uuid),
            is_authorized=False,
            error_message="Report not found in the database.",
        )

    cat_slug = report.category.slug.lower() if report.category else "other"
    desc = report.description or ""

    # Build 4-point moderation verification checklist
    checklist = [
        {
            "criterion": "Location Specificity",
            "passed": bool(len(report.location_text or "") >= 6),
            "detail": f"Location: '{report.location_text}' with {'GPS attached' if report.latitude else 'text-only location'}",
        },
        {
            "criterion": "Description Adequacy",
            "passed": bool(len(desc.split()) >= 10),
            "detail": f"Description contains {len(desc.split())} words.",
        },
        {
            "criterion": "Timeline Credibility",
            "passed": bool(
                report.incident_date is None
                or report.incident_date <= datetime.now(timezone.utc) + timedelta(minutes=5)
            ),
            "detail": "Incident timestamp is historical/credible.",
        },
        {
            "criterion": "Evidence Completeness",
            "passed": bool(len(report.media) > 0 if report.media else False),
            "detail": f"{len(report.media) if report.media else 0} media file(s) attached.",
        },
    ]

    passed_count = sum(1 for c in checklist if c["passed"])

    # Determine suggested priority
    if cat_slug in ("murder", "violence", "crime"):
        suggested_priority = "URGENT" if "robbery" in report.title.lower() or "knife" in desc.lower() else "HIGH"
    elif cat_slug in ("public-safety", "environmental-issue"):
        suggested_priority = "HIGH"
    else:
        suggested_priority = "NORMAL"

    # Determine suggested action
    if passed_count >= 3 and report.status in (ReportStatus.SUBMITTED, ReportStatus.UNDER_REVIEW):
        suggested_action = "APPROVE"
        ai_reasoning = (
            f"Report satisfies {passed_count}/4 verification criteria with high location clarity and credible timeline. "
            f"Recommended to approve for community safety awareness."
        )
        preview_user_msg = "Your report has been verified by safety moderators and published to the community feed."
        preview_internal = f"Automated AI Review: Satisfied {passed_count}/4 criteria. Priority assessed as {suggested_priority}."
    elif passed_count < 2:
        suggested_action = "REQUEST_MORE_INFO"
        ai_reasoning = (
            f"Report only satisfies {passed_count}/4 criteria. Location or descriptive detail is insufficient for public verification."
        )
        preview_user_msg = "Please provide additional details or landmark clarification to help verify your report."
        preview_internal = "Insufficient verification evidence; requested supplementary details from reporter."
    else:
        suggested_action = "REQUEST_MORE_INFO" if not report.media else "APPROVE"
        ai_reasoning = "Borderline completeness; moderator manual discretion recommended."
        preview_user_msg = "Report is being processed by the regional safety desk."
        preview_internal = "Discretionary review required before public feed publication."

    review_preview = {
        "report_id": str(report.id),
        "title": report.title,
        "current_status": report.status.value,
        "suggested_action": suggested_action,
        "suggested_priority": suggested_priority,
        "preview_user_message": preview_user_msg,
        "preview_internal_notes": preview_internal,
        "action_requires_explicit_confirmation": True,
    }

    return PrepareReportReviewOutput(
        report_id=str(report.id),
        is_authorized=True,
        current_status=report.status.value,
        suggested_priority=suggested_priority,
        suggested_action=suggested_action,
        ai_reasoning=ai_reasoning,
        checklist=checklist,
        review_preview=review_preview,
    )


# ---------------------------------------------------------------------------
# Conversational Orchestration & Intent Router
# ---------------------------------------------------------------------------

async def process_incident_intelligence_chat(
    db: AsyncSession,
    request_data: IncidentIntelligenceRequest,
    current_user: Optional[User],
) -> IncidentIntelligenceResponse:
    """
    Main entry point for Phase C Incident Intelligence Agent:
    - Parses user intent and entities across Bangla, English, and Banglish.
    - Dispatches to controlled database tools with role-based access control.
    - Distinguishes verified database facts from AI interpretation.
    - Triggers clarification if query is ambiguous.
    """
    message = request_data.message.strip()
    conversation_id = request_data.conversation_id or str(uuid.uuid4())
    is_bn = is_bengali_text(message) or request_data.lang.lower() == "bn"
    is_mod = current_user and current_user.role in (UserRole.ADMIN, UserRole.MODERATOR)

    # 1. Entity and parameter extraction
    extracted_district, extracted_area = extract_location_from_text(message)
    extracted_category = extract_category_slug(message)
    extracted_uuid = extract_report_uuid(message) or request_data.report_id

    # 2. Intent Classification via heuristics + LLM assistance
    intent = classify_incident_intent(message, extracted_uuid, is_mod)

    # 3. Check for overly ambiguous queries requiring clarification
    words = message.lower().split()
    is_too_vague = (
        len(words) <= 3
        and not extracted_uuid
        and not extracted_district
        and not extracted_area
        and not extracted_category
        and not any(k in message.lower() for k in ("summary", "সব", "পরিসংখ্যান", "duplicate", "ডুপ্লিকেট"))
    )

    if is_too_vague:
        intent = IncidentIntelligenceIntent.CLARIFY_QUERY

    # -----------------------------------------------------------------------
    # INTENT: CLARIFY_QUERY
    # -----------------------------------------------------------------------
    if intent == IncidentIntelligenceIntent.CLARIFY_QUERY:
        if is_bn:
            clarify_reply = (
                "আপনি কোন এলাকা বা কোন ধরণের রিপোর্ট জানতে চাচ্ছেন তা নির্দিষ্ট করুন। "
                "উদাহরণস্বরূপ:\n"
                "- 'সাভারে অপরাধের রিপোর্টগুলো দেখাও'\n"
                "- 'মিরপুরের জননিরাপত্তা পরিস্থিতি কেমন?'\n"
                "- 'ধানমন্ডির রিপোর্টগুলোর সারসংক্ষেপ দাও'\n"
                "- 'ডুপ্লিকেট রিপোর্ট চেক করো'"
            )
            follow_up = "আপনি কি নির্দিষ্ট জেলা (যেমন ঢাকা, চট্টগ্রাম) অথবা রিপোর্ট ক্যাটাগরি (যেমন অপরাধ, জননিরাপত্তা) নির্বাচন করতে চান?"
        else:
            clarify_reply = (
                "To help you find accurate incident records, please specify an area or category. "
                "For example:\n"
                "- 'Show crime reports in Savar'\n"
                "- 'Summarize public safety incidents in Mirpur'\n"
                "- 'Find possible duplicate reports in Dhaka'\n"
                "- 'Analyze report #[UUID]'"
            )
            follow_up = "Would you like to filter by a specific district (e.g. Dhaka, Chattogram) or incident category?"

        return IncidentIntelligenceResponse(
            reply=clarify_reply,
            intent=IncidentIntelligenceIntent.CLARIFY_QUERY,
            report_id=extracted_uuid,
            follow_up_question=follow_up,
            is_clarification_needed=True,
            conversation_id=conversation_id,
        )

    # -----------------------------------------------------------------------
    # INTENT: GET_INCIDENT_REPORT
    # -----------------------------------------------------------------------
    if intent == IncidentIntelligenceIntent.GET_INCIDENT_REPORT and extracted_uuid:
        report_out = await tool_get_incident_report(
            db, GetIncidentReportInput(report_id=extracted_uuid), current_user
        )

        if not report_out.is_authorized:
            refusal_bn = f"রিপোর্ট অ্যাক্সেস সীমাবদ্ধ: {report_out.error_message or 'অনুমোদন নেই।'}"
            refusal_en = f"Access Restricted: {report_out.error_message or 'You do not have permission to view this report.'}"
            return IncidentIntelligenceResponse(
                reply=refusal_bn if is_bn else refusal_en,
                intent=intent,
                report_id=extracted_uuid,
                tool_executed="get_incident_report",
                report_details=report_out,
                conversation_id=conversation_id,
            )

        r = report_out.report
        if is_bn:
            reply = (
                f"রিপোর্টের বিস্তারিত তথ্য (আইডি: {r.id[:8]}...):\n"
                f"- শিরোনাম: {r.title}\n"
                f"- ক্যাটাগরি: {r.category_name}\n"
                f"- অবস্থান: {r.location_text}\n"
                f"- স্ট্যাটাস: {r.status} ({'যাচাইকৃত' if r.is_verified else 'পর্যালোচনাধীন'})\n"
                f"- জমাকারী: {r.reporter_name}\n"
                f"- বিবরণ: {report_out.description}"
            )
        else:
            reply = (
                f"Incident Report Details (ID: {r.id[:8]}...):\n"
                f"- Title: {r.title}\n"
                f"- Category: {r.category_name}\n"
                f"- Location: {r.location_text}\n"
                f"- Status: {r.status} ({'Verified & Published' if r.is_verified else 'Under Review'})\n"
                f"- Reported By: {r.reporter_name}\n"
                f"- Description: {report_out.description}"
            )

        return IncidentIntelligenceResponse(
            reply=reply,
            intent=intent,
            report_id=extracted_uuid,
            tool_executed="get_incident_report",
            report_details=report_out,
            conversation_id=conversation_id,
        )

    # -----------------------------------------------------------------------
    # INTENT: ANALYZE_INCIDENT
    # -----------------------------------------------------------------------
    if intent == IncidentIntelligenceIntent.ANALYZE_INCIDENT and extracted_uuid:
        analysis_out = await tool_analyze_incident_report(
            db, AnalyzeIncidentReportInput(report_id=extracted_uuid), current_user
        )

        if not analysis_out.is_authorized:
            return IncidentIntelligenceResponse(
                reply=analysis_out.error_message or "Unable to analyze report due to authorization limits.",
                intent=intent,
                report_id=extracted_uuid,
                tool_executed="analyze_incident_report",
                analysis=analysis_out,
                conversation_id=conversation_id,
            )

        if is_bn:
            facts_str = "\n".join([f"  • {f}" for f in analysis_out.verified_facts])
            missing_str = "\n".join([f"  • {m}" for m in analysis_out.missing_or_incomplete_info]) if analysis_out.missing_or_incomplete_info else "  • কোনো উল্লেখযোগ্য ঘাটতি নেই"
            reply = (
                f"রিপোর্ট বিশ্লেষণ ({analysis_out.title}):\n\n"
                f"১. ডাটাবেস সত্যতা (Verified Facts):\n{facts_str}\n\n"
                f"২. অনুপস্থিত তথ্য (Gaps):\n{missing_str}\n\n"
                f"৩. এআই মূল্যায়ন (AI Interpretation):\n{analysis_out.ai_interpretation}\n\n"
                f"আত্মবিশ্বাস স্কোর: {int(analysis_out.confidence_score * 100)}%"
            )
        else:
            facts_str = "\n".join([f"  • {f}" for f in analysis_out.verified_facts])
            missing_str = "\n".join([f"  • {m}" for m in analysis_out.missing_or_incomplete_info]) if analysis_out.missing_or_incomplete_info else "  • None identified"
            reply = (
                f"Report Analysis ({analysis_out.title}):\n\n"
                f"1. Verified Facts (Ground Truth):\n{facts_str}\n\n"
                f"2. Missing / Incomplete Details:\n{missing_str}\n\n"
                f"3. AI Interpretation (Advisory):\n{analysis_out.ai_interpretation}\n\n"
                f"Confidence Score: {int(analysis_out.confidence_score * 100)}%"
            )

        return IncidentIntelligenceResponse(
            reply=reply,
            intent=intent,
            report_id=extracted_uuid,
            tool_executed="analyze_incident_report",
            analysis=analysis_out,
            conversation_id=conversation_id,
        )

    # -----------------------------------------------------------------------
    # INTENT: FIND_DUPLICATES
    # -----------------------------------------------------------------------
    if intent == IncidentIntelligenceIntent.FIND_DUPLICATES:
        dup_out = await tool_find_possible_duplicate_reports(
            db,
            FindPossibleDuplicatesInput(
                report_id=extracted_uuid,
                category=extracted_category,
                district=extracted_district,
                area=extracted_area,
                query=message if not extracted_uuid else None,
            ),
            current_user,
        )

        if dup_out.total_candidates == 0:
            if is_bn:
                reply = "ডাটাবেসে কোনো সম্ভাব্য ডুপ্লিকেট বা সদৃশ রিপোর্ট পাওয়া যায়নি।"
            else:
                reply = "No potential duplicate or overlapping incident reports found in the database."
        else:
            items_str = "\n".join(
                [
                    f"- [{c.status}] {c.title} ({c.location_text}) — সাদৃশ্য: {int(c.similarity_score * 100)}%\n  কারণ: {', '.join(c.similarity_reasons)}"
                    for c in dup_out.candidate_duplicates
                ]
            )
            if is_bn:
                reply = (
                    f"সম্ভাব্য ডুপ্লিকেট রিপোর্ট পাওয়া গেছে (মোট: {dup_out.total_candidates} টি):\n\n"
                    f"{items_str}\n\n"
                    f"সতর্কতা: এটি শুধুমাত্র পরামর্শমূলক। ডাটাবেস থেকে কোনো রিপোর্ট পরিবর্তন বা মুছে ফেলা হয়নি।"
                )
            else:
                reply = (
                    f"Found {dup_out.total_candidates} potential candidate duplicate report(s):\n\n"
                    f"{items_str}\n\n"
                    f"Notice: Duplicate matching is advisory only. No records have been modified or merged."
                )

        return IncidentIntelligenceResponse(
            reply=reply,
            intent=intent,
            report_id=extracted_uuid,
            tool_executed="find_possible_duplicate_reports",
            duplicate_candidates=dup_out,
            conversation_id=conversation_id,
        )

    # -----------------------------------------------------------------------
    # INTENT: PREPARE_REVIEW
    # -----------------------------------------------------------------------
    if intent == IncidentIntelligenceIntent.PREPARE_REVIEW:
        if not extracted_uuid:
            # If no UUID provided, prompt user
            msg_bn = "মডারেশন রিভিউ তৈরি করতে অনুগ্রহ করে রিপোর্টের আইডি উল্লেখ করুন।"
            msg_en = "Please provide the report ID to prepare a moderation review preview."
            return IncidentIntelligenceResponse(
                reply=msg_bn if is_bn else msg_en,
                intent=intent,
                follow_up_question=msg_bn if is_bn else msg_en,
                is_clarification_needed=True,
                conversation_id=conversation_id,
            )

        review_out = await tool_prepare_report_review(
            db, PrepareReportReviewInput(report_id=extracted_uuid), current_user
        )

        if not review_out.is_authorized:
            return IncidentIntelligenceResponse(
                reply=review_out.error_message or "Moderation review preparation is restricted to moderators.",
                intent=intent,
                report_id=extracted_uuid,
                tool_executed="prepare_report_review",
                review_preview=review_out,
                conversation_id=conversation_id,
            )

        if is_bn:
            chk_str = "\n".join([f"  [{'✓' if c['passed'] else '✗'}] {c['criterion']}: {c['detail']}" for c in review_out.checklist])
            reply = (
                f"মডারেশন রিভিউ প্রিভিউ (রিপোর্ট: {extracted_uuid[:8]}...):\n\n"
                f"- প্রস্তাবিত সিদ্ধান্ত: {review_out.suggested_action}\n"
                f"- অগ্রাধিকার মাত্রা: {review_out.suggested_priority}\n"
                f"- কারণ: {review_out.ai_reasoning}\n\n"
                f"যাচাইকরণ চেকলিস্ট:\n{chk_str}\n\n"
                f"বিজ্ঞপ্তি: চূড়ান্ত সিদ্ধান্ত গ্রহণের জন্য অনুমোদিত মডারেটরের অনুমোদন আবশ্যক।"
            )
        else:
            chk_str = "\n".join([f"  [{'✓' if c['passed'] else '✗'}] {c['criterion']}: {c['detail']}" for c in review_out.checklist])
            reply = (
                f"Moderation Review Preview (Report: {extracted_uuid[:8]}...):\n\n"
                f"- Suggested Action: {review_out.suggested_action}\n"
                f"- Priority Level: {review_out.suggested_priority}\n"
                f"- AI Rationale: {review_out.ai_reasoning}\n\n"
                f"Verification Checklist:\n{chk_str}\n\n"
                f"Notice: Moderation preview is advisory. Final execution requires manual moderator action."
            )

        return IncidentIntelligenceResponse(
            reply=reply,
            intent=intent,
            report_id=extracted_uuid,
            tool_executed="prepare_report_review",
            review_preview=review_out,
            conversation_id=conversation_id,
        )

    # -----------------------------------------------------------------------
    # INTENT: GET_INCIDENT_SUMMARY
    # -----------------------------------------------------------------------
    if intent == IncidentIntelligenceIntent.GET_INCIDENT_SUMMARY:
        summary_out = await tool_get_incident_summary(
            db,
            GetIncidentSummaryInput(
                district=extracted_district,
                area=extracted_area,
                category=extracted_category,
            ),
            current_user,
        )

        return IncidentIntelligenceResponse(
            reply=summary_out.summary_narrative,
            intent=intent,
            tool_executed="get_incident_summary",
            summary=summary_out,
            conversation_id=conversation_id,
        )

    # -----------------------------------------------------------------------
    # DEFAULT / INTENT: SEARCH_INCIDENTS
    # -----------------------------------------------------------------------
    search_out = await tool_search_incident_reports(
        db,
        SearchIncidentReportsInput(
            category=extracted_category,
            district=extracted_district,
            area=extracted_area,
            query=message if not (extracted_district or extracted_area or extracted_category) else None,
            limit=10,
        ),
        current_user,
    )

    loc_label = extracted_area or extracted_district or "specified criteria"
    if search_out.total_found == 0:
        if is_bn:
            reply = (
                f"ডাটাবেসে '{loc_label}' সম্পর্কিত কোনো রিপোর্ট পাওয়া যায়নি। "
                f"নিরাপত্তা ডাটাবেসে এই অনুসন্ধানের জন্য বর্তমানে ০ টি রেকর্ড রয়েছে।"
            )
        else:
            reply = (
                f"No incident reports found matching {loc_label} in the database. "
                f"The database records 0 incidents matching these parameters."
            )
    else:
        items_str = "\n".join(
            [
                f"- [{r.category_name}] {r.title} ({r.location_text}) — স্ট্যাটাস: {r.status}"
                if is_bn
                else f"- [{r.category_name}] {r.title} ({r.location_text}) — Status: {r.status}"
                for r in search_out.reports[:5]
            ]
        )
        if is_bn:
            reply = (
                f"ডাটাবেস অনুসন্ধানে মোট {search_out.total_found} টি রিপোর্ট পাওয়া গেছে:\n\n"
                f"{items_str}\n\n"
                f"যেকোনো রিপোর্টের বিশদ তথ্য বা এআই বিশ্লেষণ দেখতে রিপোর্ট নির্বাচন করুন।"
            )
        else:
            reply = (
                f"Found {search_out.total_found} report(s) in the database:\n\n"
                f"{items_str}\n\n"
                f"You can ask to analyze any specific report or summarize regional statistics."
            )

    return IncidentIntelligenceResponse(
        reply=reply,
        intent=IncidentIntelligenceIntent.SEARCH_INCIDENTS,
        tool_executed="search_incident_reports",
        search_results=search_out,
        conversation_id=conversation_id,
    )


# ---------------------------------------------------------------------------
# Intent Classification Helper
# ---------------------------------------------------------------------------

def classify_incident_intent(
    message: str,
    extracted_uuid: Optional[str],
    is_mod: bool,
) -> IncidentIntelligenceIntent:
    """
    Robust intent classifier across Bengali, English, and Banglish.
    """
    m = message.lower()

    # Moderation review
    if is_mod and any(k in m for k in ("review", "মডারেশন", "রিভিউ", "approve", "অনুমোদন")):
        return IncidentIntelligenceIntent.PREPARE_REVIEW

    # Duplicate search
    if any(k in m for k in ("duplicate", "ডুপ্লিকেট", "একই রকম", "অনুরূপ", "matching report", "repeat")):
        return IncidentIntelligenceIntent.FIND_DUPLICATES

    # Analysis
    if any(k in m for k in ("analyze", "বিশ্লেষণ", "analysis", "fact check", "গভীরভাবে", "বিকাশ")):
        return IncidentIntelligenceIntent.ANALYZE_INCIDENT

    # Summary
    if any(k in m for k in ("summary", "summarize", "পরিসংখ্যান", "সারসংক্ষেপ", "পরিস্থিতি", "কতগুলো রিপোর্ট", "koyta report", "overview")):
        return IncidentIntelligenceIntent.GET_INCIDENT_SUMMARY

    # Report details by UUID
    if extracted_uuid and any(k in m for k in ("details", "বিবরণ", "dekhao", "show report", "view report", "report details")):
        return IncidentIntelligenceIntent.GET_INCIDENT_REPORT

    # Search default
    return IncidentIntelligenceIntent.SEARCH_INCIDENTS
