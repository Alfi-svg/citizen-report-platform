import uuid
from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_optional_current_user
from app.db.session import get_db
from app.models.category import Category
from app.models.report import Report, ReportStatus
from app.models.report_media import ReportMedia
from app.models.comment import Comment, CommentStatus
from app.models.reaction import Reaction, ReactionType
from app.models.user import User
from app.schemas.public import (
    PublicReportListItem,
    PublicReportDetailResponse,
    PublicReportPagination,
    PublicCategoryResponse,
    PublicMediaResponse,
)
from app.schemas.category import CategoryResponse
from app.schemas.comment import PublicCommentResponse, CommentPagination
from app.schemas.reaction import ReactionSummaryResponse
from app.services.storage import get_storage_service

router = APIRouter()


def _format_public_report(report: Report) -> PublicReportListItem:
    """Safely constructs public report representation without leaking private metadata."""
    # Reporter identity masking
    if report.is_anonymous:
        reporter_name = "Anonymous Citizen"
    else:
        reporter_name = (
            report.user.full_name or report.user.username if report.user else "Citizen"
        )

    # Format public media items
    public_media: List[PublicMediaResponse] = []
    if report.media:
        for m in report.media:
            m_type = "document"
            if m.mime_type.startswith("image/"):
                m_type = "image"
            elif m.mime_type.startswith("video/"):
                m_type = "video"

            public_media.append(
                PublicMediaResponse(
                    id=m.id,
                    file_name=m.file_name,
                    mime_type=m.mime_type,
                    file_size=m.file_size,
                    caption=m.caption,
                    media_type=m_type,
                    download_url=f"/api/v1/public/reports/{report.id}/media/{m.id}",
                )
            )

    return PublicReportListItem(
        id=report.id,
        category_id=report.category_id,
        category=CategoryResponse.model_validate(report.category) if report.category else None,
        title=report.title,
        description=report.description,
        location_text=report.location_text,
        latitude=report.latitude,
        longitude=report.longitude,
        incident_date=report.incident_date,
        submitted_at=report.submitted_at,
        created_at=report.created_at,
        is_anonymous=report.is_anonymous,
        reporter_display_name=reporter_name,
        media=public_media,
        media_count=len(public_media),
        has_evidence=len(public_media) > 0,
        review_status="Platform Reviewed",
    )


@router.get(
    "/reports",
    response_model=PublicReportPagination,
    status_code=status.HTTP_200_OK,
    summary="Get public approved reports news feed with filters and search",
)
async def get_public_feed(
    sort: str = Query("latest", pattern="^(latest|trending)$"),
    category_id: Optional[uuid.UUID] = Query(None),
    location: Optional[str] = Query(None, min_length=1),
    q: Optional[str] = Query(None, min_length=1),
    limit: int = Query(12, ge=1, le=50),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Public News Feed of platform-approved reports.
    Strictly filters: Report.status == APPROVED at database level.
    """
    # Base mandatory condition: ONLY APPROVED
    conditions = [Report.status == ReportStatus.APPROVED]

    if category_id:
        conditions.append(Report.category_id == category_id)

    if location:
        conditions.append(Report.location_text.ilike(f"%{location.strip()}%"))

    if q:
        search_term = f"%{q.strip()}%"
        conditions.append(
            or_(
                Report.title.ilike(search_term),
                Report.description.ilike(search_term),
                Report.location_text.ilike(search_term),
            )
        )

    where_clause = and_(*conditions)

    # Total approved count
    count_stmt = select(func.count(Report.id)).where(where_clause)
    total = await db.scalar(count_stmt) or 0

    # Sorting
    if sort == "trending":
        # Trending ranks reports by verified evidence presence and recent submission date
        query_stmt = (
            select(Report)
            .outerjoin(ReportMedia, Report.id == ReportMedia.report_id)
            .where(where_clause)
            .group_by(Report.id)
            .order_by(func.count(ReportMedia.id).desc(), Report.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
    else:
        # Default: Latest reviewed reports
        query_stmt = (
            select(Report)
            .where(where_clause)
            .order_by(Report.created_at.desc())
            .limit(limit)
            .offset(offset)
        )

    result = await db.execute(query_stmt)
    reports = result.scalars().all()

    items = [_format_public_report(r) for r in reports]

    return PublicReportPagination(
        items=items,
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/reports/{report_id}",
    response_model=PublicReportDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Get single public approved report details",
)
async def get_public_report_detail(
    report_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Returns public report detail for an APPROVED report.
    Non-approved reports return 404 to avoid leaking existence.
    """
    stmt = select(Report).where(
        Report.id == report_id,
        Report.status == ReportStatus.APPROVED,
    )
    result = await db.execute(stmt)
    report = result.scalar_one_or_none()

    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Public report not found or has not been approved.",
        )

    return _format_public_report(report)


