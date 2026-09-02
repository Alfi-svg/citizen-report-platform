import uuid
from typing import Optional, Any
from fastapi import APIRouter, Depends, Query, status, Response, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.api.deps import get_current_active_admin
from app.models.user import User
from app.services.analytics_service import AnalyticsService
from app.schemas.analytics import (
    KPICardsResponse,
    MonthlyAnalyticsResponse,
    YearlyAnalyticsResponse,
    CategoryAnalyticsResponse,
    GeographicAnalyticsResponse,
    PublicTransparencyOverviewResponse,
    AdminOperationsAnalyticsResponse,
)

router = APIRouter()


@router.get(
    "/overview",
    response_model=PublicTransparencyOverviewResponse,
    status_code=status.HTTP_200_OK,
    summary="Get comprehensive public transparency & analytics overview",
)
async def get_public_transparency_overview(
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Returns high-level KPI cards, monthly trends, yearly trends, category distributions,
    and Bangladesh geographic aggregations for platform-reviewed reports.
    """
    return await AnalyticsService.get_transparency_overview(db)


@router.get(
    "/kpis",
    response_model=KPICardsResponse,
    status_code=status.HTTP_200_OK,
    summary="Get core public KPI cards",
)
async def get_public_kpis(
    db: AsyncSession = Depends(get_db),
) -> Any:
    return await AnalyticsService.get_kpi_cards(db)


@router.get(
    "/monthly",
    response_model=MonthlyAnalyticsResponse,
    status_code=status.HTTP_200_OK,
    summary="Get monthly time series report analytics",
)
async def get_monthly_analytics(
    year: Optional[int] = Query(None, ge=2020, le=2050),
    category_id: Optional[uuid.UUID] = Query(None),
    district: Optional[str] = Query(None, max_length=100),
    db: AsyncSession = Depends(get_db),
) -> Any:
    return await AnalyticsService.get_monthly_analytics(
        db=db,
        year=year,
        category_id=category_id,
        district=district,
    )


@router.get(
    "/yearly",
    response_model=YearlyAnalyticsResponse,
    status_code=status.HTTP_200_OK,
    summary="Get yearly report trend analytics",
)
async def get_yearly_analytics(
    category_id: Optional[uuid.UUID] = Query(None),
    district: Optional[str] = Query(None, max_length=100),
    db: AsyncSession = Depends(get_db),
) -> Any:
    return await AnalyticsService.get_yearly_analytics(
        db=db,
        category_id=category_id,
        district=district,
    )


@router.get(
    "/categories",
    response_model=CategoryAnalyticsResponse,
    status_code=status.HTTP_200_OK,
    summary="Get report counts and shares by category",
)
async def get_category_analytics(
    year: Optional[int] = Query(None, ge=2020, le=2050),
    month: Optional[int] = Query(None, ge=1, le=12),
    db: AsyncSession = Depends(get_db),
) -> Any:
    return await AnalyticsService.get_category_analytics(
        db=db,
        year=year,
        month=month,
    )


@router.get(
    "/geography",
    response_model=GeographicAnalyticsResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Bangladesh division and district geographic aggregations",
)
async def get_geographic_analytics(
    year: Optional[int] = Query(None, ge=2020, le=2050),
    category_id: Optional[uuid.UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
) -> Any:
    return await AnalyticsService.get_geographic_analytics(
        db=db,
        year=year,
        category_id=category_id,
    )


@router.get(
    "/export",
    status_code=status.HTTP_200_OK,
    summary="Export sanitized public aggregated analytics (CSV or JSON)",
)
async def export_public_analytics(
    format: str = Query("csv", pattern="^(csv|json)$"),
    year: Optional[int] = Query(None, ge=2020, le=2050),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Exports strictly aggregated public metrics in CSV or JSON.
    Never exports raw citizen records, reporter identities, private coordinates, or admin notes.
    """
    if format == "csv":
        csv_content = await AnalyticsService.export_public_csv(db, year=year)
        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=citizen_reports_transparency_{year or 'all'}.csv"},
        )
    else:
        overview = await AnalyticsService.get_transparency_overview(db)
        return overview


@router.get(
    "/admin/operations",
    response_model=AdminOperationsAnalyticsResponse,
    status_code=status.HTTP_200_OK,
    summary="Get admin operational analytics (Moderation throughput, queues, turnaround)",
)
async def get_admin_operations_analytics(
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Returns internal operational metrics restricted to verified platform administrators.
    """
    return await AnalyticsService.get_admin_operations_analytics(db)
