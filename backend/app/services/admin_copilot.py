import re
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy import select, and_, or_, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.models.user import User, UserRole
from app.models.category import Category
from app.models.report import Report, ReportStatus
from app.models.moderation import ModerationRecord, ModerationAction
from app.models.blood import (
    BloodRequest,
    BloodRequestStatus,
    BloodUrgency,
    BloodGroup,
    BloodDonorProfile,
    BloodRequestResponse,
)
from app.models.flag import ContentFlag, FlagStatus
from app.models.missing_person import MissingPersonAlert, AlertStatus
from app.models.notification import NotificationType
from app.models.incident_cluster import IncidentClusterMember
from app.schemas.ai_features import (
    ChatMessage,
    ReportItemResult,
    AdminCopilotIntent,
    SearchModerationReportsInput,
    SearchModerationReportsOutput,
    GetModerationReportInput,
    GetModerationReportOutput,
    GetModerationSummaryInput,
    GetModerationSummaryOutput,
    SearchBloodRequestsAdminInput,
    AdminBloodRequestItem,
    SearchBloodRequestsAdminOutput,
    PlatformActivitySummaryOutput,
    RecentModerationActivityOutput,
    OperationalAttentionItem,
    OperationalAttentionOutput,
    ModerationActionPreview,
    AdminCopilotRequest,
    AdminCopilotResponse,
    AdminCopilotConfirmRequest,
    AdminCopilotConfirmResponse,
    PrepareReportReviewInput,
    PrepareReportReviewOutput,
)
from app.services.notification import notify_report_owner
from app.services.reputation import (
    award_impact_points,
    adjust_trust_score,
    increment_contribution_count,
)
from app.services.incident_intelligence import (
    extract_location_from_text,
    extract_category_slug,
    extract_report_uuid,
    is_bengali_text,
    tool_prepare_report_review,
)

logger = logging.getLogger("admin_copilot")

# In-memory single-use confirmation token store
_ADMIN_COPILOT_TOKENS: Dict[str, Dict[str, Any]] = {}


def _prune_admin_copilot_tokens() -> None:
    """Removes expired active tokens and completed tokens older than 24h, keeping dictionary bounded."""
    now = datetime.now(timezone.utc)
    cutoff_completed = now - timedelta(hours=24)
    expired = []
    for k, v in _ADMIN_COPILOT_TOKENS.items():
        if k.startswith("COMPLETED:"):
            if v.get("completed_at") and v["completed_at"] < cutoff_completed:
                expired.append(k)
        elif v.get("expires_at") and v["expires_at"] < now:
            expired.append(k)
    for k in expired:
        _ADMIN_COPILOT_TOKENS.pop(k, None)
    if len(_ADMIN_COPILOT_TOKENS) > 5000:
        keys_to_drop = list(_ADMIN_COPILOT_TOKENS.keys())[: len(_ADMIN_COPILOT_TOKENS) - 5000]
        for k in keys_to_drop:
            _ADMIN_COPILOT_TOKENS.pop(k, None)


def generate_action_preview(
    action_type: str,
    target_record_id: str,
    target_title: str,
    current_status: str,
    proposed_status: str,
    reason: str,
    details: Dict[str, Any],
    user_id: uuid.UUID,
) -> ModerationActionPreview:
    """Creates an action preview with an expiring single-use confirmation token."""
    _prune_admin_copilot_tokens()
    now = datetime.now(timezone.utc)
    token = f"adm-token-{uuid.uuid4().hex}"
    expires_at = now + timedelta(minutes=30)

    _ADMIN_COPILOT_TOKENS[token] = {
        "action_type": action_type,
        "target_record_id": target_record_id,
        "target_title": target_title,
        "current_status": current_status,
        "proposed_status": proposed_status,
        "reason": reason,
        "details": details,
        "user_id": str(user_id),
        "created_at": now,
        "expires_at": expires_at,
    }

    return ModerationActionPreview(
        action_type=action_type,
        target_record_id=target_record_id,
        target_title=target_title,
        current_status=current_status,
        proposed_status=proposed_status,
        reason=reason,
        details=details,
        confirmation_token=token,
        requires_confirmation=True,
        expires_at=expires_at,
    )


# ---------------------------------------------------------------------------
# Controlled Tool 1: search_moderation_reports
# ---------------------------------------------------------------------------

async def tool_search_moderation_reports(
    db: AsyncSession,
    input_data: SearchModerationReportsInput,
    current_user: User,
) -> SearchModerationReportsOutput:
    """
    Controlled tool: Searches reports for authorized moderators and administrators.
    Allows filtering by all statuses, categories, locations, and priorities.
    """
    if current_user.role not in (UserRole.ADMIN, UserRole.MODERATOR):
        raise PermissionError("Access restricted to authorized safety staff.")

    stmt = select(Report).join(Category)

    # Status filter
    if input_data.status:
        try:
            stat_enum = ReportStatus(input_data.status.upper().strip())
            stmt = stmt.where(Report.status == stat_enum)
        except Exception:
            pass

    # Verification status filter
    if input_data.verification_status:
        v_stat = input_data.verification_status.upper().strip()
        if v_stat == "VERIFIED":
            stmt = stmt.where(Report.status == ReportStatus.APPROVED)
        elif v_stat == "UNVERIFIED":
            stmt = stmt.where(Report.status != ReportStatus.APPROVED)

    # Category filter
    if input_data.category:
        c_slug = input_data.category.lower().strip()
        stmt = stmt.where(
            or_(
                Category.slug == c_slug,
                Category.name.ilike(f"%{c_slug}%"),
            )
        )

    # Location filter
    if input_data.area:
        stmt = stmt.where(Report.location_text.ilike(f"%{input_data.area}%"))
    elif input_data.district:
        stmt = stmt.where(Report.location_text.ilike(f"%{input_data.district}%"))

    # Text query
    if input_data.query:
        q = input_data.query.strip()
        stmt = stmt.where(
            or_(
                Report.title.ilike(f"%{q}%"),
                Report.description.ilike(f"%{q}%"),
                Report.location_text.ilike(f"%{q}%"),
            )
        )

    # Date range
    if input_data.start_date:
        stmt = stmt.where(Report.created_at >= input_data.start_date)
    if input_data.end_date:
        stmt = stmt.where(Report.created_at <= input_data.end_date)

    # Count total matching query
    count_stmt = select(func.count()).select_from(stmt.subquery())
    count_res = await db.execute(count_stmt)
    total_found = count_res.scalar_one_or_none() or 0

    # Bounded pagination
    limit = min(max(input_data.limit, 1), 50)
    offset = max(input_data.offset, 0)
    stmt = stmt.order_by(Report.created_at.desc()).offset(offset).limit(limit)

    result = await db.execute(stmt)
    reports = result.scalars().all()

    report_items: List[ReportItemResult] = []
    for r in reports:
        rep_name = r.user.full_name or r.user.username if r.user else "Citizen Reporter"
        if r.is_anonymous:
            rep_name = f"{rep_name} (Anonymous Submission)"

        dist, area = extract_location_from_text(r.location_text)
        desc = (r.description or "").strip()
        summary_text = (desc[:140] + "...") if len(desc) > 140 else desc

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

    return SearchModerationReportsOutput(
        reports=report_items,
        total_found=total_found,
        criteria_applied={
            "status": input_data.status,
            "category": input_data.category,
            "district": input_data.district,
            "query": input_data.query,
            "limit": limit,
            "offset": offset,
        },
    )