@router.get(
    "/categories",
    response_model=List[PublicCategoryResponse],
    status_code=status.HTTP_200_OK,
    summary="Get categories with count of approved reports",
)
async def get_public_categories(
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Returns list of active incident categories with total approved public reports count.
    """
    stmt = (
        select(
            Category.id,
            Category.name,
            Category.slug,
            Category.description,
            func.count(Report.id).label("approved_reports_count"),
        )
        .outerjoin(
            Report,
            and_(
                Category.id == Report.category_id,
                Report.status == ReportStatus.APPROVED,
            ),
        )
        .where(Category.is_active == True)
        .group_by(Category.id)
        .order_by(Category.name.asc())
    )
    result = await db.execute(stmt)
    rows = result.all()

    return [
        PublicCategoryResponse(
            id=row.id,
            name=row.name,
            slug=row.slug,
            description=row.description,
            approved_reports_count=row.approved_reports_count,
        )
        for row in rows
    ]


@router.get(
    "/reports/{report_id}/media/{media_id}",
    summary="Public stream access for evidence belonging to an APPROVED report",
)
async def stream_public_report_media(
    report_id: uuid.UUID,
    media_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Streams media file for approved reports only.
    Unapproved report media is rejected with 404.
    """
    # 1. Enforce parent report is APPROVED
    report_stmt = select(Report).where(
        Report.id == report_id,
        Report.status == ReportStatus.APPROVED,
    )
    res_report = await db.execute(report_stmt)
    report = res_report.scalar_one_or_none()

    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Media not found or parent report is not approved.",
        )

    # 2. Query media
    media_stmt = select(ReportMedia).where(
        ReportMedia.id == media_id,
        ReportMedia.report_id == report_id,
    )
    res_media = await db.execute(media_stmt)
    media = res_media.scalar_one_or_none()

    if not media:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evidence file not found.",
        )

    storage = get_storage_service()
    stream = storage.get_file_stream(media.storage_path)

    return StreamingResponse(
        stream,
        media_type=media.mime_type,
        headers={
            "Content-Disposition": f'inline; filename="{media.file_name}"',
            "Content-Length": str(media.file_size),
        },
    )


@router.get(
    "/reports/{report_id}/comments",
    response_model=CommentPagination,
    status_code=status.HTTP_200_OK,
    summary="Get public visible comments on an APPROVED report",
)
async def get_public_report_comments(
    report_id: uuid.UUID,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    # 1. Enforce parent report is APPROVED
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

    # 2. Total count of visible comments
    count_stmt = select(func.count(Comment.id)).where(
        Comment.report_id == report_id,
        Comment.status == CommentStatus.VISIBLE,
    )
    total = await db.scalar(count_stmt) or 0

    # 3. Fetch paginated comments
    comments_stmt = (
        select(Comment)
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
            user_display_name=c.user.full_name or c.user.username if c.user else "Citizen",
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


@router.get(
    "/reports/{report_id}/reactions",
    response_model=ReactionSummaryResponse,
    status_code=status.HTTP_200_OK,
    summary="Get reaction summary for an APPROVED report",
)
async def get_public_report_reactions(
    report_id: uuid.UUID,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    # 1. Enforce parent report is APPROVED
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

    # 2. Aggregate reaction counts
    support_stmt = select(func.count(Reaction.id)).where(
        Reaction.report_id == report_id,
        Reaction.reaction_type == ReactionType.SUPPORT,
    )
    important_stmt = select(func.count(Reaction.id)).where(
        Reaction.report_id == report_id,
        Reaction.reaction_type == ReactionType.IMPORTANT,
    )

    support_count = await db.scalar(support_stmt) or 0
    important_count = await db.scalar(important_stmt) or 0

    user_reactions: List[ReactionType] = []
    if current_user:
        user_reacts_stmt = select(Reaction.reaction_type).where(
            Reaction.report_id == report_id,
            Reaction.user_id == current_user.id,
        )
        res_user = await db.execute(user_reacts_stmt)
        user_reactions = [r[0] for r in res_user.all()]

    return ReactionSummaryResponse(
        report_id=report_id,
        support_count=support_count,
        important_count=important_count,
        user_reactions=user_reactions,
    )
