import math
import re
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Tuple, Dict, Any
from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.report import Report, ReportStatus
from app.models.incident_cluster import IncidentCluster, IncidentClusterMember
from app.schemas.incident_cluster import (
    SimilarityBreakdown,
    SuggestedRelatedReportResponse,
    PublicRelatedReportResponse,
)

# Deterministic Scoring Weights (Total Max: 100.0)
WEIGHT_GEO_MAX = 40.0
WEIGHT_TIME_MAX = 30.0
WEIGHT_CATEGORY_MAX = 20.0
WEIGHT_TEXT_MAX = 10.0


def calculate_haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates great-circle distance between two points in kilometers."""
    R = 6371.0  # Earth radius in kilometers
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2.0) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c


def tokenize_text(text: str) -> set:
    """Normalizes and tokenizes text for similarity comparison."""
    if not text:
        return set()
    cleaned = re.sub(r"[^\w\s]", " ", text.lower())
    tokens = {word.strip() for word in cleaned.split() if len(word.strip()) >= 3}
    return tokens


def calculate_similarity_breakdown(
    r1: Report,
    r2: Report,
) -> SimilarityBreakdown:
    """
    Computes a deterministic similarity score between two reports across:
    1. Geographic Proximity (up to 40 pts)
    2. Incident/Submission Time Proximity (up to 30 pts)
    3. Category Match (up to 20 pts)
    4. Text Token Overlap (up to 10 pts)
    """
    # 1. Geographic Score
    geo_score = 0.0
    distance_km: Optional[float] = None
    if (
        r1.latitude is not None
        and r1.longitude is not None
        and r2.latitude is not None
        and r2.longitude is not None
    ):
        distance_km = calculate_haversine_distance(
            r1.latitude, r1.longitude, r2.latitude, r2.longitude
        )
        if distance_km <= 1.0:
            geo_score = 40.0
        elif distance_km <= 3.0:
            geo_score = 30.0
        elif distance_km <= 5.0:
            geo_score = 20.0
        elif distance_km <= 10.0:
            geo_score = 10.0
        else:
            geo_score = 0.0

    # 2. Time Score
    t1 = r1.incident_date or r1.created_at
    t2 = r2.incident_date or r2.created_at
    time_diff_hours: Optional[float] = None
    time_score = 0.0
    if t1 and t2:
        diff_seconds = abs((t1 - t2).total_seconds())
        time_diff_hours = diff_seconds / 3600.0
        if time_diff_hours <= 24.0:
            time_score = 30.0
        elif time_diff_hours <= 72.0:
            time_score = 20.0
        elif time_diff_hours <= 168.0:  # 7 days
            time_score = 10.0
        else:
            time_score = 0.0

    # 3. Category Score
    category_score = 0.0
    if r1.category_id == r2.category_id:
        category_score = 20.0

    # 4. Text Overlap Score
    text_score = 0.0
    tokens1 = tokenize_text(f"{r1.title} {r1.location_text}")
    tokens2 = tokenize_text(f"{r2.title} {r2.location_text}")
    if tokens1 and tokens2:
        intersection = tokens1.intersection(tokens2)
        union = tokens1.union(tokens2)
        if union:
            jaccard = len(intersection) / len(union)
            text_score = round(jaccard * WEIGHT_TEXT_MAX, 2)

    total_score = round(geo_score + time_score + category_score + text_score, 2)

    return SimilarityBreakdown(
        geo_score=geo_score,
        time_score=time_score,
        category_score=category_score,
        text_score=text_score,
        total_score=total_score,
        distance_km=round(distance_km, 2) if distance_km is not None else None,
        time_diff_hours=round(time_diff_hours, 1) if time_diff_hours is not None else None,
    )


async def find_suggested_related_reports(
    report: Report,
    db: AsyncSession,
    min_score: float = 30.0,
    limit: int = 10,
) -> List[SuggestedRelatedReportResponse]:
    """
    Finds candidate reports with high similarity scores for admin inspection.
    """
    # Fetch potentially relevant candidate reports (same category or nearby)
    stmt = (
        select(Report)
        .where(Report.id != report.id)
        .order_by(Report.created_at.desc())
        .limit(200)
    )
    result = await db.execute(stmt)
    candidates = result.scalars().all()

    scored_candidates: List[SuggestedRelatedReportResponse] = []
    for cand in candidates:
        breakdown = calculate_similarity_breakdown(report, cand)
        if breakdown.total_score >= min_score:
            scored_candidates.append(
                SuggestedRelatedReportResponse(
                    report_id=cand.id,
                    title=cand.title,
                    category_name=cand.category.name if cand.category else "General",
                    location_text=cand.location_text,
                    created_at=cand.created_at,
                    incident_date=cand.incident_date,
                    status=cand.status.value,
                    similarity=breakdown,
                )
            )

    scored_candidates.sort(key=lambda x: x.similarity.total_score, reverse=True)
    return scored_candidates[:limit]


async def get_public_related_reports(
    report_id: uuid.UUID,
    db: AsyncSession,
    limit: int = 5,
) -> List[PublicRelatedReportResponse]:
    """
    Returns public-safe related reports for an approved report detail page.
    Prioritizes approved cluster co-members, followed by high-similarity approved reports.
    """
    # 1. Fetch base report
    stmt_base = select(Report).where(Report.id == report_id)
    res_base = await db.execute(stmt_base)
    base_report = res_base.scalar_one_or_none()
    if not base_report or base_report.status != ReportStatus.APPROVED:
        return []

    related_reports: Dict[uuid.UUID, PublicRelatedReportResponse] = {}

    # 2. Check cluster memberships
    stmt_clusters = (
        select(IncidentClusterMember)
        .join(IncidentCluster, IncidentClusterMember.cluster_id == IncidentCluster.id)
        .where(
            and_(
                IncidentClusterMember.report_id == report_id,
                IncidentCluster.is_active == True,
            )
        )
    )
    res_clusters = await db.execute(stmt_clusters)
    memberships = res_clusters.scalars().all()

    for mem in memberships:
        # Fetch co-members in the active cluster
        stmt_co_members = (
            select(IncidentClusterMember)
            .join(Report, IncidentClusterMember.report_id == Report.id)
            .where(
                and_(
                    IncidentClusterMember.cluster_id == mem.cluster_id,
                    IncidentClusterMember.report_id != report_id,
                    Report.status == ReportStatus.APPROVED,
                )
            )
            .limit(limit)
        )
        res_co = await db.execute(stmt_co_members)
        for co_mem in res_co.scalars().all():
            rep = co_mem.report
            if rep.id not in related_reports:
                approx_lat = round(rep.latitude, 3) if rep.latitude is not None else None
                approx_lon = round(rep.longitude, 3) if rep.longitude is not None else None
                related_reports[rep.id] = PublicRelatedReportResponse(
                    id=rep.id,
                    title=rep.title,
                    category_name=rep.category.name if rep.category else "General",
                    category_slug=rep.category.slug if rep.category else "general",
                    location_text=rep.location_text,
                    approximate_latitude=approx_lat,
                    approximate_longitude=approx_lon,
                    incident_date=rep.incident_date,
                    created_at=rep.created_at,
                    status="APPROVED",
                    relationship_type=co_mem.relationship_type,
                    similarity_score=co_mem.similarity_score,
                )

    # 3. If under limit, discover algorithmic candidates
    if len(related_reports) < limit:
        candidates = await find_suggested_related_reports(base_report, db, min_score=40.0, limit=limit)
        for cand in candidates:
            if cand.report_id not in related_reports and cand.status == "APPROVED":
                # Fetch full report for coordinates
                r_stmt = select(Report).where(Report.id == cand.report_id)
                r_res = await db.execute(r_stmt)
                r_obj = r_res.scalar_one_or_none()
                if r_obj:
                    approx_lat = round(r_obj.latitude, 3) if r_obj.latitude is not None else None
                    approx_lon = round(r_obj.longitude, 3) if r_obj.longitude is not None else None
                    related_reports[r_obj.id] = PublicRelatedReportResponse(
                        id=r_obj.id,
                        title=r_obj.title,
                        category_name=r_obj.category.name if r_obj.category else "General",
                        category_slug=r_obj.category.slug if r_obj.category else "general",
                        location_text=r_obj.location_text,
                        approximate_latitude=approx_lat,
                        approximate_longitude=approx_lon,
                        incident_date=r_obj.incident_date,
                        created_at=r_obj.created_at,
                        status="APPROVED",
                        relationship_type="SIMILAR_INCIDENT",
                        similarity_score=cand.similarity.total_score,
                    )
            if len(related_reports) >= limit:
                break

    return list(related_reports.values())[:limit]
