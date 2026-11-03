import uuid
from datetime import datetime, timezone
from typing import List, Optional, Tuple, Dict, Any
from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.report import Report, ReportStatus
from app.models.incident_cluster import IncidentCluster, IncidentClusterMember
from app.services.incident_similarity import (
    calculate_haversine_distance,
    tokenize_text,
    calculate_similarity_breakdown,
)
from app.schemas.ai_features import (
    DuplicateCheckRequest,
    DuplicateCandidateItem,
    DuplicateDetectionResponse,
)
from app.services.ai_client import call_ai_json


async def check_for_duplicates(
    db: AsyncSession,
    report: Optional[Report] = None,
    candidate_data: Optional[DuplicateCheckRequest] = None,
    threshold: float = 55.0,
) -> DuplicateDetectionResponse:
    """
    Evaluates an incident report (or pre-submission draft) against existing reports
    to detect potential duplicate reports of the same real-world event.
    Combines deterministic spatio-temporal-text metrics with AI semantic analysis.
    """
    target_id = report.id if report else None
    title = report.title if report else (candidate_data.title if candidate_data else "")
    desc = report.description if report else (candidate_data.description if candidate_data else "")
    loc_text = report.location_text if report else (candidate_data.location_text if candidate_data else "")
    lat = report.latitude if report else (candidate_data.latitude if candidate_data else None)
    lng = report.longitude if report else (candidate_data.longitude if candidate_data else None)
    cat_id = report.category_id if report else (
        uuid.UUID(candidate_data.category_id) if candidate_data and candidate_data.category_id else None
    )

    # 1. Fetch potential candidates within similar status and time
    stmt = (
        select(Report)
        .where(
            and_(
                Report.id != target_id if target_id else True,
                Report.status.in_([ReportStatus.APPROVED, ReportStatus.SUBMITTED, ReportStatus.UNDER_REVIEW]),
            )
        )
        .order_by(Report.created_at.desc())
        .limit(100)
    )
    result = await db.execute(stmt)
    all_candidates = result.scalars().all()

    scored_candidates: List[DuplicateCandidateItem] = []
    tokens_target = tokenize_text(f"{title} {loc_text} {desc}")

    for cand in all_candidates:
        reasons: List[str] = []
        score = 0.0

        # Geo proximity
        dist_km = None
        if lat is not None and lng is not None and cand.latitude is not None and cand.longitude is not None:
            dist_km = calculate_haversine_distance(lat, lng, cand.latitude, cand.longitude)
            if dist_km <= 0.5:
                score += 35.0
                reasons.append(f"Same immediate location ({int(dist_km * 1000)}m away)")
            elif dist_km <= 1.5:
                score += 25.0
                reasons.append(f"Nearby vicinity ({round(dist_km, 1)}km away)")
            elif dist_km <= 3.0:
                score += 15.0
                reasons.append(f"Within 3km ({round(dist_km, 1)}km)")

        # Category match
        if cat_id and cand.category_id == cat_id:
            score += 25.0
            reasons.append(f"Identical category ({cand.category.name if cand.category else 'Matched'})")

        # Temporal proximity (within 48 hours)
        t_ref = (report.incident_date or report.created_at) if report else datetime.now(timezone.utc)
        t_cand = cand.incident_date or cand.created_at
        if t_ref and t_cand:
            if t_ref.tzinfo is None:
                t_ref = t_ref.replace(tzinfo=timezone.utc)
            if t_cand.tzinfo is None:
                t_cand = t_cand.replace(tzinfo=timezone.utc)
            diff_hours = abs((t_ref - t_cand).total_seconds()) / 3600.0
            if diff_hours <= 6.0:
                score += 25.0
                reasons.append("Occurred within 6 hours")
            elif diff_hours <= 24.0:
                score += 15.0
                reasons.append("Occurred within 24 hours")
            elif diff_hours <= 48.0:
                score += 10.0
                reasons.append("Occurred within 48 hours")

        # Text overlap
        tokens_cand = tokenize_text(f"{cand.title} {cand.location_text} {cand.description}")
        if tokens_target and tokens_cand:
            overlap = len(tokens_target.intersection(tokens_cand))
            if overlap >= 3:
                overlap_pts = min(15.0, overlap * 3.0)
                score += overlap_pts
                reasons.append(f"Significant keyword overlap ({overlap} common terms)")

        # Check existing cluster membership for confirmed duplicates
        is_confirmed = False
        if cand.cluster_memberships:
            for mem in cand.cluster_memberships:
                if mem.relationship_type == "CONFIRMED_DUPLICATE":
                    is_confirmed = True
                    break

        if score >= threshold:
            scored_candidates.append(
                DuplicateCandidateItem(
                    report_id=str(cand.id),
                    title=cand.title,
                    category_name=cand.category.name if cand.category else "Incident",
                    location_text=cand.location_text,
                    incident_date=cand.incident_date,
                    created_at=cand.created_at,
                    distance_km=round(dist_km, 2) if dist_km is not None else None,
                    similarity_score=round(score, 1),
                    match_reasons=reasons,
                    is_confirmed_duplicate=is_confirmed,
                )
            )

    # Sort descending by similarity
    scored_candidates.sort(key=lambda x: x.similarity_score, reverse=True)

    is_duplicate = len(scored_candidates) > 0
    top_cand = scored_candidates[0] if is_duplicate else None
    primary_id = top_cand.report_id if top_cand else None

    # AI Semantic confirmation if high score
    analysis_summary = "No duplicate incidents detected; report appears distinct."
    if top_cand:
        analysis_summary = (
            f"Potential duplicate detected with Report '{top_cand.title}' (Similarity: {top_cand.similarity_score}/100). "
            f"Reasons: {', '.join(top_cand.match_reasons)}."
        )

        # Optional AI verification prompt for borderline cases
        if top_cand.similarity_score >= 60.0 and desc and len(desc) > 15:
            prompt = (
                f"Incident A: {title} | {loc_text} | {desc}\n"
                f"Incident B: {top_cand.title} | {top_cand.location_text}\n"
                "Are these two reports describing the exact same event or accident? "
                "Return JSON: {'same_event': true/false, 'reason': '...'}"
            )
            ai_verdict = await call_ai_json(prompt=prompt, system_prompt="You are Nirapotta's Incident Deduplication Engine.", timeout_seconds=6.0)
            if ai_verdict and isinstance(ai_verdict.get("reason"), str):
                analysis_summary += f" AI Assessment: {ai_verdict['reason']}"

    suggested_action = "FLAG_DUPLICATE" if (top_cand and top_cand.similarity_score >= 70.0) else (
        "CONFIRM_PRIMARY" if (top_cand and top_cand.similarity_score >= 50.0) else "NONE"
    )

    return DuplicateDetectionResponse(
        is_potential_duplicate=is_duplicate,
        primary_report_id=primary_id,
        suggested_action=suggested_action,
        candidates=scored_candidates[:5],
        analysis_summary=analysis_summary,
    )