# ---------------------------------------------------------------------------
# Controlled Tool 2: get_moderation_report
# ---------------------------------------------------------------------------

async def tool_get_moderation_report(
    db: AsyncSession,
    input_data: GetModerationReportInput,
    current_user: User,
) -> GetModerationReportOutput:
    """
    Controlled tool: Retrieves authorized details of a report for staff investigation,
    including moderation history, confidential notes, reporter email, and flags.
    """
    if current_user.role not in (UserRole.ADMIN, UserRole.MODERATOR):
        raise PermissionError("Access restricted to authorized safety staff.")

    try:
        req_uuid = uuid.UUID(input_data.report_id)
    except Exception:
        raise ValueError("Invalid incident report UUID format.")

    stmt = select(Report).where(Report.id == req_uuid)
    result = await db.execute(stmt)
    report = result.scalar_one_or_none()

    if not report:
        raise ValueError(f"Report '{input_data.report_id}' not found in the database.")

    # Format moderation history
    mod_history: List[Dict[str, Any]] = []
    if report.moderation_records:
        for mr in report.moderation_records:
            mod_history.append(
                {
                    "action": mr.action.value,
                    "moderator_id": str(mr.admin_id) if mr.admin_id else None,
                    "user_message": mr.user_message,
                    "internal_notes": mr.internal_notes,
                    "created_at": mr.created_at.isoformat(),
                }
            )

    media_urls = [m.media_url for m in report.media if hasattr(m, "media_url") and m.media_url]

    return GetModerationReportOutput(
        report_id=str(report.id),
        title=report.title,
        description=report.description,
        category_name=report.category.name if report.category else "Uncategorized",
        category_slug=report.category.slug if report.category else "other",
        location_text=report.location_text,
        latitude=report.latitude,
        longitude=report.longitude,
        status=report.status.value,
        is_anonymous=report.is_anonymous,
        reporter_username=report.user.username if report.user else None,
        reporter_email=report.user.email if report.user else None,
        incident_date=report.incident_date,
        created_at=report.created_at,
        moderation_history=mod_history,
        media_urls=media_urls,
        flags_count=len(report.flags) if report.flags else 0,
    )


# ---------------------------------------------------------------------------
# Controlled Tool 3: get_moderation_summary
# ---------------------------------------------------------------------------

async def tool_get_moderation_summary(
    db: AsyncSession,
    input_data: GetModerationSummaryInput,
    current_user: User,
) -> GetModerationSummaryOutput:
    """
    Controlled tool: Generates accurate moderation queue statistics directly from the database.
    """
    if current_user.role not in (UserRole.ADMIN, UserRole.MODERATOR):
        raise PermissionError("Access restricted to authorized safety staff.")

    stmt = select(Report).join(Category)

    if input_data.district:
        stmt = stmt.where(Report.location_text.ilike(f"%{input_data.district}%"))
    if input_data.category:
        stmt = stmt.where(
            or_(
                Category.slug == input_data.category.lower(),
                Category.name.ilike(f"%{input_data.category}%"),
            )
        )
    if input_data.start_date:
        stmt = stmt.where(Report.created_at >= input_data.start_date)
    if input_data.end_date:
        stmt = stmt.where(Report.created_at <= input_data.end_date)

    result = await db.execute(stmt)
    reports = result.scalars().all()

    total_reports = len(reports)
    pending_count = 0
    approved_count = 0
    rejected_count = 0
    needs_info_count = 0
    by_category: Dict[str, int] = {}
    by_district: Dict[str, int] = {}

    for r in reports:
        stat = r.status
        if stat in (ReportStatus.SUBMITTED, ReportStatus.UNDER_REVIEW):
            pending_count += 1
        elif stat == ReportStatus.APPROVED:
            approved_count += 1
        elif stat == ReportStatus.REJECTED:
            rejected_count += 1
        elif stat == ReportStatus.NEEDS_MORE_INFORMATION:
            needs_info_count += 1

        cat = r.category.name if r.category else "Other"
        by_category[cat] = by_category.get(cat, 0) + 1

        dist, _ = extract_location_from_text(r.location_text)
        dist_name = dist or "Other"
        by_district[dist_name] = by_district.get(dist_name, 0) + 1

    summary_narrative = (
        f"Moderation Queue Summary: {total_reports} total report(s) on record. "
        f"Queue breakdown: {pending_count} pending review (SUBMITTED/UNDER_REVIEW), "
        f"{approved_count} approved/verified, {needs_info_count} awaiting citizen clarification, "
        f"and {rejected_count} rejected."
    )

    return GetModerationSummaryOutput(
        total_reports=total_reports,
        pending_review_count=pending_count,
        approved_count=approved_count,
        rejected_count=rejected_count,
        needs_info_count=needs_info_count,
        by_category=by_category,
        by_district=by_district,
        summary_narrative=summary_narrative,
    )


# ---------------------------------------------------------------------------
# Controlled Tool 4: search_blood_requests_admin
# ---------------------------------------------------------------------------

