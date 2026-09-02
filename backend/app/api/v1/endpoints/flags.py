import uuid
from datetime import datetime, timezone
from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_current_user, get_current_active_admin
from app.db.session import get_db
from app.models.comment import Comment, CommentStatus
from app.models.flag import ContentFlag, FlagTargetType, FlagStatus
from app.models.notification import NotificationType
from app.models.report import Report, ReportStatus
from app.models.user import User
from app.schemas.flag import (
    ReportFlagCreate,
    CommentFlagCreate,
    FlagResponse,
    AdminFlagUpdate,
    AdminFlagResponse,
    AdminFlagPagination,
)
from app.services.notification import create_notification

router = APIRouter()


@router.post(
    "/reports/{report_id}/flags",
    response_model=FlagResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit a safety or content flag for an APPROVED report",
)
async def flag_report(
    report_id: uuid.UUID,
    payload: ReportFlagCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    # 1. Enforce parent report is APPROVED
    report_stmt = select(Report).where(Report.id == report_id)
    result = await db.execute(report_stmt)
    report = result.scalar_one_or_none()

    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incident report not found.",
        )

    if report.status != ReportStatus.APPROVED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only platform-approved public reports can be flagged for review.",
        )

    # 2. Duplicate prevention
    existing_stmt = select(ContentFlag).where(
        ContentFlag.report_id == report_id,
        ContentFlag.user_id == current_user.id,
        ContentFlag.reason == payload.reason.value,
    )
    res_ex = await db.execute(existing_stmt)
    existing = res_ex.scalar_one_or_none()

    if existing:
        return FlagResponse(
            id=existing.id,
            target_type=existing.target_type,
            report_id=existing.report_id,
            comment_id=existing.comment_id,
            reason=existing.reason,
            status=existing.status,
            created_at=existing.created_at,
            message="Your flag for this issue has already been recorded and is in review.",
        )

    # 3. Create flag
    flag = ContentFlag(
        user_id=current_user.id,
        target_type=FlagTargetType.REPORT,
        report_id=report_id,
        reason=payload.reason.value,
        details=payload.details,
        status=FlagStatus.PENDING,
    )
    db.add(flag)
    await db.commit()
    await db.refresh(flag)

    return FlagResponse(
        id=flag.id,
        target_type=flag.target_type,
        report_id=flag.report_id,
        comment_id=flag.comment_id,
        reason=flag.reason,
        status=flag.status,
        created_at=flag.created_at,
        message="Thank you. Your flag has been submitted for moderation review.",
    )


@router.post(
    "/comments/{comment_id}/flags",
    response_model=FlagResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit a safety or content flag for a public comment",
)
async def flag_comment(
    comment_id: uuid.UUID,
    payload: CommentFlagCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    # 1. Enforce comment exists and is VISIBLE
    comment_stmt = select(Comment).where(Comment.id == comment_id)
    result = await db.execute(comment_stmt)
    comment = result.scalar_one_or_none()

    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found.",
        )

    if comment.status != CommentStatus.VISIBLE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Hidden or removed comments cannot be flagged.",
        )

    # 2. Enforce parent report is APPROVED
    report_stmt = select(Report).where(Report.id == comment.report_id)
    res_rep = await db.execute(report_stmt)
    report = res_rep.scalar_one_or_none()

    if not report or report.status != ReportStatus.APPROVED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Comments on unapproved reports cannot be flagged.",
        )

    # 3. Duplicate prevention
    existing_stmt = select(ContentFlag).where(
        ContentFlag.comment_id == comment_id,
        ContentFlag.user_id == current_user.id,
        ContentFlag.reason == payload.reason.value,
    )
    res_ex = await db.execute(existing_stmt)
    existing = res_ex.scalar_one_or_none()

    if existing:
        return FlagResponse(
            id=existing.id,
            target_type=existing.target_type,
            report_id=existing.report_id,
            comment_id=existing.comment_id,
            reason=existing.reason,
            status=existing.status,
            created_at=existing.created_at,
            message="Your flag for this comment has already been recorded and is in review.",
        )

    # 4. Create flag
    flag = ContentFlag(
        user_id=current_user.id,
        target_type=FlagTargetType.COMMENT,
        report_id=comment.report_id,
        comment_id=comment_id,
        reason=payload.reason.value,
        details=payload.details,
        status=FlagStatus.PENDING,
    )
    db.add(flag)
    await db.commit()
    await db.refresh(flag)

    return FlagResponse(
        id=flag.id,
        target_type=flag.target_type,
        report_id=flag.report_id,
        comment_id=flag.comment_id,
        reason=flag.reason,
        status=flag.status,
        created_at=flag.created_at,
        message="Thank you. Your flag has been submitted for moderation review.",
    )


