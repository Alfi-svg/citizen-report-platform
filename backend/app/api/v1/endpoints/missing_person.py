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
from app.models.report import Report
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
)

router = APIRouter()


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
    Returns public verified missing person alerts.
    If no status filter is provided, defaults to displaying active or found alerts.
    """
    conditions = []
    if alert_status:
        conditions.append(MissingPersonAlert.status == alert_status)
    else:
        # By default show ACTIVE and FOUND alerts, hide draft/pending
        conditions.append(MissingPersonAlert.status.in_([AlertStatus.ALERT_ACTIVE, AlertStatus.FOUND, AlertStatus.EXPIRED]))

    stmt = (
        select(MissingPersonAlert)
        .join(MissingPersonProfile, MissingPersonProfile.report_id == MissingPersonAlert.report_id)
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
        MissingPersonAlert.status == AlertStatus.ALERT_ACTIVE,  # Active alerts first
        MissingPersonAlert.activated_at.desc(),
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

    # Reject submissions on inactive or resolved alerts
    if alert.status != AlertStatus.ALERT_ACTIVE or not alert.is_active:
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