async def tool_search_blood_requests_admin(
    db: AsyncSession,
    input_data: SearchBloodRequestsAdminInput,
    current_user: User,
) -> SearchBloodRequestsAdminOutput:
    """
    Controlled tool: Queries blood requests and operational response states for moderator review.
    """
    if current_user.role not in (UserRole.ADMIN, UserRole.MODERATOR):
        raise PermissionError("Access restricted to authorized safety staff.")

    stmt = select(BloodRequest)

    if input_data.status:
        try:
            stat_enum = BloodRequestStatus(input_data.status.upper().strip())
            stmt = stmt.where(BloodRequest.status == stat_enum)
        except Exception:
            pass

    if input_data.district:
        stmt = stmt.where(BloodRequest.district.ilike(f"%{input_data.district}%"))

    if input_data.blood_group:
        try:
            bg_enum = BloodGroup(input_data.blood_group.upper().strip())
            stmt = stmt.where(BloodRequest.blood_group == bg_enum)
        except Exception:
            pass

    if input_data.urgency:
        try:
            urg_enum = BloodUrgency(input_data.urgency.upper().strip())
            stmt = stmt.where(BloodRequest.urgency == urg_enum)
        except Exception:
            pass

    stmt = stmt.order_by(BloodRequest.created_at.desc()).limit(min(max(input_data.limit, 1), 50))
    result = await db.execute(stmt)
    requests = result.scalars().all()

    items: List[AdminBloodRequestItem] = []
    for br in requests:
        items.append(
            AdminBloodRequestItem(
                id=str(br.id),
                patient_name=br.contact_name,
                blood_group=br.blood_group.value,
                units_required=br.units_required,
                hospital_name=br.hospital_name,
                district=br.district,
                status=br.status.value,
                urgency=br.urgency.value,
                response_count=len(br.responses) if br.responses else 0,
                created_at=br.created_at,
            )
        )

    return SearchBloodRequestsAdminOutput(
        requests=items,
        total_found=len(items),
    )


# ---------------------------------------------------------------------------
# Controlled Tool 5: get_platform_activity_summary
# ---------------------------------------------------------------------------

async def tool_get_platform_activity(
    db: AsyncSession,
    current_user: User,
) -> PlatformActivitySummaryOutput:
    """
    Controlled tool: Aggregates operational health and activity across reports,
    blood requests, donor registrations, and active alerts.
    """
    if current_user.role not in (UserRole.ADMIN, UserRole.MODERATOR):
        raise PermissionError("Access restricted to authorized safety staff.")

    # 1. Reports counts
    r_total = (await db.execute(select(func.count(Report.id)))).scalar_one() or 0
    r_pending = (
        await db.execute(
            select(func.count(Report.id)).where(
                Report.status.in_([ReportStatus.SUBMITTED, ReportStatus.UNDER_REVIEW])
            )
        )
    ).scalar_one() or 0
    r_approved = (
        await db.execute(
            select(func.count(Report.id)).where(Report.status == ReportStatus.APPROVED)
        )
    ).scalar_one() or 0

    # 2. Blood Requests counts
    b_total = (await db.execute(select(func.count(BloodRequest.id)))).scalar_one() or 0
    b_active = (
        await db.execute(
            select(func.count(BloodRequest.id)).where(
                and_(
                    BloodRequest.is_active == True,
                    BloodRequest.status.in_([BloodRequestStatus.OPEN, BloodRequestStatus.RESPONDED]),
                )
            )
        )
    ).scalar_one() or 0

    # 3. Donors count
    d_total = (await db.execute(select(func.count(BloodDonorProfile.id)))).scalar_one() or 0

    # 4. Content Flags count
    flags_pending = (
        await db.execute(
            select(func.count(ContentFlag.id)).where(ContentFlag.status == FlagStatus.PENDING)
        )
    ).scalar_one() or 0

    # 5. Missing Persons active
    mp_active = (
        await db.execute(
            select(func.count(MissingPersonAlert.id)).where(
                and_(
                    MissingPersonAlert.is_active == True,
                    MissingPersonAlert.status == AlertStatus.ALERT_ACTIVE,
                )
            )
        )
    ).scalar_one() or 0

    narrative = (
        f"Platform Operational Activity Overview: {r_total} incident report(s) on file "
        f"({r_pending} pending moderation, {r_approved} verified/active). "
        f"Blood assistance network: {b_total} total request(s) ({b_active} active) supported by "
        f"{d_total} registered volunteer donor(s). Active civic alerts: {mp_active} missing person alert(s) "
        f"and {flags_pending} pending content flag(s)."
    )

    return PlatformActivitySummaryOutput(
        total_reports=r_total,
        pending_reports=r_pending,
        approved_reports=r_approved,
        total_blood_requests=b_total,
        active_blood_requests=b_active,
        total_donors_registered=d_total,
        total_safety_flags=flags_pending,
        active_missing_persons=mp_active,
        summary_narrative=narrative,
    )


# ---------------------------------------------------------------------------
# Controlled Tool 6: get_recent_moderation_activity
# ---------------------------------------------------------------------------

async def tool_get_recent_moderation_activity(
    db: AsyncSession,
    limit: int = 10,
    current_user: User = None,
) -> RecentModerationActivityOutput:
    """
    Controlled tool: Retrieves chronological audit trail of recent moderation actions.
    """
    if current_user.role not in (UserRole.ADMIN, UserRole.MODERATOR):
        raise PermissionError("Access restricted to authorized safety staff.")

    stmt = (
        select(ModerationRecord, Report, User)
        .outerjoin(Report, ModerationRecord.report_id == Report.id)
        .outerjoin(User, ModerationRecord.admin_id == User.id)
        .order_by(ModerationRecord.created_at.desc())
        .limit(min(max(limit, 1), 50))
    )
    result = await db.execute(stmt)
    rows = result.all()

    records: List[Dict[str, Any]] = []
    for mod_rec, report, mod_user in rows:
        records.append(
            {
                "id": str(mod_rec.id),
                "action": mod_rec.action.value,
                "report_id": str(mod_rec.report_id),
                "report_title": report.title if report else "Report Deleted/Archived",
                "moderator_name": mod_user.username if mod_user else "System / Automated",
                "user_message": mod_rec.user_message,
                "internal_notes": mod_rec.internal_notes,
                "created_at": mod_rec.created_at.isoformat(),
            }
        )

    return RecentModerationActivityOutput(
        recent_records=records,
        total_records=len(records),
    )


# ---------------------------------------------------------------------------
# Controlled Tool 7: identify_operational_attention_items
# ---------------------------------------------------------------------------

