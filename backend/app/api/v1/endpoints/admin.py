import json
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, and_, or_, delete
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_current_active_admin
from app.db.session import get_db
from app.core.config import settings
from app.models.notification import NotificationType
from app.models.moderation import ModerationRecord, ModerationAction
from app.models.report import Report, ReportStatus
from app.models.comment import Comment, CommentStatus
from app.models.flag import ContentFlag, FlagStatus
from app.models.category import Category
from app.models.emergency_service import (
    EmergencyService,
    ServiceType,
    VerificationStatus,
    SafetyServiceVerificationAudit,
)
from app.models.missing_person import (
    MissingPersonProfile,
    MissingPersonAlert,
    MissingPersonSighting,
    AlertStatus,
    SightingStatus,
)
from app.models.user import User, UserRole
from app.schemas.moderation import (
    AdminDashboardStats,
    ModerationActionRequest,
    ModerationRecordResponse,
)
from app.schemas.report import (
    AdminReportResponse,
    AdminReportPagination,
)
from app.schemas.user import (
    AdminUserResponse,
    AdminUserPagination,
    AdminUserRoleUpdate,
    AdminUserStatusUpdate,
)
from app.schemas.category import (
    CategoryCreate,
    CategoryUpdate,
    AdminCategoryResponse,
)
from app.schemas.comment import AdminCommentResponse, CommentStatusUpdate
from app.schemas.emergency_service import (
    EmergencyServiceCreate,
    EmergencyServiceUpdate,
    EmergencyServiceResponse,
    AdminEmergencyServicePagination,
    SafetyServiceVerificationAuditResponse,
    SafetyServiceVerifyRequest,
    SafetyServiceReviewRequest,
    SafetyDirectoryMetricsResponse,
    SafetyDirectoryBulkActionRequest,
    SafetyServiceImportRequest,
    SafetyServiceImportResponse,
    SafetyServiceDuplicateCandidate,
)
from app.schemas.missing_person import (
    MissingPersonAlertActivateRequest,
    MissingPersonFoundRequest,
    AdminMissingPersonAlertResponse,
    AdminMissingPersonAlertPagination,
    AdminMissingPersonSightingResponse,
    AdminSightingModerationRequest,
    MissingPersonProfileResponse,
    PublicMissingPersonSightingResponse,
)
from app.models.incident_cluster import IncidentCluster, IncidentClusterMember
from app.schemas.incident_cluster import (
    IncidentClusterCreate,
    IncidentClusterUpdate,
    IncidentClusterDetailResponse,
    IncidentClusterListResponse,
    IncidentClusterMemberCreate,
    IncidentClusterMemberResponse,
    SuggestedRelatedReportResponse,
)
from app.services.notification import notify_report_owner, create_notification
from app.services.missing_person import (
    dispatch_missing_person_alert_notifications,
    notify_missing_person_found,
    check_duplicate_missing_person_candidates,
)
from app.services.incident_similarity import (
    find_suggested_related_reports,
    calculate_similarity_breakdown,
)

router = APIRouter()


# ==============================================================================
# 1. ADMIN DASHBOARD METRICS
# ==============================================================================