@router.get(
    "/admin/flags",
    response_model=AdminFlagPagination,
    status_code=status.HTTP_200_OK,
    summary="List content flags for administrative moderation queue",
)
async def list_admin_flags(
    target_type: Optional[FlagTargetType] = Query(None),
    flag_status: Optional[FlagStatus] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db),
) -> Any:
    conditions = []
    if target_type:
        conditions.append(ContentFlag.target_type == target_type)
    if flag_status:
        conditions.append(ContentFlag.status == flag_status)

    where_clause = and_(*conditions) if conditions else True

    # Count
    count_stmt = select(func.count(ContentFlag.id)).where(where_clause)
    total = await db.scalar(count_stmt) or 0

    # Fetch
    stmt = (
        select(ContentFlag)
        .where(where_clause)
        .order_by(ContentFlag.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(stmt)
    flags = result.scalars().all()

    items = []
    for f in flags:
        snippet = None
        if f.target_type == FlagTargetType.REPORT and f.report:
            snippet = f.report.title
        elif f.target_type == FlagTargetType.COMMENT and f.comment:
            snippet = f.comment.body[:80]

        items.append(
            AdminFlagResponse(
                id=f.id,
                user_id=f.user_id,
                target_type=f.target_type,
                report_id=f.report_id,
                comment_id=f.comment_id,
                reason=f.reason,
                details=f.details,
                status=f.status,
                reviewed_by=f.reviewed_by,
                reviewed_at=f.reviewed_at,
                admin_notes=f.admin_notes,
                created_at=f.created_at,
                updated_at=f.updated_at,
                flagger_username=f.flagger.username if f.flagger else None,
                target_snippet=snippet,
            )
        )

    return AdminFlagPagination(
        items=items,
        total=total,
        limit=limit,
        offset=offset,
    )


@router.patch(
    "/admin/flags/{flag_id}",
    response_model=AdminFlagResponse,
    status_code=status.HTTP_200_OK,
    summary="Update content flag status and record administrative decision",
)
async def update_admin_flag(
    flag_id: uuid.UUID,
    payload: AdminFlagUpdate,
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db),
) -> Any:
    stmt = select(ContentFlag).where(ContentFlag.id == flag_id)
    result = await db.execute(stmt)
    flag = result.scalar_one_or_none()

    if not flag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Content flag not found.",
        )

    flag.status = payload.status
    if payload.admin_notes is not None:
        flag.admin_notes = payload.admin_notes
    flag.reviewed_by = current_admin.id
    flag.reviewed_at = datetime.now(timezone.utc)

    if flag.user_id:
        await create_notification(
            db=db,
            user_id=flag.user_id,
            notification_type=NotificationType.FLAG_REVIEWED,
            title="Safety Flag Reviewed",
            message=f"Your {flag.target_type.value.lower()} flag has been reviewed by the moderation team.",
            report_id=flag.report_id,
            comment_id=flag.comment_id,
        )

    await db.commit()
    await db.refresh(flag)

    snippet = None
    if flag.target_type == FlagTargetType.REPORT and flag.report:
        snippet = flag.report.title
    elif flag.target_type == FlagTargetType.COMMENT and flag.comment:
        snippet = flag.comment.body[:80]

    return AdminFlagResponse(
        id=flag.id,
        user_id=flag.user_id,
        target_type=flag.target_type,
        report_id=flag.report_id,
        comment_id=flag.comment_id,
        reason=flag.reason,
        details=flag.details,
        status=flag.status,
        reviewed_by=flag.reviewed_by,
        reviewed_at=flag.reviewed_at,
        admin_notes=flag.admin_notes,
        created_at=flag.created_at,
        updated_at=flag.updated_at,
        flagger_username=flag.flagger.username if flag.flagger else None,
        target_snippet=snippet,
    )