async def tool_identify_operational_attention_items(
    db: AsyncSession,
    current_user: User,
) -> OperationalAttentionOutput:
    """
    Controlled tool: Identifies bottlenecks, overdue items, unresponded emergencies,
    and potential duplicate clusters that require human moderator intervention.
    """
    if current_user.role not in (UserRole.ADMIN, UserRole.MODERATOR):
        raise PermissionError("Access restricted to authorized safety staff.")

    now = datetime.now(timezone.utc)
    items: List[OperationalAttentionItem] = []

    # 1. Unresolved emergency blood requests (urgency == EMERGENCY and 0 responses)
    em_stmt = (
        select(BloodRequest)
        .where(
            and_(
                BloodRequest.is_active == True,
                BloodRequest.status == BloodRequestStatus.OPEN,
                BloodRequest.urgency == BloodUrgency.EMERGENCY,
            )
        )
        .order_by(BloodRequest.created_at.asc())
        .limit(5)
    )
    em_res = await db.execute(em_stmt)
    for br in em_res.scalars().all():
        resp_count = len(br.responses) if br.responses else 0
        if resp_count == 0:
            items.append(
                OperationalAttentionItem(
                    item_type="BLOOD_UNRESPONDED_EMERGENCY",
                    record_id=str(br.id),
                    title=f"Emergency Blood Request: {br.blood_group.value} at {br.hospital_name} ({br.district})",
                    severity="CRITICAL",
                    reason=f"Emergency blood request has zero volunteer donor responses since creation.",
                    recommended_action="Initiate community outreach to notify nearby compatible donors.",
                    created_at=br.created_at,
                )
            )

    # 2. Overdue submitted reports (SUBMITTED > 24 hours ago)
    stale_cutoff = now - timedelta(hours=24)
    stale_stmt = (
        select(Report)
        .where(
            and_(
                Report.status == ReportStatus.SUBMITTED,
                Report.created_at <= stale_cutoff,
            )
        )
        .order_by(Report.created_at.asc())
        .limit(5)
    )
    stale_res = await db.execute(stale_stmt)
    for r in stale_res.scalars().all():
        age_hours = int((now - r.created_at).total_seconds() / 3600)
        items.append(
            OperationalAttentionItem(
                item_type="REPORT_STALE",
                record_id=str(r.id),
                title=r.title,
                severity="HIGH",
                reason=f"Incident report has remained unmoderated in SUBMITTED queue for {age_hours} hours.",
                recommended_action="Review report details and start moderation evaluation.",
                created_at=r.created_at,
            )
        )

    # 3. Reports with pending content flags
    flag_stmt = (
        select(ContentFlag.report_id, func.count(ContentFlag.id).label("flag_count"))
        .where(ContentFlag.status == FlagStatus.PENDING)
        .group_by(ContentFlag.report_id)
        .having(func.count(ContentFlag.id) >= 1)
        .limit(5)
    )
    flag_res = await db.execute(flag_stmt)
    for r_id, f_count in flag_res.all():
        r_obj = await db.get(Report, r_id)
        if r_obj:
            items.append(
                OperationalAttentionItem(
                    item_type="HIGH_FLAG_REPORT",
                    record_id=str(r_obj.id),
                    title=r_obj.title,
                    severity="HIGH" if f_count >= 2 else "MEDIUM",
                    reason=f"Incident has {f_count} pending safety/spam flag(s) reported by citizens.",
                    recommended_action="Investigate reported content violations and resolve flags.",
                    created_at=r_obj.created_at,
                )
            )

    summary_text = (
        f"Operational Assessment: Identified {len(items)} item(s) requiring moderator attention, "
        f"including {sum(1 for i in items if i.severity == 'CRITICAL')} critical emergencies and "
        f"{sum(1 for i in items if i.severity == 'HIGH')} high-priority reports."
    )

    return OperationalAttentionOutput(
        items=items,
        total_items=len(items),
        summary=summary_text,
    )


# ---------------------------------------------------------------------------
# Controlled Tool 8: prepare_moderation_action
# ---------------------------------------------------------------------------

async def tool_prepare_moderation_action(
    db: AsyncSession,
    report_id: str,
    action_type: str,
    reason: str,
    user_message: Optional[str],
    internal_notes: Optional[str],
    current_user: User,
) -> ModerationActionPreview:
    """
    Controlled tool: Prepares a safe, structured action preview before any database mutation.
    Validates state transitions and returns a single-use confirmation token.
    """
    if current_user.role not in (UserRole.ADMIN, UserRole.MODERATOR):
        raise PermissionError("Access restricted to authorized safety staff.")

    try:
        req_uuid = uuid.UUID(report_id)
    except Exception:
        raise ValueError("Invalid incident report UUID.")

    stmt = select(Report).where(Report.id == req_uuid)
    result = await db.execute(stmt)
    report = result.scalar_one_or_none()

    if not report:
        raise ValueError(f"Target report '{report_id}' does not exist in the database.")

    action_type = action_type.upper().strip()

    # State transition validation
    if action_type == "APPROVE_REPORT":
        if report.status == ReportStatus.APPROVED:
            raise ValueError("Report is already in APPROVED status.")
        if report.status == ReportStatus.DRAFT:
            raise ValueError("Cannot approve an unsubmitted draft report.")
        proposed_status = "APPROVED"
        default_user_msg = "Your report has been verified by platform safety moderators and published."
    elif action_type == "REJECT_REPORT":
        if report.status == ReportStatus.REJECTED:
            raise ValueError("Report is already in REJECTED status.")
        if report.status == ReportStatus.DRAFT:
            raise ValueError("Cannot reject an unsubmitted draft report.")
        proposed_status = "REJECTED"
        default_user_msg = "Your report was reviewed and could not be verified according to platform guidelines."
    elif action_type == "REQUEST_MORE_INFO":
        if report.status not in (ReportStatus.SUBMITTED, ReportStatus.UNDER_REVIEW):
            raise ValueError("Can only request additional info for SUBMITTED or UNDER_REVIEW reports.")
        proposed_status = "NEEDS_MORE_INFORMATION"
        default_user_msg = "Please provide additional photos or landmark clarification for verification."
    elif action_type == "START_REVIEW":
        if report.status != ReportStatus.SUBMITTED:
            raise ValueError("Can only start review for reports in SUBMITTED status.")
        proposed_status = "UNDER_REVIEW"
        default_user_msg = "Your report is currently being reviewed by regional safety moderators."
    else:
        raise ValueError(f"Unsupported moderation action type: '{action_type}'")

    details = {
        "user_message": user_message or default_user_msg,
        "internal_notes": internal_notes or f"Action prepared via Admin Copilot: {reason}",
    }

    return generate_action_preview(
        action_type=action_type,
        target_record_id=str(report.id),
        target_title=report.title,
        current_status=report.status.value,
        proposed_status=proposed_status,
        reason=reason,
        details=details,
        user_id=current_user.id,
    )