@router.get(
    "/dashboard",
    response_model=AdminDashboardStats,
    status_code=status.HTTP_200_OK,
    summary="Get aggregated platform and moderation metrics",
)
async def get_admin_dashboard(
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Calculates platform moderation metrics from actual database records.
    Strictly restricted to administrators.
    """
    total_reports = await db.scalar(select(func.count(Report.id))) or 0
    pending_reports = await db.scalar(
        select(func.count(Report.id)).where(Report.status == ReportStatus.SUBMITTED)
    ) or 0
    under_review_reports = await db.scalar(
        select(func.count(Report.id)).where(Report.status == ReportStatus.UNDER_REVIEW)
    ) or 0
    approved_reports = await db.scalar(
        select(func.count(Report.id)).where(Report.status == ReportStatus.APPROVED)
    ) or 0
    rejected_reports = await db.scalar(
        select(func.count(Report.id)).where(Report.status == ReportStatus.REJECTED)
    ) or 0
    needs_more_info_reports = await db.scalar(
        select(func.count(Report.id)).where(Report.status == ReportStatus.NEEDS_MORE_INFORMATION)
    ) or 0
    archived_reports = await db.scalar(
        select(func.count(Report.id)).where(Report.status == ReportStatus.ARCHIVED)
    ) or 0
    draft_reports = await db.scalar(
        select(func.count(Report.id)).where(Report.status == ReportStatus.DRAFT)
    ) or 0
    total_users = await db.scalar(select(func.count(User.id))) or 0
    anonymous_reports_count = await db.scalar(
        select(func.count(Report.id)).where(Report.is_anonymous == True)
    ) or 0

    # Safety flags & Comments metrics
    total_flags = await db.scalar(select(func.count(ContentFlag.id))) or 0
    pending_flags = await db.scalar(
        select(func.count(ContentFlag.id)).where(ContentFlag.status == FlagStatus.PENDING)
    ) or 0
    total_comments = await db.scalar(select(func.count(Comment.id))) or 0
    hidden_comments = await db.scalar(
        select(func.count(Comment.id)).where(Comment.status != CommentStatus.VISIBLE)
    ) or 0
    active_categories = await db.scalar(
        select(func.count(Category.id)).where(Category.is_active == True)
    ) or 0

    return AdminDashboardStats(
        total_reports=total_reports,
        pending_reports=pending_reports,
        under_review_reports=under_review_reports,
        approved_reports=approved_reports,
        rejected_reports=rejected_reports,
        needs_more_info_reports=needs_more_info_reports,
        archived_reports=archived_reports,
        draft_reports=draft_reports,
        total_users=total_users,
        anonymous_reports_count=anonymous_reports_count,
        total_flags=total_flags,
        pending_flags=pending_flags,
        total_comments=total_comments,
        hidden_comments=hidden_comments,
        active_categories=active_categories,
    )


# ==============================================================================
# 2. REPORT QUEUE & MODERATION LIFECYCLE
# ==============================================================================

@router.get(
    "/reports",
    response_model=AdminReportPagination,
    status_code=status.HTTP_200_OK,
    summary="List and filter moderation report queue with pagination",
)
async def list_admin_reports(
    status_filter: Optional[ReportStatus] = Query(None, alias="status"),
    category_id: Optional[uuid.UUID] = Query(None),
    search: Optional[str] = Query(None, min_length=1),
    is_anonymous: Optional[bool] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db),
) -> Any:
    conditions = []
    if status_filter:
        conditions.append(Report.status == status_filter)
    if category_id:
        conditions.append(Report.category_id == category_id)
    if is_anonymous is not None:
        conditions.append(Report.is_anonymous == is_anonymous)
    if search:
        search_pattern = f"%{search.strip()}%"
        conditions.append(
            or_(
                Report.title.ilike(search_pattern),
                Report.description.ilike(search_pattern),
                Report.location_text.ilike(search_pattern),
            )
        )

    where_clause = and_(*conditions) if conditions else True

    # Total count query
    count_stmt = select(func.count(Report.id)).where(where_clause)
    total = await db.scalar(count_stmt) or 0

    # Items query with eager-loaded relations
    stmt = (
        select(Report)
        .where(where_clause)
        .order_by(Report.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(stmt)
    reports = result.scalars().all()

    return AdminReportPagination(
        items=list(reports),
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/reports/{report_id}",
    response_model=AdminReportResponse,
    status_code=status.HTTP_200_OK,
    summary="Get full report details for moderation review",
)
async def get_admin_report_detail(
    report_id: uuid.UUID,
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db),
) -> Any:
    stmt = select(Report).where(Report.id == report_id)
    result = await db.execute(stmt)
    report = result.scalar_one_or_none()

    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found.",
        )
    return report


@router.get(
    "/reports/{report_id}/history",
    response_model=List[ModerationRecordResponse],
    status_code=status.HTTP_200_OK,
    summary="Get moderation history audit trail for a report",
)
async def get_report_moderation_history(
    report_id: uuid.UUID,
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db),
) -> Any:
    stmt = (
        select(ModerationRecord)
        .where(ModerationRecord.report_id == report_id)
        .order_by(ModerationRecord.created_at.desc())
    )
    result = await db.execute(stmt)
    records = result.scalars().all()
    return list(records)


@router.post(
    "/reports/{report_id}/review",
    response_model=AdminReportResponse,
    status_code=status.HTTP_200_OK,
    summary="Mark report as currently under active review",
)
async def start_report_review(
    report_id: uuid.UUID,
    payload: Optional[ModerationActionRequest] = None,
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db),
) -> Any:
    stmt = select(Report).where(Report.id == report_id)
    result = await db.execute(stmt)
    report = result.scalar_one_or_none()

    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found.",
        )

    if report.status == ReportStatus.DRAFT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot review an unsubmitted draft report.",
        )

    report.status = ReportStatus.UNDER_REVIEW

    record = ModerationRecord(
        report_id=report.id,
        admin_id=current_admin.id,
        action=ModerationAction.STARTED_REVIEW,
        user_message=payload.user_message if payload else None,
        internal_notes=payload.internal_notes if payload else None,
    )
    db.add(record)
    await db.flush()

    await notify_report_owner(
        db=db,
        report=report,
        notification_type=NotificationType.REPORT_UNDER_REVIEW,
        title="Incident Under Review",
        message=f"Your incident report '{report.title}' is now being reviewed by moderators.",
    )

    await db.commit()
    await db.refresh(report)
    return report


@router.post(
    "/reports/{report_id}/approve",
    response_model=AdminReportResponse,
    status_code=status.HTTP_200_OK,
    summary="Approve a moderated report for platform verification",
)
async def approve_report(
    report_id: uuid.UUID,
    payload: Optional[ModerationActionRequest] = None,
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db),
) -> Any:
    stmt = select(Report).where(Report.id == report_id)
    result = await db.execute(stmt)
    report = result.scalar_one_or_none()

    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found.",
        )

    if report.status == ReportStatus.DRAFT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot approve an unsubmitted draft report.",
        )

    report.status = ReportStatus.APPROVED

    record = ModerationRecord(
        report_id=report.id,
        admin_id=current_admin.id,
        action=ModerationAction.APPROVED,
        user_message=payload.user_message if payload else None,
        internal_notes=payload.internal_notes if payload else None,
    )
    db.add(record)
    await db.flush()

    await notify_report_owner(
        db=db,
        report=report,
        notification_type=NotificationType.REPORT_APPROVED,
        title="Incident Report Approved",
        message=f"Your incident report '{report.title}' has been approved and published to the public news feed.",
    )

    await db.commit()
    await db.refresh(report)
    return report


@router.post(
    "/reports/{report_id}/reject",
    response_model=AdminReportResponse,
    status_code=status.HTTP_200_OK,
    summary="Reject an incident report",
)
async def reject_report(
    report_id: uuid.UUID,
    payload: Optional[ModerationActionRequest] = None,
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db),
) -> Any:
    stmt = select(Report).where(Report.id == report_id)
    result = await db.execute(stmt)
    report = result.scalar_one_or_none()

    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found.",
        )

    if report.status == ReportStatus.DRAFT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot reject an unsubmitted draft report.",
        )

    report.status = ReportStatus.REJECTED

    record = ModerationRecord(
        report_id=report.id,
        admin_id=current_admin.id,
        action=ModerationAction.REJECTED,
        user_message=payload.user_message if payload else None,
        internal_notes=payload.internal_notes if payload else None,
    )
    db.add(record)
    await db.flush()

    msg_reason = f": {payload.user_message}" if payload and payload.user_message else "."
    await notify_report_owner(
        db=db,
        report=report,
        notification_type=NotificationType.REPORT_REJECTED,
        title="Incident Report Rejected",
        message=f"Your incident report '{report.title}' was reviewed and rejected{msg_reason}",
    )

    await db.commit()
    await db.refresh(report)
    return report


@router.post(
    "/reports/{report_id}/request-information",
    response_model=AdminReportResponse,
    status_code=status.HTTP_200_OK,
    summary="Request additional information from the report author",
)
async def request_more_information(
    report_id: uuid.UUID,
    payload: ModerationActionRequest,
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db),
) -> Any:
    if not payload.user_message or not payload.user_message.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="A user-facing explanation message is required when requesting more information.",
        )

    stmt = select(Report).where(Report.id == report_id)
    result = await db.execute(stmt)
    report = result.scalar_one_or_none()

    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found.",
        )

    if report.status == ReportStatus.DRAFT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot request information on an unsubmitted draft report.",
        )

    report.status = ReportStatus.NEEDS_MORE_INFORMATION

    record = ModerationRecord(
        report_id=report.id,
        admin_id=current_admin.id,
        action=ModerationAction.REQUESTED_INFORMATION,
        user_message=payload.user_message.strip(),
        internal_notes=payload.internal_notes.strip() if payload.internal_notes else None,
    )
    db.add(record)
    await db.flush()

    await notify_report_owner(
        db=db,
        report=report,
        notification_type=NotificationType.REPORT_NEEDS_MORE_INFORMATION,
        title="Additional Information Needed",
        message=f"Moderators requested more information for '{report.title}': {payload.user_message.strip()}",
    )

    await db.commit()
    await db.refresh(report)
    return report


@router.post(
    "/reports/{report_id}/archive",
    response_model=AdminReportResponse,
    status_code=status.HTTP_200_OK,
    summary="Archive an incident report",
)
async def archive_report(
    report_id: uuid.UUID,
    payload: Optional[ModerationActionRequest] = None,
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db),
) -> Any:
    stmt = select(Report).where(Report.id == report_id)
    result = await db.execute(stmt)
    report = result.scalar_one_or_none()

    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found.",
        )

    report.status = ReportStatus.ARCHIVED

    record = ModerationRecord(
        report_id=report.id,
        admin_id=current_admin.id,
        action=ModerationAction.ARCHIVED,
        user_message=payload.user_message if payload else None,
        internal_notes=payload.internal_notes if payload else None,
    )
    db.add(record)
    await db.flush()

    await notify_report_owner(
        db=db,
        report=report,
        notification_type=NotificationType.REPORT_ARCHIVED,
        title="Incident Report Archived",
        message=f"Your incident report '{report.title}' has been moved to the platform archives.",
    )

    await db.commit()
    await db.refresh(report)
    return report


# ==============================================================================
# 3. USER MANAGEMENT
# ==============================================================================

@router.get(
    "/users",
    response_model=AdminUserPagination,
    status_code=status.HTTP_200_OK,
    summary="List, search, and paginate registered platform users",
)
async def list_admin_users(
    search: Optional[str] = Query(None, min_length=1),
    role: Optional[UserRole] = Query(None),
    is_active: Optional[bool] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db),
) -> Any:
    conditions = []
    if role:
        conditions.append(User.role == role)
    if is_active is not None:
        conditions.append(User.is_active == is_active)
    if search:
        search_pattern = f"%{search.strip()}%"
        conditions.append(
            or_(
                User.username.ilike(search_pattern),
                User.email.ilike(search_pattern),
                User.full_name.ilike(search_pattern),
            )
        )

    where_clause = and_(*conditions) if conditions else True

    # Count
    total = await db.scalar(select(func.count(User.id)).where(where_clause)) or 0

    # Fetch users
    stmt = (
        select(User)
        .where(where_clause)
        .order_by(User.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(stmt)
    users = result.scalars().all()

    # Get report counts efficiently for these users
    user_ids = [u.id for u in users]
    counts_map = {}
    if user_ids:
        c_stmt = (
            select(Report.user_id, func.count(Report.id))
            .where(Report.user_id.in_(user_ids))
            .group_by(Report.user_id)
        )
        c_res = await db.execute(c_stmt)
        for uid, count in c_res.all():
            counts_map[uid] = count

    items = [
        AdminUserResponse(
            id=u.id,
            email=u.email,
            username=u.username,
            full_name=u.full_name,
            role=u.role,
            is_active=u.is_active,
            is_verified=u.is_verified,
            created_at=u.created_at,
            updated_at=u.updated_at,
            report_count=counts_map.get(u.id, 0),
        )
        for u in users
    ]

    return AdminUserPagination(
        items=items,
        total=total,
        limit=limit,
        offset=offset,
    )


@router.patch(
    "/users/{user_id}/role",
    response_model=AdminUserResponse,
    status_code=status.HTTP_200_OK,
    summary="Change user role (USER <-> ADMIN) with safety safeguards",
)
async def update_user_role(
    user_id: uuid.UUID,
    payload: AdminUserRoleUpdate,
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db),
) -> Any:
    # 1. Prevent self-demotion / modification
    if user_id == current_admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Administrators cannot modify their own role.",
        )

    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    target_user = result.scalar_one_or_none()

    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    # 2. If demoting an admin, ensure at least one active admin remains
    if target_user.role == UserRole.ADMIN and payload.role != UserRole.ADMIN:
        active_admins_count = await db.scalar(
            select(func.count(User.id)).where(
                User.role == UserRole.ADMIN,
                User.is_active == True,
                User.id != target_user.id,
            )
        ) or 0
        if active_admins_count < 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot demote the platform's last active administrator.",
            )

    target_user.role = payload.role
    await db.commit()
    await db.refresh(target_user)

    # Calculate report count
    rep_count = await db.scalar(select(func.count(Report.id)).where(Report.user_id == target_user.id)) or 0

    return AdminUserResponse(
        id=target_user.id,
        email=target_user.email,
        username=target_user.username,
        full_name=target_user.full_name,
        role=target_user.role,
        is_active=target_user.is_active,
        is_verified=target_user.is_verified,
        created_at=target_user.created_at,
        updated_at=target_user.updated_at,
        report_count=rep_count,
    )


@router.patch(
    "/users/{user_id}/status",
    response_model=AdminUserResponse,
    status_code=status.HTTP_200_OK,
    summary="Activate or deactivate a user account",
)
async def update_user_status(
    user_id: uuid.UUID,
    payload: AdminUserStatusUpdate,
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db),
) -> Any:
    # Prevent deactivating self if last active admin
    if user_id == current_admin.id and not payload.is_active:
        active_admins_count = await db.scalar(
            select(func.count(User.id)).where(
                User.role == UserRole.ADMIN,
                User.is_active == True,
                User.id != user_id,
            )
        ) or 0
        if active_admins_count < 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot deactivate the platform's last active administrator.",
            )

    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    target_user = result.scalar_one_or_none()

    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    target_user.is_active = payload.is_active
    await db.commit()
    await db.refresh(target_user)

    rep_count = await db.scalar(select(func.count(Report.id)).where(Report.user_id == target_user.id)) or 0

    return AdminUserResponse(
        id=target_user.id,
        email=target_user.email,
        username=target_user.username,
        full_name=target_user.full_name,
        role=target_user.role,
        is_active=target_user.is_active,
        is_verified=target_user.is_verified,
        created_at=target_user.created_at,
        updated_at=target_user.updated_at,
        report_count=rep_count,
    )


# ==============================================================================
# 4. CATEGORY MANAGEMENT
# ==============================================================================

@router.get(
    "/categories",
    response_model=List[AdminCategoryResponse],
    status_code=status.HTTP_200_OK,
    summary="List all categories with report metrics for administrative management",
)
async def list_admin_categories(
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db),
) -> Any:
    stmt = select(Category).order_by(Category.name.asc())
    result = await db.execute(stmt)
    categories = result.scalars().all()

    # Get report counts per category
    c_stmt = (
        select(Report.category_id, func.count(Report.id))
        .group_by(Report.category_id)
    )
    c_res = await db.execute(c_stmt)
    counts_map = {cid: count for cid, count in c_res.all()}

    return [
        AdminCategoryResponse(
            id=c.id,
            name=c.name,
            slug=c.slug,
            description=c.description,
            is_active=c.is_active,
            report_count=counts_map.get(c.id, 0),
            created_at=c.created_at,
            updated_at=c.updated_at,
        )
        for c in categories
    ]


@router.post(
    "/categories",
    response_model=AdminCategoryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new incident report category",
)
async def create_category(
    payload: CategoryCreate,
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db),
) -> Any:
    slug = payload.slug.strip().lower()
    if not slug:
        slug = re.sub(r"[^a-z0-9]+", "-", payload.name.strip().lower()).strip("-")

    # Check for existing slug
    stmt = select(Category).where(Category.slug == slug)
    res = await db.execute(stmt)
    if res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Category with slug '{slug}' already exists.",
        )

    category = Category(
        name=payload.name.strip(),
        slug=slug,
        description=payload.description.strip() if payload.description else None,
        is_active=payload.is_active,
    )
    db.add(category)
    await db.commit()
    await db.refresh(category)

    return AdminCategoryResponse(
        id=category.id,
        name=category.name,
        slug=category.slug,
        description=category.description,
        is_active=category.is_active,
        report_count=0,
        created_at=category.created_at,
        updated_at=category.updated_at,
    )


@router.patch(
    "/categories/{category_id}",
    response_model=AdminCategoryResponse,
    status_code=status.HTTP_200_OK,
    summary="Update category details or toggle active status",
)
async def update_category(
    category_id: uuid.UUID,
    payload: CategoryUpdate,
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db),
) -> Any:
    stmt = select(Category).where(Category.id == category_id)
    result = await db.execute(stmt)
    category = result.scalar_one_or_none()

    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found.",
        )

    if payload.name is not None:
        category.name = payload.name.strip()
    if payload.slug is not None:
        slug = payload.slug.strip().lower()
        if slug != category.slug:
            existing = await db.scalar(select(Category).where(Category.slug == slug))
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Category with slug '{slug}' already exists.",
                )
            category.slug = slug
    if payload.description is not None:
        category.description = payload.description.strip() if payload.description else None
    if payload.is_active is not None:
        category.is_active = payload.is_active

    await db.commit()
    await db.refresh(category)

    rep_count = await db.scalar(select(func.count(Report.id)).where(Report.category_id == category.id)) or 0

    return AdminCategoryResponse(
        id=category.id,
        name=category.name,
        slug=category.slug,
        description=category.description,
        is_active=category.is_active,
        report_count=rep_count,
        created_at=category.created_at,
        updated_at=category.updated_at,
    )


@router.delete(
    "/categories/{category_id}",
    status_code=status.HTTP_200_OK,
    summary="Safely deactivate or delete a category",
)
async def delete_or_deactivate_category(
    category_id: uuid.UUID,
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db),
) -> Any:
    stmt = select(Category).where(Category.id == category_id)
    result = await db.execute(stmt)
    category = result.scalar_one_or_none()

    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found.",
        )

    rep_count = await db.scalar(select(func.count(Report.id)).where(Report.category_id == category.id)) or 0
    if rep_count > 0:
        # Soft-deactivate to preserve historical reports
        category.is_active = False
        await db.commit()
        return {
            "message": f"Category '{category.name}' is referenced by {rep_count} report(s). It has been safely deactivated instead of deleted.",
            "is_active": False,
        }

    await db.delete(category)
    await db.commit()
    return {"message": f"Category '{category.name}' has been deleted.", "is_active": False}


# ==============================================================================
# 5. COMMENTS MODERATION
# ==============================================================================

@router.get(
    "/comments",
    response_model=List[AdminCommentResponse],
    status_code=status.HTTP_200_OK,
    summary="List comments for administrative moderation",
)
async def list_admin_comments(
    report_id: Optional[uuid.UUID] = Query(None),
    comment_status: Optional[CommentStatus] = Query(None),
    search: Optional[str] = Query(None, min_length=1),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db),
) -> Any:
    conditions = []
    if report_id:
        conditions.append(Comment.report_id == report_id)
    if comment_status:
        conditions.append(Comment.status == comment_status)
    if search:
        conditions.append(Comment.body.ilike(f"%{search.strip()}%"))

    stmt = select(Comment)
    if conditions:
        stmt = stmt.where(and_(*conditions))

    stmt = stmt.order_by(Comment.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.patch(
    "/comments/{comment_id}/status",
    response_model=AdminCommentResponse,
    status_code=status.HTTP_200_OK,
    summary="Update comment moderation status (VISIBLE / HIDDEN / REMOVED)",
)
async def update_comment_status(
    comment_id: uuid.UUID,
    payload: CommentStatusUpdate,
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db),
) -> Any:
    stmt = select(Comment).where(Comment.id == comment_id)
    result = await db.execute(stmt)
    comment = result.scalar_one_or_none()

    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found.",
        )

    comment.status = payload.status
    if payload.status in (CommentStatus.HIDDEN, CommentStatus.REMOVED) and comment.user_id:
        await create_notification(
            db=db,
            user_id=comment.user_id,
            notification_type=NotificationType.COMMENT_MODERATED,
            title="Comment Moderation Notice",
            message="A comment you posted was moderated by the community review team.",
            comment_id=comment.id,
            report_id=comment.report_id,
        )

    await db.commit()
    await db.refresh(comment)
    return comment


# ==============================================================================
# 6. OFFICIAL SAFETY DIRECTORY VERIFICATION & MANAGEMENT
# ==============================================================================

async def record_safety_service_audit(
    db: AsyncSession,
    service_id: uuid.UUID,
    admin_id: Optional[uuid.UUID],
    previous_status: VerificationStatus,
    new_status: VerificationStatus,
    verification_notes: Optional[str] = None,
    source: Optional[str] = None,
    source_url: Optional[str] = None,
    changed_fields: Optional[dict] = None,
) -> SafetyServiceVerificationAudit:
    """Creates an immutable verification audit record."""
    audit = SafetyServiceVerificationAudit(
        service_id=service_id,
        admin_id=admin_id,
        previous_status=previous_status,
        new_status=new_status,
        changed_fields=json.dumps(changed_fields) if changed_fields else None,
        verification_notes=verification_notes,
        source=source,
        source_url=source_url,
    )
    db.add(audit)
    return audit


def detect_safety_service_duplicates(services: List[EmergencyService]) -> List[SafetyServiceDuplicateCandidate]:
    """Detects potential duplicate service candidates without destructive merges."""
    candidates: List[SafetyServiceDuplicateCandidate] = []
    seen = set()

    for i in range(len(services)):
        for j in range(i + 1, len(services)):
            s1 = services[i]
            s2 = services[j]
            pair_key = tuple(sorted([str(s1.id), str(s2.id)]))
            if pair_key in seen:
                continue

            reason = None
            p1 = re.sub(r"\D", "", s1.phone) if s1.phone else ""
            p2 = re.sub(r"\D", "", s2.phone) if s2.phone else ""

            # Check matching phone
            if p1 and p2 and len(p1) >= 7 and len(p2) >= 7 and p1[-7:] == p2[-7:]:
                reason = f"Matching phone number ({s1.phone})"
            # Check same district + similar name
            elif s1.district.lower() == s2.district.lower():
                n1 = re.sub(r"[^a-zA-Z0-9]", "", s1.name.lower())
                n2 = re.sub(r"[^a-zA-Z0-9]", "", s2.name.lower())
                if n1 == n2 or (len(n1) > 6 and len(n2) > 6 and (n1 in n2 or n2 in n1)):
                    reason = f"Same district ({s1.district}) with highly similar name"
                elif (
                    s1.latitude is not None
                    and s1.longitude is not None
                    and s2.latitude is not None
                    and s2.longitude is not None
                    and s1.service_type == s2.service_type
                ):
                    from app.api.v1.endpoints.safety import calculate_haversine_distance
                    dist_km = calculate_haversine_distance(s1.latitude, s1.longitude, s2.latitude, s2.longitude)
                    if dist_km <= 0.3:
                        reason = f"Same service type within 300m ({int(dist_km * 1000)}m)"

            if reason:
                seen.add(pair_key)
                candidates.append(
                    SafetyServiceDuplicateCandidate(
                        service_id=s1.id,
                        service_name=s1.name,
                        district=s1.district,
                        phone=s1.phone,
                        duplicate_with_id=s2.id,
                        duplicate_with_name=s2.name,
                        duplicate_with_phone=s2.phone,
                        reason=reason,
                    )
                )

    return candidates


@router.get(
    "/safety/services/metrics",
    response_model=SafetyDirectoryMetricsResponse,
    status_code=status.HTTP_200_OK,
    summary="Get directory verification metrics for KPI cards",
)
@router.get(
    "/emergency-services/metrics",
    response_model=SafetyDirectoryMetricsResponse,
    status_code=status.HTTP_200_OK,
    include_in_schema=False,
)
async def get_admin_safety_directory_metrics(
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db),
) -> Any:
    stmt = select(EmergencyService)
    res = await db.execute(stmt)
    all_s = res.scalars().all()

    total = len(all_s)
    verified = sum(1 for s in all_s if s.verification_status == VerificationStatus.VERIFIED and s.is_active)
    unverified = sum(1 for s in all_s if s.verification_status == VerificationStatus.UNVERIFIED and s.is_active)
    needs_review = sum(1 for s in all_s if s.verification_status == VerificationStatus.NEEDS_REVIEW and s.is_active)
    outdated = sum(1 for s in all_s if s.verification_status == VerificationStatus.OUTDATED and s.is_active)
    inactive = sum(1 for s in all_s if not s.is_active or s.verification_status == VerificationStatus.INACTIVE)

    now = datetime.now(timezone.utc)
    from datetime import timedelta
    recently_verified = 0
    for s in all_s:
        if s.last_verified_at:
            lva = s.last_verified_at
            if lva.tzinfo is None:
                lva = lva.replace(tzinfo=timezone.utc)
            if (now - lva) <= timedelta(days=30):
                recently_verified += 1

    return SafetyDirectoryMetricsResponse(
        total_services=total,
        verified_count=verified,
        unverified_count=unverified,
        needs_review_count=needs_review,
        outdated_count=outdated,
        inactive_count=inactive,
        recently_verified_count=recently_verified,
    )


@router.get(
    "/safety/services/duplicates",
    response_model=List[SafetyServiceDuplicateCandidate],
    status_code=status.HTTP_200_OK,
    summary="Detect potential duplicate safety service directory records",
)
@router.get(
    "/emergency-services/duplicates",
    response_model=List[SafetyServiceDuplicateCandidate],
    status_code=status.HTTP_200_OK,
    include_in_schema=False,
)
async def get_admin_safety_service_duplicates(
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db),
) -> Any:
    stmt = select(EmergencyService).where(EmergencyService.is_active == True)
    res = await db.execute(stmt)
    services = res.scalars().all()
    return detect_safety_service_duplicates(list(services))


@router.post(
    "/safety/services/bulk-action",
    status_code=status.HTTP_200_OK,
    summary="Execute safe bulk review or deactivation (bulk verify forbidden)",
)
@router.post(
    "/emergency-services/bulk-action",
    status_code=status.HTTP_200_OK,
    include_in_schema=False,
)
async def bulk_action_safety_services(
    payload: SafetyDirectoryBulkActionRequest,
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db),
) -> Any:
    stmt = select(EmergencyService).where(EmergencyService.id.in_(payload.service_ids))
    res = await db.execute(stmt)
    services = res.scalars().all()

    updated_count = 0
    for service in services:
        prev_status = service.verification_status
        if payload.action == "NEEDS_REVIEW":
            service.verification_status = VerificationStatus.NEEDS_REVIEW
            if payload.admin_notes:
                service.verification_notes_internal = payload.admin_notes
            await record_safety_service_audit(
                db=db,
                service_id=service.id,
                admin_id=current_admin.id,
                previous_status=prev_status,
                new_status=VerificationStatus.NEEDS_REVIEW,
                verification_notes=payload.admin_notes or "Bulk marked for review",
            )
            updated_count += 1
        elif payload.action == "DEACTIVATE":
            service.is_active = False
            service.verification_status = VerificationStatus.INACTIVE
            if payload.admin_notes:
                service.verification_notes_internal = payload.admin_notes
            await record_safety_service_audit(
                db=db,
                service_id=service.id,
                admin_id=current_admin.id,
                previous_status=prev_status,
                new_status=VerificationStatus.INACTIVE,
                verification_notes=payload.admin_notes or "Bulk deactivated",
            )
            updated_count += 1

    await db.commit()
    return {"status": "ok", "updated_count": updated_count, "action": payload.action}


@router.post(
    "/safety/services/import",
    response_model=SafetyServiceImportResponse,
    status_code=status.HTTP_200_OK,
    summary="Safely batch import safety service rows into unverified queue",
)
@router.post(
    "/emergency-services/import",
    response_model=SafetyServiceImportResponse,
    status_code=status.HTTP_200_OK,
    include_in_schema=False,
)
async def import_safety_services(
    payload: SafetyServiceImportRequest,
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db),
) -> Any:
    imported_count = 0
    duplicate_count = 0
    error_count = 0
    errors: List[str] = []

    for idx, row in enumerate(payload.rows, start=1):
        try:
            # Duplicate check
            stmt = select(EmergencyService).where(
                or_(
                    and_(
                        EmergencyService.name.ilike(row.name.strip()),
                        EmergencyService.district.ilike(row.district.strip()),
                    ),
                    EmergencyService.phone == row.phone.strip(),
                )
            )
            existing = (await db.execute(stmt)).scalar_one_or_none()
            if existing:
                duplicate_count += 1
                continue

            service = EmergencyService(
                name=row.name.strip(),
                name_bn=row.name_bn.strip() if row.name_bn else None,
                service_type=row.service_type,
                division=row.division.strip() if row.division else None,
                district=row.district.strip(),
                area=row.area.strip(),
                address=row.address.strip(),
                address_bn=row.address_bn.strip() if row.address_bn else None,
                phone=row.phone.strip(),
                alternate_phone=row.alternate_phone.strip() if row.alternate_phone else None,
                latitude=row.latitude,
                longitude=row.longitude,
                source=row.source.strip() if row.source else "Official Import Dataset",
                source_url=row.source_url.strip() if row.source_url else None,
                verification_status=VerificationStatus.UNVERIFIED,
                is_active=True,
            )
            db.add(service)
            await db.flush()

            await record_safety_service_audit(
                db=db,
                service_id=service.id,
                admin_id=current_admin.id,
                previous_status=VerificationStatus.UNVERIFIED,
                new_status=VerificationStatus.UNVERIFIED,
                verification_notes="Imported via official dataset ingest",
                source=service.source,
                source_url=service.source_url,
            )
            imported_count += 1
        except Exception as e:
            error_count += 1
            errors.append(f"Row {idx} ({row.name}): {str(e)}")

    await db.commit()
    return SafetyServiceImportResponse(
        total_rows=len(payload.rows),
        imported_count=imported_count,
        duplicate_count=duplicate_count,
        error_count=error_count,
        errors=errors[:10],
    )


@router.get(
    "/emergency-services",
    response_model=AdminEmergencyServicePagination,
    status_code=status.HTTP_200_OK,
    summary="List and filter emergency services directory records",
)
@router.get(
    "/safety/services",
    response_model=AdminEmergencyServicePagination,
    status_code=status.HTTP_200_OK,
    include_in_schema=False,
)
async def list_admin_emergency_services(
    service_type: Optional[ServiceType] = Query(None),
    division: Optional[str] = Query(None),
    district: Optional[str] = Query(None),
    verification_status: Optional[VerificationStatus] = Query(None),
    is_active: Optional[bool] = Query(None),
    freshness: Optional[str] = Query(None, description="'fresh', 'outdated', or 'unverified'"),
    sort_by: Optional[str] = Query("newest", description="'newest', 'oldest', 'verification_oldest', 'verification_newest', 'district'"),
    search: Optional[str] = Query(None, min_length=1),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db),
) -> Any:
    conditions = []
    if service_type:
        conditions.append(EmergencyService.service_type == service_type)
    if division:
        conditions.append(EmergencyService.division.ilike(f"%{division.strip()}%"))
    if district:
        conditions.append(EmergencyService.district.ilike(f"%{district.strip()}%"))
    if verification_status:
        conditions.append(EmergencyService.verification_status == verification_status)
    if is_active is not None:
        conditions.append(EmergencyService.is_active == is_active)

    # Freshness filter
    if freshness:
        from datetime import timedelta
        cutoff = datetime.now(timezone.utc) - timedelta(days=settings.SAFETY_DIRECTORY_FRESHNESS_DAYS)
        if freshness == "fresh":
            conditions.append(EmergencyService.last_verified_at >= cutoff)
            conditions.append(EmergencyService.verification_status == VerificationStatus.VERIFIED)
        elif freshness == "outdated":
            conditions.append(
                or_(
                    EmergencyService.verification_status == VerificationStatus.OUTDATED,
                    and_(
                        EmergencyService.verification_status == VerificationStatus.VERIFIED,
                        EmergencyService.last_verified_at < cutoff,
                    ),
                )
            )
        elif freshness == "unverified":
            conditions.append(EmergencyService.verification_status.in_([VerificationStatus.UNVERIFIED, VerificationStatus.NEEDS_REVIEW]))

    if search:
        p = f"%{search.strip()}%"
        conditions.append(
            or_(
                EmergencyService.name.ilike(p),
                EmergencyService.area.ilike(p),
                EmergencyService.address.ilike(p),
                EmergencyService.phone.ilike(p),
            )
        )

    where_clause = and_(*conditions) if conditions else True
    total = await db.scalar(select(func.count(EmergencyService.id)).where(where_clause)) or 0

    order_expr = EmergencyService.created_at.desc()
    if sort_by == "oldest":
        order_expr = EmergencyService.created_at.asc()
    elif sort_by == "verification_oldest":
        order_expr = EmergencyService.last_verified_at.asc().nulls_first()
    elif sort_by == "verification_newest":
        order_expr = EmergencyService.last_verified_at.desc().nulls_last()
    elif sort_by == "district":
        order_expr = EmergencyService.district.asc()

    stmt = (
        select(EmergencyService)
        .where(where_clause)
        .order_by(order_expr)
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(stmt)
    services = result.scalars().all()

    return AdminEmergencyServicePagination(
        items=list(services),
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post(
    "/emergency-services",
    response_model=EmergencyServiceResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new emergency service directory entry",
)
@router.post(
    "/safety/services",
    response_model=EmergencyServiceResponse,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False,
)
async def create_admin_emergency_service(
    payload: EmergencyServiceCreate,
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db),
) -> Any:
    now = datetime.now(timezone.utc)
    is_verified = payload.verification_status == VerificationStatus.VERIFIED

    service = EmergencyService(
        name=payload.name,
        name_bn=payload.name_bn,
        service_type=payload.service_type,
        division=payload.division,
        district=payload.district,
        area=payload.area,
        address=payload.address,
        address_bn=payload.address_bn,
        phone=payload.phone,
        alternate_phone=payload.alternate_phone,
        latitude=payload.latitude,
        longitude=payload.longitude,
        source=payload.source,
        source_url=payload.source_url,
        verification_status=payload.verification_status,
        last_verified_at=now if is_verified else None,
        verified_by_admin_id=current_admin.id if is_verified else None,
        is_active=payload.is_active,
    )
    db.add(service)
    await db.flush()

    await record_safety_service_audit(
        db=db,
        service_id=service.id,
        admin_id=current_admin.id,
        previous_status=VerificationStatus.UNVERIFIED,
        new_status=service.verification_status,
        verification_notes="Service created by administrator",
        source=service.source,
        source_url=service.source_url,
    )

    await db.commit()
    await db.refresh(service)
    return service


@router.get(
    "/emergency-services/{service_id}",
    response_model=EmergencyServiceResponse,
    status_code=status.HTTP_200_OK,
    summary="Get detailed emergency service record",
)
@router.get(
    "/safety/services/{service_id}",
    response_model=EmergencyServiceResponse,
    status_code=status.HTTP_200_OK,
    include_in_schema=False,
)
async def get_admin_emergency_service(
    service_id: uuid.UUID,
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db),
) -> Any:
    stmt = select(EmergencyService).where(EmergencyService.id == service_id)
    result = await db.execute(stmt)
    service = result.scalar_one_or_none()
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Emergency service record not found.",
        )
    return service


@router.put(
    "/emergency-services/{service_id}",
    response_model=EmergencyServiceResponse,
    status_code=status.HTTP_200_OK,
    summary="Update emergency service directory entry",
)
@router.patch(
    "/safety/services/{service_id}",
    response_model=EmergencyServiceResponse,
    status_code=status.HTTP_200_OK,
    include_in_schema=False,
)
async def update_admin_emergency_service(
    service_id: uuid.UUID,
    payload: EmergencyServiceUpdate,
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db),
) -> Any:
    stmt = select(EmergencyService).where(EmergencyService.id == service_id)
    result = await db.execute(stmt)
    service = result.scalar_one_or_none()
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Emergency service record not found.",
        )

    prev_status = service.verification_status
    update_data = payload.model_dump(exclude_unset=True)
    changed_fields = {}

    critical_fields = {"phone", "address", "latitude", "longitude", "source"}
    critical_changed = False

    for field, value in update_data.items():
        old_val = getattr(service, field, None)
        if old_val != value:
            changed_fields[field] = {"old": str(old_val), "new": str(value)}
            if field in critical_fields:
                critical_changed = True
            setattr(service, field, value)

    # If critical information like phone changed on a verified record, flag for review
    if critical_changed and service.verification_status == VerificationStatus.VERIFIED:
        service.verification_status = VerificationStatus.NEEDS_REVIEW

    if changed_fields:
        await record_safety_service_audit(
            db=db,
            service_id=service.id,
            admin_id=current_admin.id,
            previous_status=prev_status,
            new_status=service.verification_status,
            verification_notes="Service details edited by administrator",
            changed_fields=changed_fields,
            source=service.source,
            source_url=service.source_url,
        )

    await db.commit()
    await db.refresh(service)
    return service


@router.post(
    "/safety/services/{service_id}/verify",
    response_model=EmergencyServiceResponse,
    status_code=status.HTTP_200_OK,
    summary="Admin verify safety service with official source information",
)
@router.post(
    "/emergency-services/{service_id}/verify",
    response_model=EmergencyServiceResponse,
    status_code=status.HTTP_200_OK,
    include_in_schema=False,
)
async def verify_admin_safety_service(
    service_id: uuid.UUID,
    payload: SafetyServiceVerifyRequest,
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db),
) -> Any:
    stmt = select(EmergencyService).where(EmergencyService.id == service_id)
    service = (await db.execute(stmt)).scalar_one_or_none()
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Emergency service record not found.",
        )

    prev_status = service.verification_status
    now = datetime.now(timezone.utc)

    service.verification_status = VerificationStatus.VERIFIED
    service.last_verified_at = now
    service.verified_by_admin_id = current_admin.id
    service.source = payload.source.strip()
    if payload.source_url is not None:
        service.source_url = payload.source_url.strip() or None
    if payload.verification_notes is not None:
        service.verification_notes_internal = payload.verification_notes.strip() or None
    service.is_active = True

    await record_safety_service_audit(
        db=db,
        service_id=service.id,
        admin_id=current_admin.id,
        previous_status=prev_status,
        new_status=VerificationStatus.VERIFIED,
        verification_notes=payload.verification_notes,
        source=service.source,
        source_url=service.source_url,
    )

    await db.commit()
    await db.refresh(service)
    return service


@router.post(
    "/safety/services/{service_id}/needs-review",
    response_model=EmergencyServiceResponse,
    status_code=status.HTTP_200_OK,
    summary="Mark safety service as requiring review",
)
@router.post(
    "/emergency-services/{service_id}/needs-review",
    response_model=EmergencyServiceResponse,
    status_code=status.HTTP_200_OK,
    include_in_schema=False,
)
async def mark_safety_service_needs_review(
    service_id: uuid.UUID,
    payload: SafetyServiceReviewRequest,
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db),
) -> Any:
    stmt = select(EmergencyService).where(EmergencyService.id == service_id)
    service = (await db.execute(stmt)).scalar_one_or_none()
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Emergency service record not found.",
        )

    prev_status = service.verification_status
    service.verification_status = VerificationStatus.NEEDS_REVIEW
    service.verification_notes_internal = payload.verification_notes.strip()

    await record_safety_service_audit(
        db=db,
        service_id=service.id,
        admin_id=current_admin.id,
        previous_status=prev_status,
        new_status=VerificationStatus.NEEDS_REVIEW,
        verification_notes=payload.verification_notes,
    )

    await db.commit()
    await db.refresh(service)
    return service


@router.post(
    "/safety/services/{service_id}/mark-outdated",
    response_model=EmergencyServiceResponse,
    status_code=status.HTTP_200_OK,
    summary="Mark safety service as outdated",
)
@router.post(
    "/emergency-services/{service_id}/mark-outdated",
    response_model=EmergencyServiceResponse,
    status_code=status.HTTP_200_OK,
    include_in_schema=False,
)
async def mark_safety_service_outdated(
    service_id: uuid.UUID,
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db),
) -> Any:
    stmt = select(EmergencyService).where(EmergencyService.id == service_id)
    service = (await db.execute(stmt)).scalar_one_or_none()
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Emergency service record not found.",
        )

    prev_status = service.verification_status
    service.verification_status = VerificationStatus.OUTDATED

    await record_safety_service_audit(
        db=db,
        service_id=service.id,
        admin_id=current_admin.id,
        previous_status=prev_status,
        new_status=VerificationStatus.OUTDATED,
        verification_notes="Marked as outdated by administrator",
    )

    await db.commit()
    await db.refresh(service)
    return service


@router.post(
    "/safety/services/{service_id}/deactivate",
    response_model=EmergencyServiceResponse,
    status_code=status.HTTP_200_OK,
    summary="Deactivate safety service directory entry",
)
@router.post(
    "/emergency-services/{service_id}/deactivate",
    response_model=EmergencyServiceResponse,
    status_code=status.HTTP_200_OK,
    include_in_schema=False,
)
async def deactivate_safety_service(
    service_id: uuid.UUID,
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db),
) -> Any:
    stmt = select(EmergencyService).where(EmergencyService.id == service_id)
    service = (await db.execute(stmt)).scalar_one_or_none()
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Emergency service record not found.",
        )

    prev_status = service.verification_status
    service.is_active = False
    service.verification_status = VerificationStatus.INACTIVE

    await record_safety_service_audit(
        db=db,
        service_id=service.id,
        admin_id=current_admin.id,
        previous_status=prev_status,
        new_status=VerificationStatus.INACTIVE,
        verification_notes="Service deactivated",
    )

    await db.commit()
    await db.refresh(service)
    return service


@router.post(
    "/safety/services/{service_id}/reactivate",
    response_model=EmergencyServiceResponse,
    status_code=status.HTTP_200_OK,
    summary="Reactivate safety service for verification",
)
@router.post(
    "/emergency-services/{service_id}/reactivate",
    response_model=EmergencyServiceResponse,
    status_code=status.HTTP_200_OK,
    include_in_schema=False,
)
async def reactivate_safety_service(
    service_id: uuid.UUID,
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db),
) -> Any:
    stmt = select(EmergencyService).where(EmergencyService.id == service_id)
    service = (await db.execute(stmt)).scalar_one_or_none()
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Emergency service record not found.",
        )

    prev_status = service.verification_status
    service.is_active = True
    service.verification_status = VerificationStatus.PENDING_VERIFICATION

    await record_safety_service_audit(
        db=db,
        service_id=service.id,
        admin_id=current_admin.id,
        previous_status=prev_status,
        new_status=VerificationStatus.PENDING_VERIFICATION,
        verification_notes="Service reactivated for verification",
    )

    await db.commit()
    await db.refresh(service)
    return service


@router.delete(
    "/emergency-services/{service_id}",
    response_model=EmergencyServiceResponse,
    status_code=status.HTTP_200_OK,
    summary="Soft-delete or toggle active status of emergency service",
)
async def delete_admin_emergency_service(
    service_id: uuid.UUID,
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db),
) -> Any:
    stmt = select(EmergencyService).where(EmergencyService.id == service_id)
    result = await db.execute(stmt)
    service = result.scalar_one_or_none()
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Emergency service record not found.",
        )

    prev_status = service.verification_status
    service.is_active = False
    service.verification_status = VerificationStatus.INACTIVE

    await record_safety_service_audit(
        db=db,
        service_id=service.id,
        admin_id=current_admin.id,
        previous_status=prev_status,
        new_status=VerificationStatus.INACTIVE,
        verification_notes="Service soft-deleted / deactivated via DELETE endpoint",
    )

    await db.commit()
    await db.refresh(service)
    return service


@router.get(
    "/safety/services/{service_id}/history",
    response_model=List[SafetyServiceVerificationAuditResponse],
    status_code=status.HTTP_200_OK,
    summary="Get verification audit history for a safety service",
)
@router.get(
    "/emergency-services/{service_id}/history",
    response_model=List[SafetyServiceVerificationAuditResponse],
    status_code=status.HTTP_200_OK,
    include_in_schema=False,
)
async def get_admin_safety_service_history(
    service_id: uuid.UUID,
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db),
) -> Any:
    stmt = (
        select(SafetyServiceVerificationAudit)
        .where(SafetyServiceVerificationAudit.service_id == service_id)
        .order_by(SafetyServiceVerificationAudit.created_at.desc())
    )
    result = await db.execute(stmt)
    audits = result.scalars().all()
    return list(audits)



# ==============================================================================
# 7. MISSING PERSON ALERT NETWORK MODERATION & ACTIVATION
# ==============================================================================

@router.get(
    "/missing-person/alerts",
    response_model=AdminMissingPersonAlertPagination,
    status_code=status.HTTP_200_OK,
    summary="List all missing person alerts for admin moderation",
)
async def list_admin_missing_person_alerts(
    alert_status: Optional[AlertStatus] = Query(None),
    search: Optional[str] = Query(None, min_length=1),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db),
) -> Any:
    stmt = (
        select(MissingPersonAlert)
        .join(MissingPersonProfile, MissingPersonProfile.report_id == MissingPersonAlert.report_id)
    )
    if alert_status:
        stmt = stmt.where(MissingPersonAlert.status == alert_status)
    if search:
        p = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                MissingPersonProfile.full_name.ilike(p),
                MissingPersonProfile.last_seen_location.ilike(p),
                MissingPersonProfile.contact_information.ilike(p),
            )
        )

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.scalar(count_stmt)) or 0

    stmt = stmt.order_by(MissingPersonAlert.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(stmt)
    alerts = result.scalars().all()

    items = []
    for alert in alerts:
        prof_stmt = select(MissingPersonProfile).where(MissingPersonProfile.report_id == alert.report_id)
        prof_res = await db.execute(prof_stmt)
        profile = prof_res.scalar_one_or_none()
        if not profile:
            continue

        # Count total and pending sightings
        total_sightings_stmt = select(func.count(MissingPersonSighting.id)).where(
            MissingPersonSighting.alert_id == alert.id
        )
        total_sightings = (await db.scalar(total_sightings_stmt)) or 0

        pending_sightings_stmt = select(func.count(MissingPersonSighting.id)).where(
            and_(
                MissingPersonSighting.alert_id == alert.id,
                MissingPersonSighting.status == SightingStatus.PENDING,
            )
        )
        pending_sightings = (await db.scalar(pending_sightings_stmt)) or 0

        # Check duplicate candidates
        dup_count = await check_duplicate_missing_person_candidates(
            db, profile.full_name, profile.age, exclude_profile_id=profile.id
        )

        items.append(
            AdminMissingPersonAlertResponse(
                id=alert.id,
                report_id=alert.report_id,
                status=alert.status,
                is_active=alert.is_active,
                alert_radius_km=alert.alert_radius_km,
                alert_expiry=alert.alert_expiry,
                activated_at=alert.activated_at,
                found_at=alert.found_at,
                activated_by_admin_id=alert.activated_by_admin_id,
                activation_notes=alert.activation_notes,
                found_by_admin_id=alert.found_by_admin_id,
                found_notes=alert.found_notes,
                profile=MissingPersonProfileResponse.model_validate(profile),
                approved_sightings=[],
                approved_sightings_count=total_sightings - pending_sightings,
                total_sightings_count=total_sightings,
                pending_sightings_count=pending_sightings,
                duplicate_candidates_count=dup_count,
                created_at=alert.created_at,
            )
        )

    return AdminMissingPersonAlertPagination(
        items=items,
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post(
    "/missing-person/alerts/{alert_id}/activate",
    response_model=AdminMissingPersonAlertResponse,
    status_code=status.HTTP_200_OK,
    summary="Explicitly activate a missing person alert and dispatch radius-based notifications",
)
async def activate_missing_person_alert(
    alert_id: uuid.UUID,
    payload: MissingPersonAlertActivateRequest,
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db),
) -> Any:
    stmt = select(MissingPersonAlert).where(MissingPersonAlert.id == alert_id)
    res = await db.execute(stmt)
    alert = res.scalar_one_or_none()
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Missing person alert not found.",
        )

    prof_stmt = select(MissingPersonProfile).where(MissingPersonProfile.report_id == alert.report_id)
    prof_res = await db.execute(prof_stmt)
    profile = prof_res.scalar_one_or_none()
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Missing person profile not found.",
        )

    # Calculate expiry
    from datetime import timedelta
    now = datetime.now(timezone.utc)
    expiry = now + timedelta(days=payload.alert_expiry_days or 30)

    # Update alert record
    alert.status = AlertStatus.ALERT_ACTIVE
    alert.is_active = True
    alert.alert_radius_km = payload.alert_radius_km
    alert.alert_expiry = expiry
    alert.activated_by_admin_id = current_admin.id
    alert.activated_at = now
    alert.activation_notes = payload.activation_notes

    # Update associated report status to APPROVED so it is visible in public feeds
    rep_stmt = select(Report).where(Report.id == alert.report_id)
    rep_res = await db.execute(rep_stmt)
    report = rep_res.scalar_one_or_none()
    if report and report.status != ReportStatus.APPROVED:
        report.status = ReportStatus.APPROVED

    await db.commit()
    await db.refresh(alert)

    # Dispatch geotargeted deduplicated notifications
    await dispatch_missing_person_alert_notifications(db, alert, profile)

    return AdminMissingPersonAlertResponse(
        id=alert.id,
        report_id=alert.report_id,
        status=alert.status,
        is_active=alert.is_active,
        alert_radius_km=alert.alert_radius_km,
        alert_expiry=alert.alert_expiry,
        activated_at=alert.activated_at,
        found_at=alert.found_at,
        activated_by_admin_id=alert.activated_by_admin_id,
        activation_notes=alert.activation_notes,
        found_by_admin_id=alert.found_by_admin_id,
        found_notes=alert.found_notes,
        profile=MissingPersonProfileResponse.model_validate(profile),
        created_at=alert.created_at,
    )


@router.post(
    "/missing-person/alerts/{alert_id}/found",
    response_model=AdminMissingPersonAlertResponse,
    status_code=status.HTTP_200_OK,
    summary="Mark missing person as FOUND and resolve alert",
)
async def mark_missing_person_found(
    alert_id: uuid.UUID,
    payload: MissingPersonFoundRequest,
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db),
) -> Any:
    stmt = select(MissingPersonAlert).where(MissingPersonAlert.id == alert_id)
    res = await db.execute(stmt)
    alert = res.scalar_one_or_none()
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Missing person alert not found.",
        )

    prof_stmt = select(MissingPersonProfile).where(MissingPersonProfile.report_id == alert.report_id)
    prof_res = await db.execute(prof_stmt)
    profile = prof_res.scalar_one_or_none()

    alert.status = AlertStatus.FOUND
    alert.is_active = False
    alert.found_by_admin_id = current_admin.id
    alert.found_at = datetime.now(timezone.utc)
    alert.found_notes = payload.found_notes

    await db.commit()
    await db.refresh(alert)

    if profile:
        await notify_missing_person_found(db, alert, profile)

    return AdminMissingPersonAlertResponse(
        id=alert.id,
        report_id=alert.report_id,
        status=alert.status,
        is_active=alert.is_active,
        alert_radius_km=alert.alert_radius_km,
        alert_expiry=alert.alert_expiry,
        activated_at=alert.activated_at,
        found_at=alert.found_at,
        activated_by_admin_id=alert.activated_by_admin_id,
        activation_notes=alert.activation_notes,
        found_by_admin_id=alert.found_by_admin_id,
        found_notes=alert.found_notes,
        profile=MissingPersonProfileResponse.model_validate(profile) if profile else None,
        created_at=alert.created_at,
    )


@router.post(
    "/missing-person/alerts/{alert_id}/close",
    response_model=AdminMissingPersonAlertResponse,
    status_code=status.HTTP_200_OK,
    summary="Close missing person alert manually",
)
async def close_missing_person_alert(
    alert_id: uuid.UUID,
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db),
) -> Any:
    stmt = select(MissingPersonAlert).where(MissingPersonAlert.id == alert_id)
    res = await db.execute(stmt)
    alert = res.scalar_one_or_none()
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Missing person alert not found.",
        )

    alert.status = AlertStatus.CLOSED
    alert.is_active = False
    await db.commit()
    await db.refresh(alert)

    prof_stmt = select(MissingPersonProfile).where(MissingPersonProfile.report_id == alert.report_id)
    prof_res = await db.execute(prof_stmt)
    profile = prof_res.scalar_one_or_none()

    return AdminMissingPersonAlertResponse(
        id=alert.id,
        report_id=alert.report_id,
        status=alert.status,
        is_active=alert.is_active,
        alert_radius_km=alert.alert_radius_km,
        alert_expiry=alert.alert_expiry,
        activated_at=alert.activated_at,
        found_at=alert.found_at,
        activated_by_admin_id=alert.activated_by_admin_id,
        activation_notes=alert.activation_notes,
        found_by_admin_id=alert.found_by_admin_id,
        found_notes=alert.found_notes,
        profile=MissingPersonProfileResponse.model_validate(profile) if profile else None,
        created_at=alert.created_at,
    )


@router.get(
    "/missing-person/sightings",
    response_model=List[AdminMissingPersonSightingResponse],
    status_code=status.HTTP_200_OK,
    summary="List community sightings for moderation",
)
async def list_admin_missing_person_sightings(
    alert_id: Optional[uuid.UUID] = Query(None),
    status_filter: Optional[SightingStatus] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db),
) -> Any:
    conditions = []
    if alert_id:
        conditions.append(MissingPersonSighting.alert_id == alert_id)
    if status_filter:
        conditions.append(MissingPersonSighting.status == status_filter)

    stmt = (
        select(MissingPersonSighting)
        .where(and_(*conditions) if conditions else True)
        .order_by(MissingPersonSighting.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    res = await db.execute(stmt)
    sightings = res.scalars().all()

    # Build duplicate analysis map
    response_items = []
    for s in sightings:
        item = AdminMissingPersonSightingResponse.model_validate(s)
        # Check if other sightings exist for the same alert with similar location
        other_matches = [
            other for other in sightings
            if other.id != s.id and other.alert_id == s.alert_id and (
                other.approximate_location.lower().strip() == s.approximate_location.lower().strip()
                or (s.description and other.description and len(s.description) > 10 and s.description[:20].lower() in other.description.lower())
            )
        ]
        if other_matches:
            item.is_potential_duplicate = True
            item.duplicate_reason = f"Matches location or keywords from sighting #{str(other_matches[0].id)[:8]}"
        response_items.append(item)

    return response_items


@router.post(
    "/missing-person/sightings/{sighting_id}/moderate",
    response_model=AdminMissingPersonSightingResponse,
    status_code=status.HTTP_200_OK,
    summary="Approve or reject a community sighting",
)
async def moderate_missing_person_sighting(
    sighting_id: uuid.UUID,
    payload: AdminSightingModerationRequest,
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db),
) -> Any:
    stmt = select(MissingPersonSighting).where(MissingPersonSighting.id == sighting_id)
    res = await db.execute(stmt)
    sighting = res.scalar_one_or_none()
    if not sighting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sighting record not found.",
        )

    sighting.status = payload.status
    sighting.reviewed_by_admin_id = current_admin.id
    sighting.reviewed_at = datetime.now(timezone.utc)
    sighting.admin_notes = payload.admin_notes

    # If the submitter is an authenticated user, notify them
    if sighting.user_id:
        status_text = "অনুমোদিত হয়েছে (Approved)" if payload.status == SightingStatus.APPROVED else "প্রত্যাখ্যাত হয়েছে (Rejected)"
        await create_notification(
            db=db,
            user_id=sighting.user_id,
            notification_type=NotificationType.MISSING_PERSON_SIGHTING_REVIEWED,
            title="Sighting Review Notice / দেখার তথ্য পর্যালোচনা",
            message=f"আপনার সাবমিট করা নিখোঁজ ব্যক্তির দেখার তথ্য মডারেশন টিম দ্বারা {status_text}।",
        )

    await db.commit()
    await db.refresh(sighting)
    return AdminMissingPersonSightingResponse.model_validate(sighting)


# ==============================================================================
# 9. INCIDENT CLUSTER INTELLIGENCE & MANAGEMENT
# ==============================================================================

@router.get(
    "/clusters",
    response_model=IncidentClusterListResponse,
    status_code=status.HTTP_200_OK,
    summary="List all incident clusters with pagination and filtering",
)
async def list_admin_incident_clusters(
    search: Optional[str] = Query(None, description="Search by cluster title or area"),
    category_id: Optional[uuid.UUID] = Query(None, description="Filter by category"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db),
) -> Any:
    conditions = []
    if is_active is not None:
        conditions.append(IncidentCluster.is_active == is_active)
    if category_id:
        conditions.append(IncidentCluster.category_id == category_id)
    if search and search.strip():
        term = f"%{search.strip()}%"
        conditions.append(
            or_(
                IncidentCluster.title.ilike(term),
                IncidentCluster.area.ilike(term),
                IncidentCluster.summary.ilike(term),
            )
        )

    # Count
    count_stmt = select(func.count(IncidentCluster.id))
    if conditions:
        count_stmt = count_stmt.where(and_(*conditions))
    count_res = await db.execute(count_stmt)
    total = count_res.scalar() or 0

    # Fetch
    stmt = (
        select(IncidentCluster)
        .order_by(IncidentCluster.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    if conditions:
        stmt = stmt.where(and_(*conditions))

    result = await db.execute(stmt)
    clusters = result.scalars().all()

    items: List[IncidentClusterDetailResponse] = []
    for c in clusters:
        members_resp = [
            IncidentClusterMemberResponse(
                id=m.id,
                cluster_id=m.cluster_id,
                report_id=m.report_id,
                report_title=m.report.title if m.report else "Unknown Report",
                report_status=m.report.status.value if m.report else "UNKNOWN",
                report_category=m.report.category.name if m.report and m.report.category else "General",
                relationship_type=m.relationship_type,
                similarity_score=m.similarity_score,
                created_at=m.created_at,
            )
            for m in c.members
        ]
        items.append(
            IncidentClusterDetailResponse(
                id=c.id,
                title=c.title,
                title_bn=c.title_bn,
                category_id=c.category_id,
                category_name=c.category.name if c.category else None,
                summary=c.summary,
                summary_bn=c.summary_bn,
                approximate_latitude=c.approximate_latitude,
                approximate_longitude=c.approximate_longitude,
                area=c.area,
                is_active=c.is_active,
                member_count=len(c.members),
                members=members_resp,
                created_at=c.created_at,
                updated_at=c.updated_at,
            )
        )

    return IncidentClusterListResponse(
        items=items,
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post(
    "/clusters",
    response_model=IncidentClusterDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new incident cluster",
)
async def create_admin_incident_cluster(
    payload: IncidentClusterCreate,
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db),
) -> Any:
    cluster = IncidentCluster(
        title=payload.title.strip(),
        title_bn=payload.title_bn.strip() if payload.title_bn else None,
        category_id=payload.category_id,
        summary=payload.summary.strip() if payload.summary else None,
        summary_bn=payload.summary_bn.strip() if payload.summary_bn else None,
        approximate_latitude=payload.approximate_latitude,
        approximate_longitude=payload.approximate_longitude,
        area=payload.area.strip() if payload.area else None,
        is_active=payload.is_active,
        created_by_admin_id=current_admin.id,
    )
    db.add(cluster)
    await db.flush()

    # Link initial report IDs if provided
    if payload.initial_report_ids:
        for rep_id in payload.initial_report_ids:
            mem = IncidentClusterMember(
                cluster_id=cluster.id,
                report_id=rep_id,
                relationship_type="PRIMARY",
                added_by_admin_id=current_admin.id,
            )
            db.add(mem)

    await db.commit()
    await db.refresh(cluster)

    # Reload with relationships
    stmt = select(IncidentCluster).where(IncidentCluster.id == cluster.id)
    res = await db.execute(stmt)
    full_cluster = res.scalar_one()

    members_resp = [
        IncidentClusterMemberResponse(
            id=m.id,
            cluster_id=m.cluster_id,
            report_id=m.report_id,
            report_title=m.report.title if m.report else "Unknown Report",
            report_status=m.report.status.value if m.report else "UNKNOWN",
            report_category=m.report.category.name if m.report and m.report.category else "General",
            relationship_type=m.relationship_type,
            similarity_score=m.similarity_score,
            created_at=m.created_at,
        )
        for m in full_cluster.members
    ]

    return IncidentClusterDetailResponse(
        id=full_cluster.id,
        title=full_cluster.title,
        title_bn=full_cluster.title_bn,
        category_id=full_cluster.category_id,
        category_name=full_cluster.category.name if full_cluster.category else None,
        summary=full_cluster.summary,
        summary_bn=full_cluster.summary_bn,
        approximate_latitude=full_cluster.approximate_latitude,
        approximate_longitude=full_cluster.approximate_longitude,
        area=full_cluster.area,
        is_active=full_cluster.is_active,
        member_count=len(full_cluster.members),
        members=members_resp,
        created_at=full_cluster.created_at,
        updated_at=full_cluster.updated_at,
    )


@router.get(
    "/clusters/{cluster_id}",
    response_model=IncidentClusterDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Get single incident cluster details",
)
async def get_admin_incident_cluster(
    cluster_id: uuid.UUID,
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db),
) -> Any:
    stmt = select(IncidentCluster).where(IncidentCluster.id == cluster_id)
    res = await db.execute(stmt)
    cluster = res.scalar_one_or_none()
    if not cluster:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incident cluster not found.",
        )

    members_resp = [
        IncidentClusterMemberResponse(
            id=m.id,
            cluster_id=m.cluster_id,
            report_id=m.report_id,
            report_title=m.report.title if m.report else "Unknown Report",
            report_status=m.report.status.value if m.report else "UNKNOWN",
            report_category=m.report.category.name if m.report and m.report.category else "General",
            relationship_type=m.relationship_type,
            similarity_score=m.similarity_score,
            created_at=m.created_at,
        )
        for m in cluster.members
    ]

    return IncidentClusterDetailResponse(
        id=cluster.id,
        title=cluster.title,
        title_bn=cluster.title_bn,
        category_id=cluster.category_id,
        category_name=cluster.category.name if cluster.category else None,
        summary=cluster.summary,
        summary_bn=cluster.summary_bn,
        approximate_latitude=cluster.approximate_latitude,
        approximate_longitude=cluster.approximate_longitude,
        area=cluster.area,
        is_active=cluster.is_active,
        member_count=len(cluster.members),
        members=members_resp,
        created_at=cluster.created_at,
        updated_at=cluster.updated_at,
    )


@router.put(
    "/clusters/{cluster_id}",
    response_model=IncidentClusterDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Update an incident cluster",
)
async def update_admin_incident_cluster(
    cluster_id: uuid.UUID,
    payload: IncidentClusterUpdate,
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db),
) -> Any:
    stmt = select(IncidentCluster).where(IncidentCluster.id == cluster_id)
    res = await db.execute(stmt)
    cluster = res.scalar_one_or_none()
    if not cluster:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incident cluster not found.",
        )

    if payload.title is not None:
        cluster.title = payload.title.strip()
    if payload.title_bn is not None:
        cluster.title_bn = payload.title_bn.strip() if payload.title_bn else None
    if payload.category_id is not None:
        cluster.category_id = payload.category_id
    if payload.summary is not None:
        cluster.summary = payload.summary.strip() if payload.summary else None
    if payload.summary_bn is not None:
        cluster.summary_bn = payload.summary_bn.strip() if payload.summary_bn else None
    if payload.approximate_latitude is not None:
        cluster.approximate_latitude = payload.approximate_latitude
    if payload.approximate_longitude is not None:
        cluster.approximate_longitude = payload.approximate_longitude
    if payload.area is not None:
        cluster.area = payload.area.strip() if payload.area else None
    if payload.is_active is not None:
        cluster.is_active = payload.is_active

    await db.commit()
    await db.refresh(cluster)

    return await get_admin_incident_cluster(cluster_id=cluster_id, current_admin=current_admin, db=db)


@router.post(
    "/clusters/{cluster_id}/members",
    response_model=IncidentClusterMemberResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a report to an incident cluster",
)
async def add_member_to_incident_cluster(
    cluster_id: uuid.UUID,
    payload: IncidentClusterMemberCreate,
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db),
) -> Any:
    # Verify cluster exists
    stmt_c = select(IncidentCluster).where(IncidentCluster.id == cluster_id)
    res_c = await db.execute(stmt_c)
    cluster = res_c.scalar_one_or_none()
    if not cluster:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cluster not found.")

    # Verify report exists
    stmt_r = select(Report).where(Report.id == payload.report_id)
    res_r = await db.execute(stmt_r)
    report = res_r.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found.")

    # Check for existing membership
    stmt_m = select(IncidentClusterMember).where(
        and_(
            IncidentClusterMember.cluster_id == cluster_id,
            IncidentClusterMember.report_id == payload.report_id,
        )
    )
    res_m = await db.execute(stmt_m)
    existing_mem = res_m.scalar_one_or_none()
    if existing_mem:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Report is already a member of this incident cluster.",
        )

    # Compute similarity score with cluster centroid or first report if not provided
    score = payload.similarity_score
    if score is None and cluster.members:
        first_rep = cluster.members[0].report
        if first_rep:
            score = calculate_similarity_breakdown(report, first_rep).total_score

    member = IncidentClusterMember(
        cluster_id=cluster_id,
        report_id=payload.report_id,
        relationship_type=payload.relationship_type,
        similarity_score=score,
        added_by_admin_id=current_admin.id,
    )
    db.add(member)
    await db.commit()
    await db.refresh(member)

    return IncidentClusterMemberResponse(
        id=member.id,
        cluster_id=member.cluster_id,
        report_id=member.report_id,
        report_title=report.title,
        report_status=report.status.value,
        report_category=report.category.name if report.category else "General",
        relationship_type=member.relationship_type,
        similarity_score=member.similarity_score,
        created_at=member.created_at,
    )


@router.delete(
    "/clusters/{cluster_id}/members/{report_id}",
    status_code=status.HTTP_200_OK,
    summary="Remove a report from an incident cluster",
)
async def remove_member_from_incident_cluster(
    cluster_id: uuid.UUID,
    report_id: uuid.UUID,
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db),
) -> Any:
    stmt = select(IncidentClusterMember).where(
        and_(
            IncidentClusterMember.cluster_id == cluster_id,
            IncidentClusterMember.report_id == report_id,
        )
    )
    res = await db.execute(stmt)
    member = res.scalar_one_or_none()
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report membership in this cluster not found.",
        )

    await db.delete(member)
    await db.commit()
    return {"message": "Report successfully removed from cluster."}


@router.get(
    "/reports/{report_id}/suggested-related",
    response_model=List[SuggestedRelatedReportResponse],
    status_code=status.HTTP_200_OK,
    summary="Get suggested related reports with transparent similarity scoring breakdown",
)
async def get_admin_suggested_related_reports(
    report_id: uuid.UUID,
    min_score: float = Query(25.0, ge=0.0, le=100.0),
    limit: int = Query(10, ge=1, le=50),
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db),
) -> Any:
    stmt = select(Report).where(Report.id == report_id)
    res = await db.execute(stmt)
    report = res.scalar_one_or_none()
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found.",
        )

    return await find_suggested_related_reports(
        report=report,
        db=db,
        min_score=min_score,
        limit=limit,
    )