async def confirm_duplicate_relationship(
    db: AsyncSession,
    primary_report_id: uuid.UUID,
    duplicate_report_id: uuid.UUID,
    admin_id: Optional[uuid.UUID] = None,
    notes: Optional[str] = None,
) -> IncidentCluster:
    """
    Confirms that `duplicate_report_id` is a verified duplicate of `primary_report_id`.
    Finds or creates an IncidentCluster, marks duplicate member non-destructively,
    preserving all evidence, votes, comments, and ownership.
    """
    # 1. Fetch both reports
    primary = (await db.execute(select(Report).where(Report.id == primary_report_id))).scalar_one_or_none()
    dup = (await db.execute(select(Report).where(Report.id == duplicate_report_id))).scalar_one_or_none()

    if not primary or not dup:
        raise ValueError("One or both reports not found.")

    # 2. Check if primary already belongs to a cluster
    stmt_mem = (
        select(IncidentClusterMember)
        .where(IncidentClusterMember.report_id == primary_report_id)
    )
    existing_mem = (await db.execute(stmt_mem)).scalar_one_or_none()

    if existing_mem:
        cluster = (
            await db.execute(select(IncidentCluster).where(IncidentCluster.id == existing_mem.cluster_id))
        ).scalar_one()
    else:
        # Create new cluster with primary as anchor
        cluster = IncidentCluster(
            title=primary.title,
            category_id=primary.category_id,
            summary=f"Incident cluster anchored by primary report: {primary.title}",
            approximate_latitude=primary.latitude,
            approximate_longitude=primary.longitude,
            area=primary.location_text,
            is_active=True,
            created_by_admin_id=admin_id,
        )
        db.add(cluster)
        await db.flush()

        # Add primary member
        mem_primary = IncidentClusterMember(
            cluster_id=cluster.id,
            report_id=primary_report_id,
            relationship_type="PRIMARY_INCIDENT",
            similarity_score=100.0,
            added_by_admin_id=admin_id,
        )
        db.add(mem_primary)

    # 3. Add or update duplicate member
    stmt_dup_mem = (
        select(IncidentClusterMember)
        .where(
            and_(
                IncidentClusterMember.cluster_id == cluster.id,
                IncidentClusterMember.report_id == duplicate_report_id,
            )
        )
    )
    existing_dup_mem = (await db.execute(stmt_dup_mem)).scalar_one_or_none()

    if existing_dup_mem:
        existing_dup_mem.relationship_type = "CONFIRMED_DUPLICATE"
        existing_dup_mem.added_by_admin_id = admin_id
    else:
        mem_dup = IncidentClusterMember(
            cluster_id=cluster.id,
            report_id=duplicate_report_id,
            relationship_type="CONFIRMED_DUPLICATE",
            similarity_score=85.0,
            added_by_admin_id=admin_id,
        )
        db.add(mem_dup)

    await db.commit()
    await db.refresh(cluster)
    return cluster