# ---------------------------------------------------------------------------
# Confirmation & Execution Engine (State-Changing)
# ---------------------------------------------------------------------------

async def execute_admin_copilot_confirmation(
    db: AsyncSession,
    confirm_data: AdminCopilotConfirmRequest,
    current_user: User,
) -> AdminCopilotConfirmResponse:
    """
    Executes a confirmed state-changing moderation action:
    - Verifies user has MODERATOR or ADMIN role.
    - Validates and consumes single-use confirmation token (preventing replay).
    - Re-fetches target report and verifies status has not changed unexpectedly.
    - Commits database transaction and audit log (`ModerationRecord`).
    - Dispatches user notifications and updates reputation.
    """
    if current_user.role not in (UserRole.ADMIN, UserRole.MODERATOR):
        raise PermissionError("Access restricted to authorized safety staff.")

    token = confirm_data.confirmation_token.strip()
    _prune_admin_copilot_tokens()

    # 1. Check replay protection
    if f"COMPLETED:{token}" in _ADMIN_COPILOT_TOKENS or token.startswith("COMPLETED:"):
        return AdminCopilotConfirmResponse(
            status="ALREADY_PROCESSED",
            action_type=confirm_data.action_type,
            record_id=confirm_data.target_record_id,
            previous_status="",
            new_status="",
            message="This action has already been confirmed and executed.",
        )

    # 2. Check token validity
    token_data = _ADMIN_COPILOT_TOKENS.get(token)
    if not token_data:
        raise ValueError("Invalid, expired, or previously consumed confirmation token.")

    # Check expiry
    if token_data["expires_at"] < datetime.now(timezone.utc):
        del _ADMIN_COPILOT_TOKENS[token]
        raise ValueError("Confirmation token has expired. Please prepare a new action preview.")

    action_type = token_data["action_type"]
    target_id_str = token_data["target_record_id"]
    expected_curr_status = token_data["current_status"]
    proposed_status_str = token_data["proposed_status"]

    # 3. Re-fetch target report from DB
    req_uuid = uuid.UUID(target_id_str)
    stmt = select(Report).where(Report.id == req_uuid)
    result = await db.execute(stmt)
    report = result.scalar_one_or_none()

    if not report:
        raise ValueError("Target report no longer exists in the database.")

    # 4. Verify record status hasn't changed unexpectedly
    if report.status.value != expected_curr_status:
        raise ValueError(
            f"State conflict: Report status changed from '{expected_curr_status}' "
            f"to '{report.status.value}' since the preview was prepared."
        )

    prev_status = report.status.value
    user_msg = confirm_data.user_message or token_data["details"].get("user_message")
    internal_notes = confirm_data.internal_notes or token_data["details"].get("internal_notes")

    # 5. Execute state transition
    if action_type == "APPROVE_REPORT":
        report.status = ReportStatus.APPROVED
        mod_action = ModerationAction.APPROVED
        notif_type = NotificationType.REPORT_APPROVED
        notif_title = "Incident Report Approved"
        notif_body = f"Your incident report '{report.title}' has been approved and published."

        # Award reputation and impact points
        if report.user_id:
            await award_impact_points(
                db=db,
                user_id=report.user_id,
                points=20,
                action_type="REPORT_APPROVED",
                description="Report approved and verified via Admin Copilot",
                reference_type="REPORT",
                reference_id=report.id,
            )
            await adjust_trust_score(
                db=db,
                user_id=report.user_id,
                delta=5,
                reason="Report approved by safety moderators",
                reference_type="REPORT",
                reference_id=report.id,
            )
            await increment_contribution_count(
                db=db,
                user_id=report.user_id,
                contribution_type="REPORT",
                count=1,
            )

    elif action_type == "REJECT_REPORT":
        report.status = ReportStatus.REJECTED
        mod_action = ModerationAction.REJECTED
        notif_type = NotificationType.REPORT_REJECTED
        notif_title = "Incident Report Rejected"
        notif_body = f"Your incident report '{report.title}' was reviewed and rejected: {user_msg}"

        if report.user_id:
            await adjust_trust_score(
                db=db,
                user_id=report.user_id,
                delta=-10,
                reason="Report rejected by moderators",
                reference_type="REPORT",
                reference_id=report.id,
            )

    elif action_type == "REQUEST_MORE_INFO":
        report.status = ReportStatus.NEEDS_MORE_INFORMATION
        mod_action = ModerationAction.REQUESTED_INFORMATION
        notif_type = NotificationType.REPORT_INFO_REQUESTED
        notif_title = "Additional Information Requested"
        notif_body = f"Please provide additional details for '{report.title}': {user_msg}"

    elif action_type == "START_REVIEW":
        report.status = ReportStatus.UNDER_REVIEW
        mod_action = ModerationAction.STARTED_REVIEW
        notif_type = NotificationType.REPORT_UNDER_REVIEW
        notif_title = "Report Under Review"
        notif_body = f"Your incident report '{report.title}' is now being reviewed by moderators."

    else:
        raise ValueError(f"Unknown action type '{action_type}'")

    # Record moderation action audit trail
    mod_rec = ModerationRecord(
        report_id=report.id,
        admin_id=current_user.id,
        action=mod_action,
        user_message=user_msg,
        internal_notes=internal_notes,
    )
    db.add(mod_rec)
    await db.flush()

    # Notify report owner
    await notify_report_owner(
        db=db,
        report=report,
        notification_type=notif_type,
        title=notif_title,
        message=notif_body,
    )

    await db.commit()

    # 6. Consume token and enforce single-use
    del _ADMIN_COPILOT_TOKENS[token]
    _ADMIN_COPILOT_TOKENS[f"COMPLETED:{token}"] = {"completed_at": datetime.now(timezone.utc)}

    return AdminCopilotConfirmResponse(
        status="SUCCESS",
        action_type=action_type,
        record_id=str(report.id),
        previous_status=prev_status,
        new_status=report.status.value,
        message=f"Report #{str(report.id)[:8]} status successfully updated to {report.status.value}.",
        details={
            "moderator_username": current_user.username,
            "user_message": user_msg,
            "internal_notes": internal_notes,
        },
    )


