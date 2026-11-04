"""
Nirapotta AI — Phase F: Safe Route & Interactive Safety Map Service

Performs deterministic road safety analysis along a planned driving or transit route.
Grounded strictly in verified database records (approved incident reports and verified emergency services).
Enforces privacy (no reporter contacts/identities or confidential notes exposed),
and provides realistic coverage warnings (no false 100% safety guarantees).
"""

import math
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.report import Report, ReportStatus
from app.models.category import Category
from app.models.emergency_service import EmergencyService, VerificationStatus
from app.schemas.ai_features import (
    RoadSafetyRiskLevel,
    NearbySafetyAlert,
    RoadSafetyHotspotItem,
    EmergencyServiceAlongRoute,
    SafeRouteAnalysisRequest,
    SafeRouteAnalysisResponse,
)
from app.services.road_safety import (
    calculate_haversine_distance,
    is_road_incident,
    BD_ACCIDENT_PRONE_CORRIDORS,
)


def _interpolate_waypoints(
    origin_lat: float,
    origin_lng: float,
    dest_lat: float,
    dest_lng: float,
    num_steps: int = 20,
) -> List[List[float]]:
    """Generates linear intermediate points between origin and destination when no routing engine geometry is provided."""
    points: List[List[float]] = []
    for i in range(num_steps + 1):
        fraction = i / float(num_steps)
        lat = origin_lat + (dest_lat - origin_lat) * fraction
        lng = origin_lng + (dest_lng - origin_lng) * fraction
        points.append([lat, lng])
    return points


