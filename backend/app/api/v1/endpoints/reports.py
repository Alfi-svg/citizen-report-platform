import uuid
from datetime import datetime, timezone
from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.category import Category
from app.models.report import Report, ReportStatus
from app.models.user import User, UserRole
from app.schemas.report import ReportCreate, ReportUpdate, ReportResponse

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
    # 1. Validate category existence and active state
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

    # 2. Determine initial status and submission timestamp
    initial_status = report_in.status or ReportStatus.DRAFT
    submitted_at = datetime.now(timezone.utc) if initial_status == ReportStatus.SUBMITTED else None

    # 3. Create report model instance
    report = Report(
        user_id=current_user.id,
        category_id=report_in.category_id,
        title=report_in.title,
        description=report_in.description,
        location_text=report_in.location_text,
        latitude=report_in.latitude,
        longitude=report_in.longitude,
        incident_date=report_in.incident_date,
        is_anonymous=report_in.is_anonymous,
        status=initial_status,
        submitted_at=submitted_at,
    )
    db.add(report)
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

    # Ownership / Admin check
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

    # Validate category if being updated
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

    # Update provided fields
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

    # Handle explicit submission during update
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
    - Prevents duplicate submission of already submitted/reviewed reports.
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

    await db.commit()
    await db.refresh(report)
    return report
