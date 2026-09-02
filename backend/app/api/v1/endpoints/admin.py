import re
import uuid
from typing import Any, Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, and_, or_, delete
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_current_active_admin
from app.db.session import get_db
from app.models.notification import NotificationType
from app.models.moderation import ModerationRecord, ModerationAction
from app.models.report import Report, ReportStatus
from app.models.comment import Comment, CommentStatus
from app.models.flag import ContentFlag, FlagStatus
from app.models.category import Category
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
from app.services.notification import notify_report_owner, create_notification

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