# ---------------------------------------------------------------------------
# Conversational Copilot Router
# ---------------------------------------------------------------------------

async def process_admin_copilot_chat(
    db: AsyncSession,
    request_data: AdminCopilotRequest,
    current_user: User,
) -> AdminCopilotResponse:
    """
    Main entry point for Phase D Admin & Moderator Copilot:
    - Enforces MODERATOR or ADMIN role.
    - Classifies intent across Bangla and English.
    - Dispatches to controlled tools.
    - Prepares action previews when state-changing operations are requested.
    """
    if current_user.role not in (UserRole.ADMIN, UserRole.MODERATOR):
        raise PermissionError("Access restricted to authorized safety staff.")

    message = request_data.message.strip()
    conversation_id = request_data.conversation_id or str(uuid.uuid4())
    is_bn = is_bengali_text(message) or request_data.lang.lower() == "bn"

    extracted_uuid = extract_report_uuid(message) or request_data.report_id
    extracted_district, extracted_area = extract_location_from_text(message)
    extracted_category = extract_category_slug(message)

    # 1. Classify intent
    intent = classify_admin_copilot_intent(message, extracted_uuid)

    # Check for ambiguous query
    words = message.lower().split()
    if len(words) <= 2 and not extracted_uuid and not extracted_district and not extracted_category:
        if not any(k in message.lower() for k in ("summary", "activity", "attention", "queue", "overview", "help", "status")):
            intent = AdminCopilotIntent.CLARIFY_QUERY

    # -----------------------------------------------------------------------
    # INTENT: CLARIFY_QUERY
    # -----------------------------------------------------------------------
    if intent == AdminCopilotIntent.CLARIFY_QUERY:
        if is_bn:
            clarify_reply = (
                "মডারেটর ও অ্যাডমিন কপাইলটে স্বাগতম। আপনি কোন অপারেশনটি সম্পন্ন করতে চান তা নির্বাচন করুন:\n"
                "- 'মডারেশন সারির অপেক্ষমাণ রিপোর্টগুলো দেখাও'\n"
                "- 'জরুরি অপারেশনাল ইস্যু ও বটলেনেক শনাক্ত করো'\n"
                "- 'প্ল্যাটফর্ম অ্যাক্টিভিটি সারসংক্ষেপ'\n"
                "- 'উন্মুক্ত রক্তের আবেদনগুলো দেখাও'"
            )
            follow_up = "আপনি কি নির্দিষ্ট রিপোর্ট স্ট্যাটাস (যেমন SUBMITTED, UNDER_REVIEW) বা অ্যাক্টিভিটি মেট্রিক দেখতে চান?"
        else:
            clarify_reply = (
                "Welcome to Admin & Moderator Copilot. Please specify an operational inquiry:\n"
                "- 'Show reports waiting for moderator review'\n"
                "- 'Identify operational attention items and bottlenecks'\n"
                "- 'Platform activity summary'\n"
                "- 'Show open blood requests'"
            )
            follow_up = "Would you like to inspect pending reports, operational issues, or blood coordination queues?"

        return AdminCopilotResponse(
            reply=clarify_reply,
            intent=AdminCopilotIntent.CLARIFY_QUERY,
            follow_up_question=follow_up,
            is_clarification_needed=True,
            conversation_id=conversation_id,
        )

    # -----------------------------------------------------------------------
    # INTENT: PREPARE_MODERATION_ACTION
    # -----------------------------------------------------------------------
    if intent == AdminCopilotIntent.PREPARE_MODERATION_ACTION and extracted_uuid:
        m_lower = message.lower()
        if any(k in m_lower for k in ("approve", "অনুমোদন", "অনুমোদিত")):
            act_type = "APPROVE_REPORT"
            act_reason = "Moderator requested approval via natural language copilot."
        elif any(k in m_lower for k in ("reject", "বাতিল")):
            act_type = "REJECT_REPORT"
            act_reason = "Moderator requested rejection via natural language copilot."
        elif any(k in m_lower for k in ("more info", "information", "তথ্য প্রয়োজন")):
            act_type = "REQUEST_MORE_INFO"
            act_reason = "Moderator requested additional verification info from reporter."
        else:
            act_type = "START_REVIEW"
            act_reason = "Moderator initiated active review."

        try:
            preview = await tool_prepare_moderation_action(
                db=db,
                report_id=extracted_uuid,
                action_type=act_type,
                reason=act_reason,
                user_message=None,
                internal_notes=None,
                current_user=current_user,
            )

            if is_bn:
                reply = (
                    f"মডারেশন অ্যাকশন প্রিভিউ প্রস্তুত করা হয়েছে:\n"
                    f"- রিপোর্ট: {preview.target_title}\n"
                    f"- প্রস্তাবিত পরিবর্তন: {preview.current_status} → {preview.proposed_status}\n"
                    f"- কারণ: {preview.reason}\n\n"
                    f"সতর্কতা: ডাটাবেসে পরিবর্তন কার্যকর করার জন্য 'Confirm Action' বাটনে ক্লিক করতে হবে।"
                )
            else:
                reply = (
                    f"Moderation Action Preview Prepared:\n"
                    f"- Target Report: {preview.target_title}\n"
                    f"- Proposed Transition: {preview.current_status} → {preview.proposed_status}\n"
                    f"- Rationale: {preview.reason}\n\n"
                    f"Notice: State-changing operations require explicit human confirmation."
                )

            return AdminCopilotResponse(
                reply=reply,
                intent=intent,
                tool_executed="prepare_moderation_action",
                action_preview=preview,
                conversation_id=conversation_id,
            )
        except Exception as e:
            return AdminCopilotResponse(
                reply=f"Unable to prepare moderation action: {str(e)}",
                intent=intent,
                conversation_id=conversation_id,
            )

    # -----------------------------------------------------------------------
    # INTENT: IDENTIFY_ATTENTION_ITEMS
    # -----------------------------------------------------------------------
    if intent == AdminCopilotIntent.IDENTIFY_ATTENTION_ITEMS:
        attention_out = await tool_identify_operational_attention_items(db, current_user)

        if attention_out.total_items == 0:
            msg_bn = "বর্তমানে কোনো জরুরি অপারেশনাল ব্যাকলগ বা দৃষ্টি আকর্ষণকারী সমস্যা নেই। প্ল্যাটফর্মের সমস্ত কিউ স্বাভাবিক রয়েছে।"
            msg_en = "Zero critical operational bottlenecks or overdue items detected. All moderation queues are clear."
            return AdminCopilotResponse(
                reply=msg_bn if is_bn else msg_en,
                intent=intent,
                tool_executed="identify_operational_attention_items",
                attention_items=attention_out,
                conversation_id=conversation_id,
            )

        items_str = "\n".join(
            [
                f"- [{it.severity}] {it.title}\n  কারণ: {it.reason}\n  প্রস্তাবিত পদক্ষেপ: {it.recommended_action}"
                if is_bn
                else f"- [{it.severity}] {it.title}\n  Reason: {it.reason}\n  Action: {it.recommended_action}"
                for it in attention_out.items
            ]
        )

        if is_bn:
            reply = f"অপারেশনাল সতর্কতা এবং দৃষ্টি আকর্ষণকারী আইটেম ({attention_out.total_items} টি):\n\n{items_str}"
        else:
            reply = f"Identified Operational Attention Items ({attention_out.total_items}):\n\n{items_str}"

        return AdminCopilotResponse(
            reply=reply,
            intent=intent,
            tool_executed="identify_operational_attention_items",
            attention_items=attention_out,
            conversation_id=conversation_id,
        )

    # -----------------------------------------------------------------------
    # INTENT: GET_PLATFORM_ACTIVITY
    # -----------------------------------------------------------------------
    if intent == AdminCopilotIntent.GET_PLATFORM_ACTIVITY:
        activity_out = await tool_get_platform_activity(db, current_user)
        return AdminCopilotResponse(
            reply=activity_out.summary_narrative,
            intent=intent,
            tool_executed="get_platform_activity",
            platform_activity=activity_out,
            conversation_id=conversation_id,
        )

    # -----------------------------------------------------------------------
    # INTENT: GET_RECENT_ACTIVITY
    # -----------------------------------------------------------------------
    if intent == AdminCopilotIntent.GET_RECENT_ACTIVITY:
        recent_out = await tool_get_recent_moderation_activity(db, limit=10, current_user=current_user)

        if recent_out.total_records == 0:
            reply = "সাম্প্রতিক কোনো মডারেশন রেকর্ড নেই।" if is_bn else "No recent moderation activity on record."
        else:
            rows_str = "\n".join(
                [
                    f"- [{r['action']}] {r['report_title']} (মডারেটর: {r['moderator_name']}, সময়: {r['created_at'][:16]})"
                    if is_bn
                    else f"- [{r['action']}] {r['report_title']} (By: {r['moderator_name']}, Time: {r['created_at'][:16]})"
                    for r in recent_out.recent_records[:6]
                ]
            )
            reply = f"সাম্প্রতিক মডারেশন কার্যক্রম:\n\n{rows_str}" if is_bn else f"Recent Moderation Activity:\n\n{rows_str}"

        return AdminCopilotResponse(
            reply=reply,
            intent=intent,
            tool_executed="get_recent_moderation_activity",
            recent_activity=recent_out,
            conversation_id=conversation_id,
        )

    # -----------------------------------------------------------------------
    # INTENT: SEARCH_BLOOD_REQUESTS
    # -----------------------------------------------------------------------
    if intent == AdminCopilotIntent.SEARCH_BLOOD_REQUESTS:
        blood_out = await tool_search_blood_requests_admin(
            db,
            SearchBloodRequestsAdminInput(
                district=extracted_district,
                status="OPEN" if "open" in message.lower() else None,
            ),
            current_user,
        )

        if blood_out.total_found == 0:
            reply = "কোনো রক্তের আবেদন পাওয়া যায়নি।" if is_bn else "No matching blood requests found in the database."
        else:
            items_str = "\n".join(
                [
                    f"- [{b.urgency}] {b.blood_group} ({b.hospital_name}, {b.district}) — রেসপন্স: {b.response_count} জন"
                    if is_bn
                    else f"- [{b.urgency}] {b.blood_group} ({b.hospital_name}, {b.district}) — Responses: {b.response_count}"
                    for b in blood_out.requests[:5]
                ]
            )
            reply = f"রক্তের আবেদনের তালিকা (মোট: {blood_out.total_found} টি):\n\n{items_str}" if is_bn else f"Blood Requests Queue ({blood_out.total_found} total):\n\n{items_str}"

        return AdminCopilotResponse(
            reply=reply,
            intent=intent,
            tool_executed="search_blood_requests_admin",
            blood_requests_result=blood_out,
            conversation_id=conversation_id,
        )

    # -----------------------------------------------------------------------
    # INTENT: GET_MODERATION_REPORT (By ID)
    # -----------------------------------------------------------------------
    if intent == AdminCopilotIntent.GET_MODERATION_REPORT and extracted_uuid:
        try:
            report_out = await tool_get_moderation_report(
                db, GetModerationReportInput(report_id=extracted_uuid), current_user
            )

            if is_bn:
                reply = (
                    f"রিপোর্টের বিস্তারিত মডারেশন বিবরণ:\n"
                    f"- আইডি: {report_out.report_id}\n"
                    f"- শিরোনাম: {report_out.title}\n"
                    f"- ক্যাটাগরি: {report_out.category_name}\n"
                    f"- অবস্থান: {report_out.location_text}\n"
                    f"- স্ট্যাটাস: {report_out.status}\n"
                    f"- জমাকারী: {report_out.reporter_username} ({report_out.reporter_email})\n"
                    f"- ফ্ল্যাগ সংখ্যা: {report_out.flags_count}\n"
                    f"- বিবরণ: {report_out.description}"
                )
            else:
                reply = (
                    f"Moderation Report Details:\n"
                    f"- ID: {report_out.report_id}\n"
                    f"- Title: {report_out.title}\n"
                    f"- Category: {report_out.category_name}\n"
                    f"- Location: {report_out.location_text}\n"
                    f"- Status: {report_out.status}\n"
                    f"- Reporter: {report_out.reporter_username} ({report_out.reporter_email})\n"
                    f"- Flags: {report_out.flags_count}\n"
                    f"- Description: {report_out.description}"
                )

            return AdminCopilotResponse(
                reply=reply,
                intent=intent,
                tool_executed="get_moderation_report",
                report_details=report_out,
                conversation_id=conversation_id,
            )
        except Exception as e:
            return AdminCopilotResponse(
                reply=f"Error retrieving report: {str(e)}",
                intent=intent,
                conversation_id=conversation_id,
            )

    # -----------------------------------------------------------------------
    # INTENT: GET_MODERATION_SUMMARY
    # -----------------------------------------------------------------------
    if intent == AdminCopilotIntent.GET_MODERATION_SUMMARY:
        summary_out = await tool_get_moderation_summary(
            db,
            GetModerationSummaryInput(
                district=extracted_district,
                category=extracted_category,
            ),
            current_user,
        )

        return AdminCopilotResponse(
            reply=summary_out.summary_narrative,
            intent=intent,
            tool_executed="get_moderation_summary",
            moderation_summary=summary_out,
            conversation_id=conversation_id,
        )

    # -----------------------------------------------------------------------
    # INTENT: PREPARE_MODERATION_REVIEW
    # -----------------------------------------------------------------------
    if intent == AdminCopilotIntent.PREPARE_MODERATION_REVIEW and extracted_uuid:
        rev_out = await tool_prepare_report_review(
            db, PrepareReportReviewInput(report_id=extracted_uuid), current_user
        )

        chk_str = "\n".join([f"  [{'✓' if c['passed'] else '✗'}] {c['criterion']}: {c['detail']}" for c in rev_out.checklist])
        reply = (
            f"Review preparation for #{extracted_uuid[:8]}...:\n"
            f"- Recommended Action: {rev_out.suggested_action}\n"
            f"- Priority: {rev_out.suggested_priority}\n"
            f"- Checklist:\n{chk_str}\n\n"
            f"Reasoning: {rev_out.ai_reasoning}"
        )

        return AdminCopilotResponse(
            reply=reply,
            intent=intent,
            tool_executed="prepare_moderation_review",
            review_preview=rev_out,
            conversation_id=conversation_id,
        )

    # -----------------------------------------------------------------------
    # DEFAULT / INTENT: SEARCH_MODERATION_REPORTS
    # -----------------------------------------------------------------------
    target_status = None
    if any(k in message.lower() for k in ("waiting", "pending", "অপেক্ষমাণ", "submitted")):
        target_status = "SUBMITTED"
    elif any(k in message.lower() for k in ("under review", "reviewing", "পর্যালোচনাধীন")):
        target_status = "UNDER_REVIEW"
    elif any(k in message.lower() for k in ("needs info", "clarification", "তথ্য")):
        target_status = "NEEDS_MORE_INFORMATION"

    reports_out = await tool_search_moderation_reports(
        db,
        SearchModerationReportsInput(
            status=target_status,
            category=extracted_category,
            district=extracted_district,
            area=extracted_area,
            query=message if not (extracted_district or extracted_category or target_status) else None,
            limit=10,
        ),
        current_user,
    )

    if reports_out.total_found == 0:
        reply = "ডাটাবেসে কোনো রিপোর্ট পাওয়া যায়নি।" if is_bn else "No reports found in the moderation queue matching these criteria."
    else:
        items_str = "\n".join(
            [
                f"- [{r.status}] {r.title} ({r.location_text}) — ক্যাটাগরি: {r.category_name}"
                if is_bn
                else f"- [{r.status}] {r.title} ({r.location_text}) — Category: {r.category_name}"
                for r in reports_out.reports[:5]
            ]
        )
        reply = (
            f"মডারেশন কিউতে মোট {reports_out.total_found} টি রিপোর্ট পাওয়া গেছে:\n\n{items_str}"
            if is_bn
            else f"Found {reports_out.total_found} report(s) in the moderation queue:\n\n{items_str}"
        )

    return AdminCopilotResponse(
        reply=reply,
        intent=AdminCopilotIntent.SEARCH_MODERATION_REPORTS,
        tool_executed="search_moderation_reports",
        reports_result=reports_out,
        conversation_id=conversation_id,
    )


