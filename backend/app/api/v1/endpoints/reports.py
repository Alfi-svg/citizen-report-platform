import uuid
from datetime import datetime, timezone
from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_current_user
from app.core.config import settings
from app.core.storage_validation import (
    validate_upload_file,
    generate_storage_path,
)
from app.db.session import get_db
from app.models.category import Category
from app.models.report import Report, ReportStatus
from app.models.report_media import ReportMedia
from app.models.notification import NotificationType
from app.models.user import User, UserRole
from app.schemas.report import ReportCreate, ReportUpdate, ReportResponse
from app.schemas.report_media import ReportMediaResponse
from app.services.notification import create_notification
from app.services.storage import get_storage_service

router = APIRouter()


@router.post(
    "",
    response_model=ReportResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new report (Draft or Submit)",
)
async def create_report(
    report_in: ReportCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Creates a new citizen incident report.
    - Owner is strictly inferred from the authenticated JWT token.
    - Validates category existence.
    - Supports saving as DRAFT or direct SUBMITTED state.
    - Sets submitted_at if submitted.
    """
    cat_stmt = select(Category).where(
        Category.id == report_in.category_id,
        Category.is_active == True,
    )
    cat_res = await db.execute(cat_stmt)
    category = cat_res.scalar_one_or_none()
    if not category:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The selected category does not exist or is inactive.",
        )

    initial_status = report_in.status or ReportStatus.DRAFT
    submitted_at = datetime.now(timezone.utc) if initial_status == ReportStatus.SUBMITTED else None

    lat = report_in.latitude
    lng = report_in.longitude
    if (lat is None or lng is None) and report_in.location_text:
        from app.api.v1.endpoints.missing_person import resolve_bd_coordinates
        lat, lng = resolve_bd_coordinates(report_in.location_text)

    report = Report(
        user_id=current_user.id,
        category_id=report_in.category_id,
        title=report_in.title,
        description=report_in.description,
        location_text=report_in.location_text,
        latitude=lat,
        longitude=lng,
        incident_date=report_in.incident_date,
        is_anonymous=report_in.is_anonymous,
        status=initial_status,
        submitted_at=submitted_at,
    )
    db.add(report)
    await db.flush()

    if initial_status == ReportStatus.SUBMITTED:
        await create_notification(
            db=db,
            user_id=current_user.id,
            notification_type=NotificationType.REPORT_SUBMITTED,
            title="Incident Report Submitted",
            message=f"Your incident report '{report.title}' has been submitted for moderation review.",
            report_id=report.id,
        )

    await db.commit()
    await db.refresh(report)

    return report


@router.get(
    "/mine",
    response_model=List[ReportResponse],
    status_code=status.HTTP_200_OK,
    summary="List all reports created by the current authenticated user",
)
async def get_my_reports(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Returns all reports (drafts and submitted) created by the authenticated user.
    """
    stmt = (
        select(Report)
        .where(Report.user_id == current_user.id)
        .order_by(Report.created_at.desc())
    )
    result = await db.execute(stmt)
    reports = result.scalars().all()
    return list(reports)


@router.get(
    "/{report_id}",
    response_model=ReportResponse,
    status_code=status.HTTP_200_OK,
    summary="Get details of a specific report",
)
async def get_report_by_id(
    report_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Returns details of a specific report.
    - Owner or Administrator access only.
    """
    stmt = select(Report).where(Report.id == report_id)
    result = await db.execute(stmt)
    report = result.scalar_one_or_none()

    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found.",
        )

    if report.user_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to view this report.",
        )

    return report


@router.patch(
    "/{report_id}",
    response_model=ReportResponse,
    status_code=status.HTTP_200_OK,
    summary="Update an existing report draft",
)
async def update_report(
    report_id: uuid.UUID,
    report_in: ReportUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Updates an existing report.
    - Only allowed if report is in DRAFT or NEEDS_MORE_INFORMATION status.
    - Only the report owner can edit their report.
    """
    stmt = select(Report).where(Report.id == report_id)
    result = await db.execute(stmt)
    report = result.scalar_one_or_none()

    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found.",
        )

    if report.user_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to modify this report.",
        )

    if report.status not in (ReportStatus.DRAFT, ReportStatus.NEEDS_MORE_INFORMATION):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Reports in '{report.status.value}' status cannot be edited.",
        )

    if report_in.category_id is not None and report_in.category_id != report.category_id:
        cat_stmt = select(Category).where(
            Category.id == report_in.category_id,
            Category.is_active == True,
        )
        cat_res = await db.execute(cat_stmt)
        if not cat_res.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The updated category does not exist or is inactive.",
            )
        report.category_id = report_in.category_id

    if report_in.title is not None:
        report.title = report_in.title
    if report_in.description is not None:
        report.description = report_in.description
    if report_in.location_text is not None:
        report.location_text = report_in.location_text
    if report_in.latitude is not None:
        report.latitude = report_in.latitude
    if report_in.longitude is not None:
        report.longitude = report_in.longitude
    if report_in.incident_date is not None:
        report.incident_date = report_in.incident_date
    if report_in.is_anonymous is not None:
        report.is_anonymous = report_in.is_anonymous

    if report_in.status == ReportStatus.SUBMITTED:
        report.status = ReportStatus.SUBMITTED
        report.submitted_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(report)
    return report


