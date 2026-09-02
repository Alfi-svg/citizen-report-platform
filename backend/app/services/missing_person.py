import math
import uuid
import logging
from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy import select, and_, or_, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.missing_person import (
    MissingPersonAlert,
    MissingPersonProfile,
    MissingPersonSighting,
    UserNotificationPreference,
    AlertNotificationDelivery,
    AlertStatus,
    SightingStatus,
)
from app.models.notification import Notification, NotificationType
from app.models.user import User

logger = logging.getLogger(__name__)

EARTH_RADIUS_KM = 6371.0


def calculate_haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates great-circle distance between two GPS coordinates in kilometers."""
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return EARTH_RADIUS_KM * c


async def dispatch_missing_person_alert_notifications(
    db: AsyncSession,
    alert: MissingPersonAlert,
    profile: MissingPersonProfile,
) -> int:
    """
    Finds opted-in users within the alert radius and creates deduplicated in-app notifications.
    Returns the count of successfully dispatched notifications.
    """
    if profile.last_seen_latitude is None or profile.last_seen_longitude is None:
        logger.warning(f"Alert {alert.id} has no coordinates; skipping proximity dispatch.")
        return 0

    alert_lat = profile.last_seen_latitude
    alert_lng = profile.last_seen_longitude
    radius_km = alert.alert_radius_km

    # Query all users who opted into missing person alerts and have known coordinates
    stmt = select(UserNotificationPreference).where(
        and_(
            UserNotificationPreference.missing_person_alerts == True,
            UserNotificationPreference.last_known_latitude.is_not(None),
            UserNotificationPreference.last_known_longitude.is_not(None),
        )
    )
    result = await db.execute(stmt)
    prefs = result.scalars().all()

    # Query existing deliveries for this alert to prevent duplicates
    delivery_stmt = select(AlertNotificationDelivery.user_id).where(
        AlertNotificationDelivery.alert_id == alert.id
    )
    delivery_res = await db.execute(delivery_stmt)
    already_delivered_user_ids = set(delivery_res.scalars().all())

    dispatched_count = 0
    now = datetime.now(timezone.utc)

    for pref in prefs:
        if pref.user_id in already_delivered_user_ids:
            continue

        dist = calculate_haversine_distance(
            alert_lat,
            alert_lng,
            pref.last_known_latitude,
            pref.last_known_longitude,
        )

        if dist <= radius_km:
            # 1. Record delivery
            delivery = AlertNotificationDelivery(
                alert_id=alert.id,
                user_id=pref.user_id,
                delivered_at=now,
                channel="IN_APP",
            )
            db.add(delivery)

            # 2. Create in-app notification
            title_bn = "🚨 নিখোঁজ ব্যক্তি সতর্কতা"
            title_en = "🚨 Missing Person Alert"
            name_str = profile.name_bn or profile.full_name
            loc_str = profile.last_seen_location_bn or profile.last_seen_location
            
            message = (
                f"{name_str} - {loc_str} এর কাছাকাছি এলাকা থেকে নিখোঁজ সংবাদ পাওয়া গেছে। বিস্তারিত দেখে সাহায্য করুন। "
                f"({profile.full_name} reported missing near {profile.last_seen_location})"
            )

            notification = Notification(
                user_id=pref.user_id,
                type=NotificationType.MISSING_PERSON_ALERT,
                title=f"{title_en} / {title_bn}",
                message=message,
                report_id=alert.report_id,
            )
            db.add(notification)
            dispatched_count += 1

    if dispatched_count > 0:
        await db.commit()
        logger.info(f"Dispatched {dispatched_count} missing person notifications for alert {alert.id}.")

    return dispatched_count


async def notify_missing_person_found(
    db: AsyncSession,
    alert: MissingPersonAlert,
    profile: MissingPersonProfile,
) -> int:
    """Notifies users who previously received the alert or submitted sightings that the person is found."""
    # Find all users who received the alert or submitted sightings
    delivery_stmt = select(AlertNotificationDelivery.user_id).where(
        AlertNotificationDelivery.alert_id == alert.id
    )
    res = await db.execute(delivery_stmt)
    user_ids = set(res.scalars().all())

    sighting_stmt = select(MissingPersonSighting.user_id).where(
        and_(
            MissingPersonSighting.alert_id == alert.id,
            MissingPersonSighting.user_id.is_not(None),
        )
    )
    sighting_res = await db.execute(sighting_stmt)
    user_ids.update([uid for uid in sighting_res.scalars().all() if uid])

    count = 0
    name_str = profile.name_bn or profile.full_name
    for uid in user_ids:
        notif = Notification(
            user_id=uid,
            type=NotificationType.MISSING_PERSON_FOUND,
            title="✅ Person Found / ব্যক্তি উদ্ধার হয়েছেন",
            message=f"{name_str} নিরাপদে উদ্ধার হয়েছেন। সহায়তার জন্য ধন্যবাদ। ({profile.full_name} has been found safely. Thank you for your support.)",
            report_id=alert.report_id,
        )
        db.add(notif)
        count += 1

    if count > 0:
        await db.commit()
    return count


async def check_duplicate_missing_person_candidates(
    db: AsyncSession,
    full_name: str,
    age: Optional[int],
    exclude_profile_id: Optional[uuid.UUID] = None,
) -> int:
    """Finds potential duplicate active missing person profiles."""
    conditions = []
    if exclude_profile_id:
        conditions.append(MissingPersonProfile.id != exclude_profile_id)

    # Name similarity check
    p = f"%{full_name.strip()}%"
    conditions.append(MissingPersonProfile.full_name.ilike(p))

    if age is not None:
        conditions.append(
            or_(
                MissingPersonProfile.age == age,
                MissingPersonProfile.age.between(age - 2, age + 2),
            )
        )

    stmt = select(func.count(MissingPersonProfile.id)).where(and_(*conditions))
    return (await db.scalar(stmt)) or 0
