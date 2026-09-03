import uuid
from datetime import datetime, timezone
from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_current_user, get_optional_current_user
from app.db.session import get_db
from app.models.missing_person import (
    MissingPersonProfile,
    MissingPersonAlert,
    MissingPersonSighting,
    UserNotificationPreference,
    AlertStatus,
    SightingStatus,
)
from app.models.incident_cluster import IncidentCluster, IncidentClusterMember
from app.models.category import Category
from app.models.report import Report, ReportStatus
from app.models.user import User, UserRole
from app.schemas.missing_person import (
    MissingPersonProfileCreate,
    MissingPersonProfileUpdate,
    MissingPersonProfileResponse,
    MissingPersonSightingCreate,
    PublicMissingPersonSightingResponse,
    PublicMissingPersonAlertResponse,
    PublicMissingPersonAlertPagination,
    UserNotificationPreferenceResponse,
    UserNotificationPreferenceUpdate,
    MissingPersonSubmissionCreate,
    MissingPersonSubmissionResponse,
)

router = APIRouter()


BD_COORDS_LOOKUP = {
    "dhanmondi": (23.7461, 90.3742),
    "mirpur": (23.8223, 90.3654),
    "gulshan": (23.7925, 90.4078),
    "banani": (23.7937, 90.4066),
    "uttara": (23.8759, 90.3795),
    "motijheel": (23.7330, 90.4172),
    "mohammadpur": (23.7658, 90.3585),
    "shahbagh": (23.7389, 90.3957),
    "badda": (23.7805, 90.4267),
    "farmgate": (23.7561, 90.3872),
    "jatrabari": (23.7104, 90.4349),
    "rampura": (23.7612, 90.4215),
    "malibagh": (23.7479, 90.4158),
    "khilgaon": (23.7523, 90.4258),
    "paltan": (23.7337, 90.4128),
    "lalbagh": (23.7189, 90.3882),
    "old dhaka": (23.7100, 90.4070),
    "dhaka": (23.8103, 90.4125),
    "chittagong": (22.3569, 91.7832),
    "chattogram": (22.3569, 91.7832),
    "sylhet": (24.8949, 91.8687),
    "rajshahi": (24.3745, 88.6042),
    "khulna": (22.8456, 89.5403),
    "barisal": (22.7010, 90.3535),
    "barishal": (22.7010, 90.3535),
    "rangpur": (25.7439, 89.2752),
    "mymensingh": (24.7471, 90.4203),
    "comilla": (23.4607, 91.1809),
    "cumilla": (23.4607, 91.1809),
    "gazipur": (23.9999, 90.4203),
    "narayanganj": (23.6238, 90.5000),
    "cox's bazar": (21.4272, 92.0058),
    "coxs bazar": (21.4272, 92.0058),
    "bogura": (24.8465, 89.3777),
    "bogra": (24.8465, 89.3777),
    "jashore": (23.1664, 89.2081),
    "jessore": (23.1664, 89.2081),
    "savar": (23.8583, 90.2667),
    "tangail": (24.2513, 89.9167),
}

def resolve_bd_coordinates(location_text: str) -> tuple[float, float]:
    loc = (location_text or "").lower()
    for name, coords in BD_COORDS_LOOKUP.items():
        if name in loc:
            return coords
    jitter = ((len(location_text) % 15) - 7) * 0.003
    return (round(23.8103 + jitter, 4), round(90.4125 + jitter, 4))


# ==============================================================================
# 1. PUBLIC MISSING PERSON ALERTS
# ==============================================================================