@router.post(
    "/{report_id}/submit",
    response_model=ReportResponse,
    status_code=status.HTTP_200_OK,
    summary="Submit a draft report for moderation review",
)
async def submit_report(
    report_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Submits a draft report for moderation review.
    - Transitions status from DRAFT / NEEDS_MORE_INFORMATION -> SUBMITTED.
    - Records submitted_at timestamp.
    """
    stmt = select(Report).where(Report.id == report_id)
    result = await db.execute(stmt)
    report = result.scalar_one_or_none()

    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found.",
        )

    if report.user_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to submit this report.",
        )

    if report.status not in (ReportStatus.DRAFT, ReportStatus.NEEDS_MORE_INFORMATION):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Report is currently in '{report.status.value}' status and cannot be submitted again.",
        )

    report.status = ReportStatus.SUBMITTED
    report.submitted_at = datetime.now(timezone.utc)

    if report.user_id:
        await create_notification(
            db=db,
            user_id=report.user_id,
            notification_type=NotificationType.REPORT_SUBMITTED,
            title="Incident Report Submitted",
            message=f"Your incident report '{report.title}' has been submitted for moderation review.",
            report_id=report.id,
        )

    await db.commit()
    await db.refresh(report)
    return report


# ==============================================================================
# EVIDENCE UPLOAD, ACCESS & DELETION ENDPOINTS
# ==============================================================================


@router.post(
    "/{report_id}/media",
    response_model=ReportMediaResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload and attach supporting evidence to a report",
)
async def upload_report_media(
    report_id: uuid.UUID,
    file: UploadFile = File(...),
    caption: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Uploads an image, video, or document evidence file to object storage
    and creates metadata in PostgreSQL.
    - Requires ownership or ADMIN role.
    - Allowed only while report is in DRAFT or NEEDS_MORE_INFORMATION status.
    - Strictly validates file signatures and size limits.
    """
    stmt = select(Report).where(Report.id == report_id)
    result = await db.execute(stmt)
    report = result.scalar_one_or_none()

    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found.",
        )

    if report.user_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to attach evidence to this report.",
        )

    if report.status not in (ReportStatus.DRAFT, ReportStatus.NEEDS_MORE_INFORMATION) and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot attach new evidence while report is in '{report.status.value}' status.",
        )

    # Check maximum attachments count
    if len(report.media or []) >= settings.MAX_MEDIA_PER_REPORT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Report has reached maximum limit of {settings.MAX_MEDIA_PER_REPORT} attachments.",
        )

    # Validate file type, size, signature, and extension
    file_bytes, safe_filename, mime_type, _ = await validate_upload_file(file)

    # Generate unique, non-guessable storage path
    storage_path = generate_storage_path(report.id, safe_filename)

    # Save to storage service
    storage = get_storage_service()
    try:
        await storage.upload_file(file_bytes, storage_path, mime_type)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to persist file in storage: {str(exc)}",
        )

    # Record metadata in database
    media = ReportMedia(
        report_id=report.id,
        file_name=safe_filename,
        mime_type=mime_type,
        file_size=len(file_bytes),
        storage_path=storage_path,
        caption=caption.strip() if caption else None,
    )
    db.add(media)
    try:
        await db.commit()
        await db.refresh(media)
    except Exception as db_exc:
        # Rollback DB and remove orphaned storage object
        await storage.delete_file(storage_path)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to record media metadata: {str(db_exc)}",
        )

    return media


@router.get(
    "/{report_id}/media/{media_id}",
    summary="Securely stream or download an uploaded evidence file",
)
async def get_report_media_file(
    report_id: uuid.UUID,
    media_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Streams the evidence file content to authorized users.
    - Owner or Administrator access only.
    """
    stmt = select(Report).where(Report.id == report_id)
    res_report = await db.execute(stmt)
    report = res_report.scalar_one_or_none()

    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found.",
        )

    if report.user_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this evidence file.",
        )

    media_stmt = select(ReportMedia).where(
        ReportMedia.id == media_id,
        ReportMedia.report_id == report_id,
    )
    res_media = await db.execute(media_stmt)
    media = res_media.scalar_one_or_none()

    if not media:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evidence file not found on this report.",
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


@router.delete(
    "/{report_id}/media/{media_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete an attached evidence file",
)
async def delete_report_media(
    report_id: uuid.UUID,
    media_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Deletes an attached evidence file from storage and database.
    - Only allowed when report is in DRAFT or NEEDS_MORE_INFORMATION status, or by ADMIN.
    """
    stmt = select(Report).where(Report.id == report_id)
    res_report = await db.execute(stmt)
    report = res_report.scalar_one_or_none()

    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found.",
        )

    if report.user_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete this evidence file.",
        )

    if report.status not in (ReportStatus.DRAFT, ReportStatus.NEEDS_MORE_INFORMATION) and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete evidence while report is in '{report.status.value}' status.",
        )

    media_stmt = select(ReportMedia).where(
        ReportMedia.id == media_id,
        ReportMedia.report_id == report_id,
    )
    res_media = await db.execute(media_stmt)
    media = res_media.scalar_one_or_none()

    if not media:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evidence file not found on this report.",
        )

    # 1. Delete object from storage
    storage = get_storage_service()
    await storage.delete_file(media.storage_path)

    # 2. Delete database record
    await db.delete(media)
    await db.commit()

    return {"detail": "Evidence file deleted successfully."}