# ---------------------------------------------------------------------------
# Intent Classifier
# ---------------------------------------------------------------------------

def classify_admin_copilot_intent(
    message: str,
    extracted_uuid: Optional[str],
) -> AdminCopilotIntent:
    """Classifies natural language intent for the Admin & Moderator Copilot."""
    m = message.lower()

    # Explicit state mutations requested
    if extracted_uuid and any(k in m for k in ("approve report", "reject report", "request more info", "start review", "approve", "reject", "অনুমোদন করো", "বাতিল করো")):
        return AdminCopilotIntent.PREPARE_MODERATION_ACTION

    # Review preparation
    if extracted_uuid and any(k in m for k in ("review", "চেকলিস্ট", "রিভিউ প্রস্তুত", "prepare review")):
        return AdminCopilotIntent.PREPARE_MODERATION_REVIEW

    # Report details by ID
    if extracted_uuid and any(k in m for k in ("details", "বিবরণ", "show report", "inspect")):
        return AdminCopilotIntent.GET_MODERATION_REPORT

    # Operational bottlenecks / attention
    if any(k in m for k in ("attention", "bottleneck", "issue", "operational", "সমস্যা", "দৃষ্টি আকর্ষণ", "overdue", "stale", "suspicious")):
        return AdminCopilotIntent.IDENTIFY_ATTENTION_ITEMS

    # Platform activity
    if any(k in m for k in ("platform activity", "overview", "overall", "ম্যাট্রিক্স", "কার্যক্রম")):
        return AdminCopilotIntent.GET_PLATFORM_ACTIVITY

    # Recent moderation activity audit trail
    if any(k in m for k in ("recent moderation", "audit", "moderation actions", "সাম্প্রতিক কার্যক্রম", "history")):
        return AdminCopilotIntent.GET_RECENT_ACTIVITY

    # Blood requests queue
    if any(k in m for k in ("blood", "রক্ত", "donor", "blood request")):
        return AdminCopilotIntent.SEARCH_BLOOD_REQUESTS

    # Moderation summary
    if any(k in m for k in ("summary", "summarize", "সারসংক্ষেপ", "পরিসংখ্যান", "stats")):
        return AdminCopilotIntent.GET_MODERATION_SUMMARY

    # Default to search moderation reports
    return AdminCopilotIntent.SEARCH_MODERATION_REPORTS
