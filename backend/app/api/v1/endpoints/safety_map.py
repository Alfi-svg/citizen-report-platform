import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, and_, or_, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.models.report import Report, ReportStatus
from app.models.category import Category
from app.models.incident_cluster import IncidentCluster, IncidentClusterMember
from app.models.missing_person import MissingPersonAlert, AlertStatus
from app.schemas.incident_cluster import (
    PublicMapIncidentPoint,
    PublicMapClusterPoint,
    PublicSafetyMapResponse,
    PublicRelatedReportResponse,
)
from app.services.incident_similarity import get_public_related_reports

router = APIRouter()


# ==============================================================================
# 1. PUBLIC COMMUNITY SAFETY MAP
# ==============================================================================

@router.get(
    "/map",
    response_model=PublicSafetyMapResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve privacy-safe approved incidents and clusters for the Community Safety Map",
)
async def get_public_safety_map(
    north: Optional[float] = Query(None, description="Bounding box North latitude (-90 to 90)"),
    south: Optional[float] = Query(None, description="Bounding box South latitude (-90 to 90)"),
    east: Optional[float] = Query(None, description="Bounding box East longitude (-180 to 180)"),
    west: Optional[float] = Query(None, description="Bounding box West longitude (-180 to 180)"),
    category_slug: Optional[str] = Query(None, description="Filter by category slug"),
    category_id: Optional[uuid.UUID] = Query(None, description="Filter by category UUID"),
    from_date: Optional[datetime] = Query(None, description="Filter incidents after this date"),
    to_date: Optional[datetime] = Query(None, description="Filter incidents before this date"),
    search: Optional[str] = Query(None, description="Search term in title or location"),
    include_missing_persons: bool = Query(True, description="Include active missing person alerts on map"),
    limit: int = Query(200, ge=1, le=500, description="Max incidents to return"),
    db: AsyncSession = Depends(get_db),
) -> Any:
    # 1. Build query for APPROVED reports with usable geographic coordinates
    conditions = [
        Report.status == ReportStatus.APPROVED,
        Report.latitude.isnot(None),
        Report.longitude.isnot(None),
    ]

    # Bounding Box
    if north is not None and south is not None:
        if north < south:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="North boundary must be greater than or equal to South boundary.",
            )
        conditions.append(Report.latitude >= south)
        conditions.append(Report.latitude <= north)

    if east is not None and west is not None:
        if east < west:
            # Handle anti-meridian wrap or simple validation
            conditions.append(or_(Report.longitude >= west, Report.longitude <= east))
        else:
            conditions.append(Report.longitude >= west)
            conditions.append(Report.longitude <= east)

    # Category Filter
    if category_slug:
        conditions.append(Category.slug == category_slug.lower().strip())
    elif category_id:
        conditions.append(Report.category_id == category_id)

    # Date Range
    if from_date:
        conditions.append(
            or_(
                Report.incident_date >= from_date,
                and_(Report.incident_date.is_(None), Report.created_at >= from_date),
            )
        )
    if to_date:
        conditions.append(
            or_(
                Report.incident_date <= to_date,
                and_(Report.incident_date.is_(None), Report.created_at <= to_date),
            )
        )

    # Search Query
    if search and search.strip():
        term = f"%{search.strip()}%"
        conditions.append(
            or_(
                Report.title.ilike(term),
                Report.location_text.ilike(term),
            )
        )

    stmt = (
        select(Report)
        .join(Category, Report.category_id == Category.id)
        .where(and_(*conditions))
        .order_by(Report.created_at.desc())
        .limit(limit)
    )

    result = await db.execute(stmt)
    reports = result.scalars().all()

    # Convert to Privacy-Safe Map Points (~3 decimals ~110m privacy fuzzing)
    incident_points: List[PublicMapIncidentPoint] = []
    for r in reports:
        # Check if report belongs to an active cluster
        cluster_id = None
        cluster_title = None
        if r.cluster_memberships:
            for mem in r.cluster_memberships:
                if mem.cluster and mem.cluster.is_active:
                    cluster_id = mem.cluster_id
                    cluster_title = mem.cluster.title
                    break

        # Check missing person alert
        is_mp = False
        mp_id = None
        mp_status = None
        if r.missing_person_alert:
            is_mp = True
            mp_id = r.missing_person_alert.id
            mp_status = r.missing_person_alert.status.value

        incident_points.append(
            PublicMapIncidentPoint(
                id=r.id,
                title=r.title,
                category_name=r.category.name if r.category else "General",
                category_slug=r.category.slug if r.category else "general",
                location_text=r.location_text,
                approximate_latitude=round(r.latitude, 3),
                approximate_longitude=round(r.longitude, 3),
                incident_date=r.incident_date,
                created_at=r.created_at,
                status="APPROVED",
                cluster_id=cluster_id,
                cluster_title=cluster_title,
                is_missing_person=is_mp,
                missing_person_alert_id=mp_id,
                missing_person_status=mp_status,
            )
        )

    # 2. Fetch Active Incident Clusters
    cluster_conditions = [IncidentCluster.is_active == True]
    if north is not None and south is not None:
        cluster_conditions.append(IncidentCluster.approximate_latitude >= south)
        cluster_conditions.append(IncidentCluster.approximate_latitude <= north)
    if east is not None and west is not None:
        cluster_conditions.append(IncidentCluster.approximate_longitude >= west)
        cluster_conditions.append(IncidentCluster.approximate_longitude <= east)

    stmt_clusters = (
        select(IncidentCluster)
        .where(and_(*cluster_conditions))
        .order_by(IncidentCluster.created_at.desc())
        .limit(50)
    )
    res_clusters = await db.execute(stmt_clusters)
    cluster_models = res_clusters.scalars().all()

    cluster_points: List[PublicMapClusterPoint] = []
    for c in cluster_models:
        if c.approximate_latitude is not None and c.approximate_longitude is not None:
            # Count approved members
            count = sum(1 for m in c.members if m.report and m.report.status == ReportStatus.APPROVED)
            if count > 0:
                cluster_points.append(
                    PublicMapClusterPoint(
                        id=c.id,
                        title=c.title,
                        title_bn=c.title_bn,
                        category_name=c.category.name if c.category else None,
                        category_slug=c.category.slug if c.category else None,
                        summary=c.summary,
                        area=c.area,
                        approximate_latitude=round(c.approximate_latitude, 3),
                        approximate_longitude=round(c.approximate_longitude, 3),
                        member_count=count,
                        created_at=c.created_at,
                    )
                )

    applied_filters = {
        "north": north,
        "south": south,
        "east": east,
        "west": west,
        "category_slug": category_slug,
        "search": search,
        "limit": limit,
    }

    return PublicSafetyMapResponse(
        incidents=incident_points,
        clusters=cluster_points,
        total_incidents=len(incident_points),
        total_clusters=len(cluster_points),
        applied_filters=applied_filters,
    )


# ==============================================================================
# 2. PUBLIC RELATED REPORTS
# ==============================================================================

@router.get(
    "/reports/{report_id}/related",
    response_model=List[PublicRelatedReportResponse],
    status_code=status.HTTP_200_OK,
    summary="Retrieve approved related reports for a specific approved report detail page",
)
async def get_report_related_incidents(
    report_id: uuid.UUID,
    limit: int = Query(5, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
) -> Any:
    return await get_public_related_reports(report_id=report_id, db=db, limit=limit)