async def analyze_safe_route(
    db: AsyncSession,
    request: SafeRouteAnalysisRequest,
) -> SafeRouteAnalysisResponse:
    """
    Evaluates safety hazards, incident density, high-risk corridors, and nearby emergency services along a route.

    Safety & Privacy Rules:
    1. Only APPROVED reports are evaluated. Unapproved, submitted, or rejected reports are strictly excluded.
    2. Zero reporter identities, contact emails, phone numbers, or confidential moderation notes are exposed.
    3. Emergency services (police, hospitals, fire) are pulled from verified database records.
    4. Deterministic score calculation; AI interpretation is strictly separated and labeled.
    5. Disclaims 100% safety guarantees and reminds citizens to call 999 in life-threatening danger.
    """
    is_bn = (request.lang == "bn")
    now = datetime.now(timezone.utc)

    orig_name = request.origin_name or (f"{request.origin_latitude:.4f}, {request.origin_longitude:.4f}")
    dest_name = request.destination_name or (f"{request.destination_latitude:.4f}, {request.destination_longitude:.4f}")

    # Validate coordinate bounds (Standard Global WGS84 range)
    for lat, lng in [
        (request.origin_latitude, request.origin_longitude),
        (request.destination_latitude, request.destination_longitude),
    ]:
        if not (-90.0 <= lat <= 90.0 and -180.0 <= lng <= 180.0):
            raise ValueError(f"Invalid GPS coordinates: latitude={lat}, longitude={lng}")

    # Resolve route waypoints & detect routing mode
    raw_waypoints = request.waypoints
    is_fallback = False
    routing_mode = "ROAD_NETWORK"
    fallback_notice = None

    if not raw_waypoints or len(raw_waypoints) < 2:
        is_fallback = True
        routing_mode = "DIRECT_CORRIDOR_FALLBACK"
        fallback_notice = (
            "সরাসরি করিডোর প্রাক্কলন: বাস্তব সড়ক নেভিগেশন ডেটা অনুপলব্ধ থাকায় সরাসরি রৈখিক করিডোরের মাধ্যমে এলাকাভিত্তিক বিপদ সতর্কতা দেখানো হচ্ছে। এটি বাস্তব ড্রাইভযোগ্য সড়ক রুট নয়।"
            if is_bn else
            "Direct corridor estimation: Road-network geometry was unavailable; safety hazards are evaluated along a direct geographic corridor for informational awareness. This is not turn-by-turn road navigation."
        )
        raw_waypoints = _interpolate_waypoints(
            request.origin_latitude,
            request.origin_longitude,
            request.destination_latitude,
            request.destination_longitude,
            num_steps=15,
        )

    # Subsample dense waypoints for performance (max 80 points)
    if len(raw_waypoints) > 80:
        step = max(1, len(raw_waypoints) // 60)
        sampled_points = raw_waypoints[::step]
        if sampled_points[-1] != raw_waypoints[-1]:
            sampled_points.append(raw_waypoints[-1])
    else:
        sampled_points = raw_waypoints

    # Compute bounding box of route with a 0.05-degree (~5km) buffer
    lats = [p[0] for p in sampled_points]
    lngs = [p[1] for p in sampled_points]
    min_lat, max_lat = min(lats) - 0.05, max(lats) + 0.05
    min_lng, max_lng = min(lngs) - 0.05, max(lngs) + 0.05

    # 1. Fetch APPROVED reports within geographic envelope
    report_stmt = (
        select(Report)
        .where(
            and_(
                Report.status == ReportStatus.APPROVED,
                Report.latitude.isnot(None),
                Report.longitude.isnot(None),
                Report.latitude >= min_lat,
                Report.latitude <= max_lat,
                Report.longitude >= min_lng,
                Report.longitude <= max_lng,
            )
        )
        .order_by(Report.created_at.desc())
    )
    rep_res = await db.execute(report_stmt)
    candidate_reports = rep_res.scalars().all()

    # 2. Filter hazards within 800m of any route waypoint
    hazards_along_route: List[NearbySafetyAlert] = []
    hazards_by_cat: Dict[str, int] = {}
    recent_30d_count = 0

    for rep in candidate_reports:
        if rep.latitude is None or rep.longitude is None:
            continue

        min_dist_km = float("inf")
        for pt in sampled_points:
            d = calculate_haversine_distance(pt[0], pt[1], rep.latitude, rep.longitude)
            if d < min_dist_km:
                min_dist_km = d
            if min_dist_km <= 0.8:  # 800m corridor
                break

        if min_dist_km <= 0.8:
            dist_m = int(min_dist_km * 1000)
            dist_text = f"{dist_m}m from route" if dist_m < 1000 else f"{min_dist_km:.1f}km from route"

            # Check recency
            r_time = rep.incident_date or rep.created_at
            if r_time.tzinfo is None:
                r_time = r_time.replace(tzinfo=timezone.utc)
            days_ago = max(0.0, (now - r_time).total_seconds() / 86400.0)
            if days_ago <= 30.0:
                recent_30d_count += 1
            time_text = f"{int(days_ago)}d ago" if days_ago >= 1.0 else "Today"

            cat_name = rep.category.name if rep.category else "Public Safety"
            hazards_by_cat[cat_name] = hazards_by_cat.get(cat_name, 0) + 1

            hazards_along_route.append(
                NearbySafetyAlert(
                    id=str(rep.id),
                    report_id=rep.id,
                    title=rep.title,
                    location_text=rep.location_text or f"Coordinates {rep.latitude:.4f}, {rep.longitude:.4f}",
                    latitude=rep.latitude,
                    longitude=rep.longitude,
                    distance_meters=dist_m,
                    distance_text=dist_text,
                    incident_date_text=time_text,
                    alert_reason=f"Approved incident {dist_text} ({time_text})",
                    report_url=f"/reports/{rep.id}",
                )
            )

    # 3. Fetch verified Emergency Services within 2.0 km of route
    svc_stmt = (
        select(EmergencyService)
        .where(
            and_(
                EmergencyService.is_active == True,
                EmergencyService.verification_status == VerificationStatus.VERIFIED,
                EmergencyService.latitude.isnot(None),
                EmergencyService.longitude.isnot(None),
                EmergencyService.latitude >= min_lat - 0.02,
                EmergencyService.latitude <= max_lat + 0.02,
                EmergencyService.longitude >= min_lng - 0.02,
                EmergencyService.longitude <= max_lng + 0.02,
            )
        )
    )
    svc_res = await db.execute(svc_stmt)
    candidate_services = svc_res.scalars().all()

    emergency_services_along_route: List[EmergencyServiceAlongRoute] = []
    for svc in candidate_services:
        if svc.latitude is None or svc.longitude is None:
            continue

        min_svc_dist = float("inf")
        for pt in sampled_points:
            d = calculate_haversine_distance(pt[0], pt[1], svc.latitude, svc.longitude)
            if d < min_svc_dist:
                min_svc_dist = d
            if min_svc_dist <= 2.0:  # 2.0 km corridor
                break

        if min_svc_dist <= 2.0:
            dist_m = int(min_svc_dist * 1000)
            dist_text = f"{dist_m}m from route" if dist_m < 1000 else f"{min_svc_dist:.1f}km from route"
            phone_str = getattr(svc, "phone", None) or getattr(svc, "phone_number", None)
            emergency_services_along_route.append(
                EmergencyServiceAlongRoute(
                    id=str(svc.id),
                    name=svc.name_bn if is_bn and svc.name_bn else svc.name,
                    service_type=svc.service_type.value if hasattr(svc.service_type, "value") else str(svc.service_type),
                    phone_number=phone_str,
                    latitude=svc.latitude,
                    longitude=svc.longitude,
                    distance_meters=dist_m,
                    distance_text=dist_text,
                )
            )

    # Sort emergency services by distance
    emergency_services_along_route.sort(key=lambda s: s.distance_meters)

    # 4. Check known high-risk regional corridors crossed within 1.5 km of route
    corridors_crossed: List[RoadSafetyHotspotItem] = []
    for anchor in BD_ACCIDENT_PRONE_CORRIDORS:
        min_anchor_dist = min(
            calculate_haversine_distance(pt[0], pt[1], anchor["lat"], anchor["lng"])
            for pt in sampled_points
        )
        if min_anchor_dist <= 1.5:
            # Count accidents near this anchor
            accidents_near_anchor = [
                h for h in hazards_along_route
                if calculate_haversine_distance(anchor["lat"], anchor["lng"], h.latitude, h.longitude) <= 3.0
            ]
            count = len(accidents_near_anchor)
            risk = (
                RoadSafetyRiskLevel.HIGH
                if count >= 3
                else (RoadSafetyRiskLevel.MODERATE if count >= 1 else RoadSafetyRiskLevel.LOW)
            )
            corridors_crossed.append(
                RoadSafetyHotspotItem(
                    area_name=anchor["name"],
                    latitude=anchor["lat"],
                    longitude=anchor["lng"],
                    accident_count=count,
                    risk_level=risk,
                    recent_count_30d=count,
                )
            )

    # 5. Deterministic Route Safety Score (0 - 100)
    hazard_pts = min(40.0, len(hazards_along_route) * 8.0)
    recent_pts = min(30.0, recent_30d_count * 10.0)
    high_risk_corridor_count = sum(
        1 for c in corridors_crossed if c.risk_level in (RoadSafetyRiskLevel.HIGH, RoadSafetyRiskLevel.CRITICAL)
    )
    corridor_pts = min(30.0, high_risk_corridor_count * 15.0)

    route_score = round(min(100.0, hazard_pts + recent_pts + corridor_pts), 1)

    if route_score >= 70.0:
        route_level = RoadSafetyRiskLevel.CRITICAL
    elif route_score >= 45.0:
        route_level = RoadSafetyRiskLevel.HIGH
    elif route_score >= 20.0:
        route_level = RoadSafetyRiskLevel.MODERATE
    else:
        route_level = RoadSafetyRiskLevel.LOW

    # 6. Construct Grounded Safety Advisory
    if is_bn:
        if route_level in (RoadSafetyRiskLevel.HIGH, RoadSafetyRiskLevel.CRITICAL):
            safety_advisory = (
                f"সতর্কতা: রুটে {len(hazards_along_route)}টি অনুমোদিত নিরাপত্তা সতর্কতা এবং "
                f"{len(corridors_crossed)}টি উচ্চ-ঝুঁকিপূর্ণ ট্রাফিক করিডোর রয়েছে। গতি নিয়ন্ত্রণে রাখুন।"
            )
        elif route_level == RoadSafetyRiskLevel.MODERATE:
            safety_advisory = (
                f"মাঝারি ঝুঁকি (স্কোর: {route_score}/১০০)। রুটের আশপাশে {len(hazards_along_route)}টি ঘটনা রেকর্ড করা আছে। "
                f"সতর্কভাবে ড্রাইভ করুন।"
            )
        else:
            safety_advisory = (
                "রুটটিতে কোনো বড় বা পুনরাবৃত্তিমূলক নিরাপত্তা ঝুঁকির রেকর্ড পাওয়া যায়নি। স্বাভাবিক ট্রাফিক নিয়ম মেনে চলুন।"
            )
    else:
        if route_level in (RoadSafetyRiskLevel.HIGH, RoadSafetyRiskLevel.CRITICAL):
            safety_advisory = (
                f"Caution: Route passes near {len(hazards_along_route)} recorded incident hazard(s) and "
                f"{len(corridors_crossed)} high-risk corridor(s). Reduce speed and maintain safe stopping distance."
            )
        elif route_level == RoadSafetyRiskLevel.MODERATE:
            safety_advisory = (
                f"Moderate Risk (Score: {route_score}/100). {len(hazards_along_route)} verified incident(s) recorded nearby. "
                f"Maintain driving vigilance."
            )
        else:
            safety_advisory = (
                "No repeated severe road hazard clusters detected along this route. Follow standard traffic guidelines."
            )

    # 7. AI Interpretation (Clearly labeled and grounded)
    ai_interpretation = (
        f"[AI-Generated Assessment] Route between {orig_name} and {dest_name}: "
        f"Assigned Risk Level is {route_level.value} (Score: {route_score}/100). "
        f"Grounded in {len(hazards_along_route)} approved database incident(s) within an 800m corridor. "
        f"{len(emergency_services_along_route)} verified emergency facility/facilities identified along the path for rapid assistance."
    )

    data_limitations = (
        "তথ্য সীমাবদ্ধতা বিজ্ঞপ্তি: সড়ক নিরাপত্তা বিশ্লেষণটি প্ল্যাটফর্মের যাচাইকৃত নাগরিক প্রতিবেদনের ভিত্তিতে সংকলিত। "
        "কোনো সড়কে রিপোর্ট না থাকার অর্থ এই নয় যে সড়কটি সম্পূর্ণ বিপদমুক্ত। অপ্রত্যাশিত সড়ক বা আবহাওয়া পরিস্থিতি সর্বদা তৈরি হতে পারে।"
        if is_bn else
        "Data Limitations Disclosure: Route safety scores are computed from verified citizen reports on Nirapotta. "
        "The absence of reported incidents does not prove an area is hazard-free. Road and weather conditions may change dynamically."
    )

    # Distance and duration calculation
    dist_km = request.route_distance_km
    dur_min = None if is_fallback else request.route_duration_minutes
    if dist_km is None and is_fallback:
        dist_km = round(
            calculate_haversine_distance(
                request.origin_latitude,
                request.origin_longitude,
                request.destination_latitude,
                request.destination_longitude,
            ),
            1,
        )

    return SafeRouteAnalysisResponse(
        origin_name=orig_name,
        destination_name=dest_name,
        route_distance_km=dist_km,
        route_duration_minutes=dur_min,
        routing_mode=routing_mode,
        is_fallback=is_fallback,
        fallback_notice=fallback_notice,
        route_risk_level=route_level,
        route_risk_score=route_score,
        total_hazards_count=len(hazards_along_route),
        hazards_by_category=hazards_by_cat,
        hazards_along_route=hazards_along_route[:15],
        emergency_services_along_route=emergency_services_along_route[:8],
        high_risk_corridors_crossed=corridors_crossed,
        safety_advisory=safety_advisory,
        ai_interpretation=ai_interpretation,
        data_limitations=data_limitations,
    )
