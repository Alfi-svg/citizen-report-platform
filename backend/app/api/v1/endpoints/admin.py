import uuid
from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_current_active_admin
from app.db.session import get_db
from app.models.notification import NotificationType
from app.models.moderation import ModerationRecord, ModerationAction
from app.models.report import Report, ReportStatus
from app.models.comment import Comment, CommentStatus
from app.models.user import User
from app.schemas.moderation import (
    AdminDashboardStats,
    ModerationActionRequest,
)
from app.schemas.report import (
    AdminReportResponse,
    AdminReportPagination,
)
from app.schemas.comment import AdminCommentResponse, CommentStatusUpdate
from app.services.notification import notify_report_owner, create_notification

router = APIRouter()


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
    )


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
    """
    Returns paginated incident reports with optional filtering by status, category, anonymous flag, or title.
    """
    conditions = []
    if status_filter:
        conditions.append(Report.status == status_filter)
    if category_id:
        conditions.append(Report.category_id == category_id)
    if is_anonymous is not None:
        conditions.append(Report.is_anonymous == is_anonymous)
    if search:
        conditions.append(Report.title.ilike(f"%{search.strip()}%"))

    where_clause = and_(*conditions) if conditions else True

    # Count total matching
    count_stmt = select(func.count(Report.id)).where(where_clause)
    total = await db.scalar(count_stmt) or 0

    # Query paginated rows
    query_stmt = (
        select(Report)
        .where(where_clause)
        .order_by(Report.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(query_stmt)
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
    summary="Get detailed moderation report view with full audit history",
)
async def get_admin_report_detail(
    report_id: uuid.UUID,
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Returns complete report details including reporter profile and moderation history.
    """
    stmt = select(Report).where(Report.id == report_id)
    result = await db.execute(stmt)
    report = result.scalar_one_or_none()

    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found.",
        )

    return report


@router.post(
    "/reports/{report_id}/review",
    response_model=AdminReportResponse,
    status_code=status.HTTP_200_OK,
    summary="Start reviewing a submitted report",
)
async def start_report_review(
    report_id: uuid.UUID,
    payload: Optional[ModerationActionRequest] = None,
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Transitions report status to UNDER_REVIEW and logs the moderation event.
    """
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
    """
    Approves the report, making it eligible for future platform publication.
    Logs moderation record with administrator ID.
    """
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
    """
    Rejects the report with optional user explanation and private internal notes.
    """
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
    """
    Transitions report status to NEEDS_MORE_INFORMATION and sends user-facing guidance.
    """
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


@router.get(
    "/comments",
    response_model=list[AdminCommentResponse],
    status_code=status.HTTP_200_OK,
    summary="List comments for administrative moderation",
)
async def list_admin_comments(
    report_id: Optional[uuid.UUID] = Query(None),
    comment_status: Optional[CommentStatus] = Query(None),
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