@router.get(
    "/alerts",
    response_model=PublicMissingPersonAlertPagination,
    status_code=status.HTTP_200_OK,
    summary="List public missing person alerts",
)
async def list_public_missing_person_alerts(
    alert_status: Optional[AlertStatus] = Query(None, description="Filter by status (e.g. ALERT_ACTIVE, FOUND, EXPIRED)"),
    search: Optional[str] = Query(None, min_length=1, description="Search by name or last seen area"),
    limit: int = Query(20, ge=1, le=50),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Returns public missing person alerts.
    Includes active, pending, and found alerts so submitted alerts appear immediately in real time.
    """
    conditions = [
        Report.status == ReportStatus.APPROVED,
        MissingPersonAlert.status != AlertStatus.CLOSED,
    ]
    if alert_status:
        conditions.append(MissingPersonAlert.status == alert_status)
        if alert_status == AlertStatus.ALERT_ACTIVE:
            conditions.append(MissingPersonAlert.is_active == True)
    else:
        # Default public directory includes active alerts and found/resolved cases
        conditions.append(MissingPersonAlert.status.in_([
            AlertStatus.ALERT_ACTIVE,
            AlertStatus.FOUND,
        ]))

    stmt = (
        select(MissingPersonAlert)
        .join(MissingPersonProfile, MissingPersonProfile.report_id == MissingPersonAlert.report_id)
        .join(Report, Report.id == MissingPersonAlert.report_id)
        .where(and_(*conditions))
    )

    if search:
        p = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                MissingPersonProfile.full_name.ilike(p),
                MissingPersonProfile.last_seen_location.ilike(p),
                MissingPersonProfile.clothing.ilike(p),
            )
        )

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.scalar(count_stmt)) or 0

    stmt = stmt.order_by(
        MissingPersonAlert.created_at.desc(),
    ).limit(limit).offset(offset)

    result = await db.execute(stmt)
    alerts = result.scalars().all()

    items = []
    for alert in alerts:
        # Load profile
        prof_stmt = select(MissingPersonProfile).where(MissingPersonProfile.report_id == alert.report_id)
        prof_res = await db.execute(prof_stmt)
        profile = prof_res.scalar_one_or_none()

        if not profile:
            continue

        # Count approved sightings
        sighting_count_stmt = select(func.count(MissingPersonSighting.id)).where(
            and_(
                MissingPersonSighting.alert_id == alert.id,
                MissingPersonSighting.status == SightingStatus.APPROVED,
            )
        )
        approved_count = (await db.scalar(sighting_count_stmt)) or 0

        items.append(
            PublicMissingPersonAlertResponse(
                id=alert.id,
                report_id=alert.report_id,
                status=alert.status,
                is_active=alert.is_active,
                alert_radius_km=alert.alert_radius_km,
                alert_expiry=alert.alert_expiry,
                activated_at=alert.activated_at,
                found_at=alert.found_at,
                profile=MissingPersonProfileResponse.model_validate(profile),
                approved_sightings=[],
                approved_sightings_count=approved_count,
                created_at=alert.created_at,
            )
        )

    return PublicMissingPersonAlertPagination(
        items=items,
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/alerts/{alert_id}",
    response_model=PublicMissingPersonAlertResponse,
    status_code=status.HTTP_200_OK,
    summary="Get single public missing person alert with approved community sightings",
)
async def get_public_missing_person_alert(
    alert_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> Any:
    stmt = select(MissingPersonAlert).where(MissingPersonAlert.id == alert_id)
    result = await db.execute(stmt)
    alert = result.scalar_one_or_none()

    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Missing person alert not found.",
        )

    # Direct URL Protection: ensure underlying report is approved and alert is active or found
    rep_stmt = select(Report).where(Report.id == alert.report_id)
    rep_res = await db.execute(rep_stmt)
    report = rep_res.scalar_one_or_none()

    if (
        not report
        or report.status != ReportStatus.APPROVED
        or alert.status == AlertStatus.CLOSED
        or (alert.status != AlertStatus.ALERT_ACTIVE and alert.status != AlertStatus.FOUND)
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Missing person alert not found or is no longer publicly available.",
        )

    prof_stmt = select(MissingPersonProfile).where(MissingPersonProfile.report_id == alert.report_id)
    prof_res = await db.execute(prof_stmt)
    profile = prof_res.scalar_one_or_none()

    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Missing person profile not found.",
        )

    # Fetch approved community sightings (sanitized approximate locations only)
    sightings_stmt = (
        select(MissingPersonSighting)
        .where(
            and_(
                MissingPersonSighting.alert_id == alert.id,
                MissingPersonSighting.status == SightingStatus.APPROVED,
            )
        )
        .order_by(MissingPersonSighting.created_at.desc())
    )
    sightings_res = await db.execute(sightings_stmt)
    approved_sightings = sightings_res.scalars().all()

    return PublicMissingPersonAlertResponse(
        id=alert.id,
        report_id=alert.report_id,
        status=alert.status,
        is_active=alert.is_active,
        alert_radius_km=alert.alert_radius_km,
        alert_expiry=alert.alert_expiry,
        activated_at=alert.activated_at,
        found_at=alert.found_at,
        profile=MissingPersonProfileResponse.model_validate(profile),
        approved_sightings=[
            PublicMissingPersonSightingResponse.model_validate(s) for s in approved_sightings
        ],
        approved_sightings_count=len(approved_sightings),
        created_at=alert.created_at,
    )


@router.get(
    "/alerts/{alert_id}/sightings",
    response_model=List[PublicMissingPersonSightingResponse],
    status_code=status.HTTP_200_OK,
    summary="Get approved sightings for an alert timeline and map",
)
async def get_public_missing_person_sightings(
    alert_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> Any:
    stmt = select(MissingPersonAlert).where(MissingPersonAlert.id == alert_id)
    result = await db.execute(stmt)
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Missing person alert not found.",
        )

    # Verify public visibility rules
    rep_stmt = select(Report).where(Report.id == alert.report_id)
    rep_res = await db.execute(rep_stmt)
    report = rep_res.scalar_one_or_none()

    if (
        not report
        or report.status != ReportStatus.APPROVED
        or alert.status == AlertStatus.CLOSED
        or (alert.status != AlertStatus.ALERT_ACTIVE and alert.status != AlertStatus.FOUND)
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Missing person alert not found or is no longer publicly available.",
        )

    sightings_stmt = (
        select(MissingPersonSighting)
        .where(
            and_(
                MissingPersonSighting.alert_id == alert.id,
                MissingPersonSighting.status == SightingStatus.APPROVED,
            )
        )
        .order_by(MissingPersonSighting.created_at.desc())
    )
    res = await db.execute(sightings_stmt)
    sightings = res.scalars().all()
    return [PublicMissingPersonSightingResponse.model_validate(s) for s in sightings]


@router.post(
    "/alerts/{alert_id}/sightings",
    response_model=PublicMissingPersonSightingResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit an 'I Saw This Person' community sighting",
)
async def submit_missing_person_sighting(
    alert_id: uuid.UUID,
    payload: MissingPersonSightingCreate,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    # Verify alert exists
    stmt = select(MissingPersonAlert).where(MissingPersonAlert.id == alert_id)
    result = await db.execute(stmt)
    alert = result.scalar_one_or_none()

    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Missing person alert not found.",
        )

    rep_stmt = select(Report).where(Report.id == alert.report_id)
    rep_res = await db.execute(rep_stmt)
    report = rep_res.scalar_one_or_none()

    # Reject submissions on inactive or resolved alerts or non-approved reports
    if not report or report.status != ReportStatus.APPROVED or alert.status != AlertStatus.ALERT_ACTIVE or not alert.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot submit sightings for an inactive or resolved missing person alert.",
        )

    # Privacy coordinate fuzzing (~3 decimal places = ~110m)
    fuzzed_lat = round(payload.latitude, 3) if payload.latitude is not None else None
    fuzzed_lng = round(payload.longitude, 3) if payload.longitude is not None else None

    # Create new sighting with PENDING status (requires moderation)
    sighting = MissingPersonSighting(
        alert_id=alert.id,
        user_id=current_user.id if current_user else None,
        approximate_location=payload.approximate_location.strip(),
        latitude=fuzzed_lat,
        longitude=fuzzed_lng,
        sighting_date=payload.sighting_date,
        sighting_time=payload.sighting_time.strip() if payload.sighting_time else None,
        description=payload.description.strip(),
        clothing=payload.clothing.strip() if payload.clothing else None,
        direction=payload.direction.strip() if payload.direction else None,
        additional_information=payload.additional_information.strip() if payload.additional_information else None,
        photo_url=payload.photo_url.strip() if payload.photo_url else None,
        status=SightingStatus.PENDING,
    )
    db.add(sighting)
    await db.commit()
    await db.refresh(sighting)

    return PublicMissingPersonSightingResponse.model_validate(sighting)


# ==============================================================================
# 3. ATTACH / UPDATE MISSING PERSON PROFILE TO REPORT
# ==============================================================================

@router.post(
    "/reports/{report_id}/profile",
    response_model=MissingPersonProfileResponse,
    status_code=status.HTTP_200_OK,
    summary="Attach or update missing person profile on a report",
)
async def attach_missing_person_profile(
    report_id: uuid.UUID,
    payload: MissingPersonProfileCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    # Verify report ownership or admin
    report_stmt = select(Report).where(Report.id == report_id)
    report_res = await db.execute(report_stmt)
    report = report_res.scalar_one_or_none()

    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found.",
        )

    if current_user.role != UserRole.ADMIN and report.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to edit profile for this report.",
        )

    # Check if profile already exists
    prof_stmt = select(MissingPersonProfile).where(MissingPersonProfile.report_id == report_id)
    prof_res = await db.execute(prof_stmt)
    profile = prof_res.scalar_one_or_none()

    if profile:
        # Update existing profile
        update_data = payload.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(profile, field, value)
    else:
        # Create new profile
        profile = MissingPersonProfile(
            report_id=report.id,
            full_name=payload.full_name,
            name_bn=payload.name_bn,
            age=payload.age,
            approximate_age=payload.approximate_age,
            gender=payload.gender,
            photo_url=payload.photo_url,
            height=payload.height,
            clothing=payload.clothing,
            clothing_bn=payload.clothing_bn,
            identifying_features=payload.identifying_features,
            identifying_features_bn=payload.identifying_features_bn,
            last_seen_location=payload.last_seen_location,
            last_seen_location_bn=payload.last_seen_location_bn,
            last_seen_latitude=payload.last_seen_latitude or report.latitude,
            last_seen_longitude=payload.last_seen_longitude or report.longitude,
            last_seen_time=payload.last_seen_time or report.incident_date,
            description=payload.description or report.description,
            contact_information=payload.contact_information,
            reporting_authority=payload.reporting_authority,
            source=payload.source,
        )
        db.add(profile)

    # Ensure an alert record exists for admin tracking (in ALERT_PENDING status)
    alert_stmt = select(MissingPersonAlert).where(MissingPersonAlert.report_id == report_id)
    alert_res = await db.execute(alert_stmt)
    existing_alert = alert_res.scalar_one_or_none()

    if not existing_alert:
        new_alert = MissingPersonAlert(
            report_id=report.id,
            status=AlertStatus.ALERT_PENDING,
            is_active=False,
            alert_radius_km=10.0,
        )
        db.add(new_alert)

    await db.commit()
    await db.refresh(profile)
    return profile


@router.post(
    "/submit",
    response_model=MissingPersonSubmissionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit a missing person report & create alert",
)
async def submit_missing_person_report(
    payload: MissingPersonSubmissionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Unified citizen/admin submission endpoint to file a missing person report,
    attach their biographical & physical profile, and generate a missing person alert.
    """
    # 1. Resolve or create 'Missing Person' category
    cat_stmt = select(Category).where(
        or_(Category.slug == "missing-person", Category.name == "Missing Person")
    )
    cat_res = await db.execute(cat_stmt)
    category = cat_res.scalar_one_or_none()
    if not category:
        category = Category(
            name="Missing Person",
            slug="missing-person",
            description="Reports concerning missing persons, children, and vulnerable individuals.",
        )
        db.add(category)
        await db.flush()

    # 2. Resolve geographic coordinates automatically if not explicitly provided
    lat = payload.last_seen_latitude
    lng = payload.last_seen_longitude
    if lat is None or lng is None:
        lat, lng = resolve_bd_coordinates(payload.last_seen_location)

    title = f"Missing Person: {payload.full_name}"
    description = payload.description or f"Missing person report for {payload.full_name}, last seen at {payload.last_seen_location}."
    now = datetime.now(timezone.utc)

    # 3. Create approved report so it immediately displays on the Safety Map in real-time
    report = Report(
        user_id=current_user.id,
        category_id=category.id,
        title=title,
        description=description,
        location_text=payload.last_seen_location,
        latitude=lat,
        longitude=lng,
        incident_date=payload.last_seen_time or now,
        is_anonymous=payload.is_anonymous,
        status=ReportStatus.APPROVED,
        submitted_at=now,
    )
    db.add(report)
    await db.flush()

    # 4. Create biographical profile
    profile = MissingPersonProfile(
        report_id=report.id,
        full_name=payload.full_name,
        name_bn=payload.name_bn,
        age=payload.age,
        approximate_age=payload.approximate_age,
        gender=payload.gender,
        photo_url=payload.photo_url,
        height=payload.height,
        clothing=payload.clothing,
        clothing_bn=payload.clothing_bn,
        identifying_features=payload.identifying_features,
        identifying_features_bn=payload.identifying_features_bn,
        last_seen_location=payload.last_seen_location,
        last_seen_location_bn=payload.last_seen_location_bn,
        last_seen_latitude=lat,
        last_seen_longitude=lng,
        last_seen_time=payload.last_seen_time or report.incident_date,
        description=description,
        contact_information=payload.contact_information,
        reporting_authority=payload.reporting_authority,
        source=payload.source,
    )
    db.add(profile)
    await db.flush()

    # 5. Generate ACTIVE alert record so it is immediately visible on the public feed
    alert = MissingPersonAlert(
        report_id=report.id,
        status=AlertStatus.ALERT_ACTIVE,
        is_active=True,
        alert_radius_km=15.0,
        activated_at=now,
    )
    db.add(alert)

    # 6. Associate with active cluster nearby if available for real-time cluster map
    cluster_stmt = (
        select(IncidentCluster)
        .where(
            IncidentCluster.is_active == True,
            func.abs(IncidentCluster.approximate_latitude - lat) < 0.08,
            func.abs(IncidentCluster.approximate_longitude - lng) < 0.08,
        )
        .limit(1)
    )
    c_res = await db.execute(cluster_stmt)
    active_cluster = c_res.scalar_one_or_none()
    if active_cluster:
        mem = IncidentClusterMember(
            cluster_id=active_cluster.id,
            report_id=report.id,
            confidence_score=0.98,
            similarity_reasons={"match": "Real-time geographical vicinity"},
        )
        db.add(mem)
        active_cluster.member_count += 1

    await db.commit()
    await db.refresh(profile)
    await db.refresh(alert)

    return {
        "report_id": report.id,
        "alert_id": alert.id,
        "status": alert.status,
        "profile": profile,
        "message": "Missing person alert activated and published in real-time. It is now live on the feed and safety map.",
    }


# ==============================================================================
# 4. USER NOTIFICATION PREFERENCES
# ==============================================================================

@router.get(
    "/user/preferences",
    response_model=UserNotificationPreferenceResponse,
    status_code=status.HTTP_200_OK,
    summary="Get current user's alert notification preferences",
)
async def get_user_notification_preferences(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    stmt = select(UserNotificationPreference).where(UserNotificationPreference.user_id == current_user.id)
    res = await db.execute(stmt)
    pref = res.scalar_one_or_none()

    if not pref:
        pref = UserNotificationPreference(
            user_id=current_user.id,
            missing_person_alerts=True,
            nearby_safety_alerts=True,
        )
        db.add(pref)
        await db.commit()
        await db.refresh(pref)

    return pref


@router.put(
    "/user/preferences",
    response_model=UserNotificationPreferenceResponse,
    status_code=status.HTTP_200_OK,
    summary="Update current user's alert notification preferences and location",
)
async def update_user_notification_preferences(
    payload: UserNotificationPreferenceUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    stmt = select(UserNotificationPreference).where(UserNotificationPreference.user_id == current_user.id)
    res = await db.execute(stmt)
    pref = res.scalar_one_or_none()

    if not pref:
        pref = UserNotificationPreference(user_id=current_user.id)
        db.add(pref)

    if payload.missing_person_alerts is not None:
        pref.missing_person_alerts = payload.missing_person_alerts
    if payload.nearby_safety_alerts is not None:
        pref.nearby_safety_alerts = payload.nearby_safety_alerts
    if payload.latitude is not None and payload.longitude is not None:
        pref.last_known_latitude = payload.latitude
        pref.last_known_longitude = payload.longitude
        pref.last_location_updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(pref)
    return pref
