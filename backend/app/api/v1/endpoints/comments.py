import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.api.deps import get_current_user, get_optional_current_user
from app.db.session import get_db
from app.models.comment import Comment, CommentStatus
from app.models.report import Report, ReportStatus
from app.models.user import User, UserRole
from app.schemas.comment import CommentCreate, PublicCommentResponse, CommentPagination

router = APIRouter()


@router.post(
    "/reports/{report_id}/comments",
    response_model=PublicCommentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new comment on an APPROVED report",
)
@router.post(
    "/public/reports/{report_id}/comments",
    response_model=PublicCommentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new comment on an APPROVED report (public route)",
)
async def create_comment(
    report_id: uuid.UUID,
    payload: CommentCreate,
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
            detail="Comments are only permitted on platform-approved reports.",
        )

    # 2. Anti-spam duplicate check (prevent identical message within 10 seconds)
    recent_threshold = datetime.now(timezone.utc) - timedelta(seconds=10)
    spam_stmt = select(Comment).where(
        Comment.report_id == report_id,
        Comment.user_id == current_user.id,
        Comment.body == payload.body,
        Comment.created_at >= recent_threshold,
    )
    res_spam = await db.execute(spam_stmt)
    if res_spam.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Duplicate comment detected. Please wait before submitting again.",
        )

    # 3. Create comment
    comment = Comment(
        report_id=report_id,
        user_id=current_user.id,
        body=payload.body,
        status=CommentStatus.VISIBLE,
    )
    db.add(comment)
    await db.commit()
    await db.refresh(comment)

    return PublicCommentResponse(
        id=comment.id,
        report_id=comment.report_id,
        body=comment.body,
        status=comment.status,
        created_at=comment.created_at,
        user_display_name=current_user.full_name or current_user.username,
        is_own_comment=True,
    )


@router.get(
    "/reports/{report_id}/comments",
    response_model=CommentPagination,
    status_code=status.HTTP_200_OK,
    summary="Get public visible comments on an APPROVED report",
)
@router.get(
    "/public/reports/{report_id}/comments",
    response_model=CommentPagination,
    status_code=status.HTTP_200_OK,
    summary="Get public visible comments on an APPROVED report (public route)",
)
async def get_report_comments(
    report_id: uuid.UUID,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    report_stmt = select(Report).where(
        Report.id == report_id,
        Report.status == ReportStatus.APPROVED,
    )
    res_report = await db.execute(report_stmt)
    report = res_report.scalar_one_or_none()

    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Public report not found or has not been approved.",
        )

    count_stmt = select(func.count(Comment.id)).where(
        Comment.report_id == report_id,
        Comment.status == CommentStatus.VISIBLE,
    )
    total = await db.scalar(count_stmt) or 0

    comments_stmt = (
        select(Comment)
        .options(selectinload(Comment.user))
        .where(
            Comment.report_id == report_id,
            Comment.status == CommentStatus.VISIBLE,
        )
        .order_by(Comment.created_at.asc())
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(comments_stmt)
    comments = result.scalars().all()

    items = [
        PublicCommentResponse(
            id=c.id,
            report_id=c.report_id,
            body=c.body,
            status=c.status,
            created_at=c.created_at,
            user_display_name=((c.user.full_name or c.user.username) if c.user else "Citizen"),
            is_own_comment=(current_user is not None and c.user_id == current_user.id),
        )
        for c in comments
    ]

    return CommentPagination(
        items=items,
        total=total,
        limit=limit,
        offset=offset,
    )


@router.delete(
    "/comments/{comment_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete own comment or remove comment as admin",
)
async def delete_comment(
    comment_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
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

    # Permission check: author or active admin
    if comment.user_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete this comment.",
        )

    await db.delete(comment)
    await db.commit()

    return {"message": "Comment deleted successfully."}
