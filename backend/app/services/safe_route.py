"""
Nirapotta AI — Phase F: Safe Route & Interactive Safety Map Service

Performs deterministic road safety analysis along a planned driving or transit route.
Grounded strictly in verified database records (approved incident reports, verified emergency services,
and documented accident-prone highway blackspots).
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
from app.models.accident_zone import AccidentZone
from app.schemas.ai_features import (
    RoadSafetyRiskLevel,
    NearbySafetyAlert,
    RoadSafetyHotspotItem,
    EmergencyServiceAlongRoute,
    SafeRouteAnalysisRequest,
    SafeRouteAnalysisResponse,
    AccidentZoneItem,
    RouteAlternativeComparison,
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
    Evaluates safety hazards, incident density, high-risk corridors, documented accident-prone zones,
    vehicle safety compliance (helmet for motorcycle / seatbelt for car), and route alternatives.
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

    # 3. Fetch Documented Accident-Prone Zones from DB
    accident_zones_along_route: List[AccidentZoneItem] = []
    zone_stmt = (
        select(AccidentZone)
        .where(
            and_(
                AccidentZone.latitude >= min_lat - 0.02,
                AccidentZone.latitude <= max_lat + 0.02,
                AccidentZone.longitude >= min_lng - 0.02,
                AccidentZone.longitude <= max_lng + 0.02,
            )
        )
    )
    zone_res = await db.execute(zone_stmt)
    candidate_zones = zone_res.scalars().all()

    for zone in candidate_zones:
        min_zone_dist_km = float("inf")
        for pt in sampled_points:
            d = calculate_haversine_distance(pt[0], pt[1], zone.latitude, zone.longitude)
            if d < min_zone_dist_km:
                min_zone_dist_km = d
            if min_zone_dist_km <= (zone.radius_meters / 1000.0) + 0.3:
                break

        if min_zone_dist_km <= (zone.radius_meters / 1000.0) + 0.3:
            dist_m = int(min_zone_dist_km * 1000)
            accident_zones_along_route.append(
                AccidentZoneItem(
                    id=str(zone.id),
                    zone_name=zone.zone_name_bn if is_bn and zone.zone_name_bn else zone.zone_name,
                    zone_name_bn=zone.zone_name_bn,
                    road_name=zone.road_name,
                    district=zone.district,
                    division=zone.division,
                    latitude=zone.latitude,
                    longitude=zone.longitude,
                    radius_meters=zone.radius_meters,
                    accident_count=zone.accident_count,
                    observation_period=zone.observation_period,
                    data_source=zone.data_source,
                    source_url=zone.source_url,
                    verification_status=zone.verification_status.value if hasattr(zone.verification_status, "value") else str(zone.verification_status),
                    risk_level=zone.risk_level,
                    description=zone.description_bn if is_bn and zone.description_bn else zone.description,
                    distance_meters=dist_m,
                )
            )

    # Sort accident zones by proximity
    accident_zones_along_route.sort(key=lambda z: z.distance_meters or 0)

    # 4. Fetch verified Emergency Services within 2.0 km of route
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

    emergency_services_along_route.sort(key=lambda s: s.distance_meters)

    # 5. Check known high-risk regional corridors crossed within 1.5 km of route
    corridors_crossed: List[RoadSafetyHotspotItem] = []
    for anchor in BD_ACCIDENT_PRONE_CORRIDORS:
        min_anchor_dist = min(
            calculate_haversine_distance(pt[0], pt[1], anchor["lat"], anchor["lng"])
            for pt in sampled_points
        )
        if min_anchor_dist <= 1.5:
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

    # 6. Deterministic Route Safety Score (0 - 100)
    hazard_pts = min(30.0, len(hazards_along_route) * 6.0)
    recent_pts = min(20.0, recent_30d_count * 8.0)
    accident_zone_pts = min(40.0, sum(20.0 if z.risk_level == "CRITICAL" else 12.0 for z in accident_zones_along_route))
    high_risk_corridor_count = sum(
        1 for c in corridors_crossed if c.risk_level in (RoadSafetyRiskLevel.HIGH, RoadSafetyRiskLevel.CRITICAL)
    )
    corridor_pts = min(20.0, high_risk_corridor_count * 10.0)

    route_score = round(min(100.0, hazard_pts + recent_pts + accident_zone_pts + corridor_pts), 1)

    if route_score >= 70.0:
        route_level = RoadSafetyRiskLevel.CRITICAL
    elif route_score >= 45.0:
        route_level = RoadSafetyRiskLevel.HIGH
    elif route_score >= 20.0:
        route_level = RoadSafetyRiskLevel.MODERATE
    else:
        route_level = RoadSafetyRiskLevel.LOW

    # 7. Vehicle Compliance & Verification
    vehicle_type = (request.vehicle_type or "MOTORCYCLE").upper()
    safety_confirmed = bool(request.safety_confirmed)
    verification_status = "VERIFIED" if safety_confirmed else "PENDING_CONFIRMATION"

    # 8. Evaluate Route Alternatives (Shortest vs Safest)
    route_alternatives: List[RouteAlternativeComparison] = []
    if request.alternative_geometries and len(request.alternative_geometries) > 0:
        for idx, alt in enumerate(request.alternative_geometries):
            alt_dist = float(alt.get("distance_km", request.route_distance_km or 5.0))
            alt_dur = float(alt.get("duration_minutes", request.route_duration_minutes or 15.0))
            alt_coords = alt.get("coordinates", [])

            # Count hazards and zones along alternative
            alt_hazards_count = 0
            alt_zones_count = 0
            if alt_coords:
                step_a = max(1, len(alt_coords) // 40)
                sub_pts = [[c[1], c[0]] for c in alt_coords[::step_a]]
                for rep in candidate_reports:
                    if rep.latitude and rep.longitude:
                        if any(calculate_haversine_distance(p[0], p[1], rep.latitude, rep.longitude) <= 0.8 for p in sub_pts):
                            alt_hazards_count += 1
                for z in candidate_zones:
                    if any(calculate_haversine_distance(p[0], p[1], z.latitude, z.longitude) <= (z.radius_meters / 1000.0) + 0.3 for p in sub_pts):
                        alt_zones_count += 1

            alt_score = round(min(100.0, (alt_hazards_count * 8.0) + (alt_zones_count * 20.0)), 1)
            alt_level = (
                RoadSafetyRiskLevel.CRITICAL if alt_score >= 70.0
                else RoadSafetyRiskLevel.HIGH if alt_score >= 45.0
                else RoadSafetyRiskLevel.MODERATE if alt_score >= 20.0
                else RoadSafetyRiskLevel.LOW
            )

            route_alternatives.append(
                RouteAlternativeComparison(
                    route_id=f"route_{idx}",
                    label=f"Route {idx + 1}" if idx > 0 else "Primary Route",
                    distance_km=alt_dist,
                    duration_minutes=alt_dur,
                    risk_level=alt_level,
                    risk_score=alt_score,
                    accident_zones_count=alt_zones_count,
                    hazards_count=alt_hazards_count,
                    is_safest=False,
                    is_shortest=False,
                    recommendation_summary="",
                )
            )

        if route_alternatives:
            min_dist = min(r.distance_km for r in route_alternatives)
            min_risk = min(r.risk_score for r in route_alternatives)

            for r in route_alternatives:
                if r.distance_km == min_dist:
                    r.is_shortest = True
                if r.risk_score == min_risk:
                    r.is_safest = True

                if r.is_safest and r.is_shortest:
                    r.recommendation_summary = (
                        "সর্বাধিক নিরাপদ ও ক্ষুদ্রতম রুট (সেরা বিকল্প)।" if is_bn
                        else "Optimal Choice: Both the shortest distance and the lowest accident risk."
                    )
                elif r.is_safest:
                    r.recommendation_summary = (
                        f"নিরাপদ বিকল্প: দুর্ঘটনা জোন এড়িয়ে যায় (ঝুঁকি স্কোর: {r.risk_score}/১০০)।" if is_bn
                        else f"Safest Choice: Avoids documented accident zones (Risk Score: {r.risk_score}/100)."
                    )
                elif r.is_shortest:
                    r.recommendation_summary = (
                        f"ক্ষুদ্রতম দূরত্ব: {r.distance_km} কিমি, তবে বেশি ট্রাফিক বা দুর্ঘটনার ঝুঁকি থাকতে পারে।" if is_bn
                        else f"Shortest Route: {r.distance_km} km, but traverses higher accident hazard density."
                    )
                else:
                    r.recommendation_summary = (
                        "বিকল্প সড়ক রুট।" if is_bn else "Alternative road corridor."
                    )

    # 9. Road AI Grounded Safety Guidance
    guidance_lines = []
    if not safety_confirmed:
        if vehicle_type == "MOTORCYCLE":
            guidance_lines.append(
                "সতর্কতা: মোটরসাইকেল চালক ও আরোহী উভয়ের হেলমেট পরিধান আইনিভাবে বাধ্যতামূলক। ড্রাইভ শুরুর আগে হেলমেট পরিধান নিশ্চিত করুন।"
                if is_bn else
                "Warning: Helmet wearing is legally mandatory for motorcycle riders. Please confirm helmet compliance before initiating drive."
            )
        else:
            guidance_lines.append(
                "সতর্কতা: গাড়ির সিটবেল্ট বাঁধা নিশ্চিত করুন। নিরাপদ ড্রাইভের জন্য সিটবেল্ট সুরক্ষা অত্যাবশ্যক।"
                if is_bn else
                "Warning: Please fasten your seatbelt. Seatbelt compliance is mandatory for safe driving."
            )
    else:
        guidance_lines.append(
            f"সুরক্ষা নিশ্চিতকরণ সম্পন্ন ({'হেলমেট ভেরিফাইড' if vehicle_type == 'MOTORCYCLE' else 'সিটবেল্ট নিশ্চিত'})।"
            if is_bn else
            f"Safety requirement confirmed ({'Helmet verified' if vehicle_type == 'MOTORCYCLE' else 'Seatbelt confirmed'})."
        )

    if accident_zones_along_route:
        top_zone = accident_zones_along_route[0]
        guidance_lines.append(
            f"মনোযোগ: আপনার নির্বাচিত রুটটি বিআরটিএ ও হাইওয়ে পুলিশ চিহ্নিত দুর্ঘটনাপ্রবণ জোন '{top_zone.zone_name}' ({top_zone.road_name})-এর মধ্য দিয়ে অতিক্রম করছে। সতর্ক গতি বজায় রাখুন।"
            if is_bn else
            f"Attention: Your selected route traverses documented accident-prone zone '{top_zone.zone_name}' ({top_zone.road_name}, Source: {top_zone.data_source}). Maintain safe following distance."
        )

    if route_alternatives:
        safest = next((r for r in route_alternatives if r.is_safest), None)
        shortest = next((r for r in route_alternatives if r.is_shortest), None)
        if safest and shortest and safest.route_id != shortest.route_id:
            diff_km = round(safest.distance_km - shortest.distance_km, 1)
            diff_time = int(safest.duration_minutes - shortest.duration_minutes)
            guidance_lines.append(
                f"পরামর্শ: বিকল্প নিরাপদ রুটটি {diff_km} কিমি দীর্ঘ (~{diff_time} মিনিট অতিরিক্ত), কিন্তু এটি প্রধান দুর্ঘটনা জোন এড়িয়ে যায়।"
                if is_bn else
                f"Advisory: The safest route is {diff_km} km longer (~{diff_time} min), but bypasses critical accident blackspots."
            )

    road_ai_guidance = " ".join(guidance_lines)

    # 10. Construct Grounded Safety Advisory
    if is_bn:
        if route_level in (RoadSafetyRiskLevel.HIGH, RoadSafetyRiskLevel.CRITICAL):
            safety_advisory = (
                f"সতর্কতা: রুটে {len(hazards_along_route)}টি অনুমোদিত নাগরিক রিপোর্ট এবং "
                f"{len(accident_zones_along_route)}টি নথিভুক্ত দুর্ঘটনা ব্ল্যাকস্পট রয়েছে। গতি নিয়ন্ত্রণে রাখুন।"
            )
        elif route_level == RoadSafetyRiskLevel.MODERATE:
            safety_advisory = (
                f"মাঝারি ঝুঁকি (স্কোর: {route_score}/১০০)। রুটের আশপাশে {len(hazards_along_route)}টি ঘটনা ও "
                f"{len(accident_zones_along_route)}টি চিহ্নিত জোন রয়েছে।"
            )
        else:
            safety_advisory = (
                "রুটটিতে কোনো বড় বা পুনরাবৃত্তিমূলক নিরাপত্তা ঝুঁকির রেকর্ড পাওয়া যায়নি। স্বাভাবিক ট্রাফিক নিয়ম মেনে চলুন।"
            )
    else:
        if route_level in (RoadSafetyRiskLevel.HIGH, RoadSafetyRiskLevel.CRITICAL):
            safety_advisory = (
                f"Caution: Route passes near {len(hazards_along_route)} recorded incident hazard(s) and "
                f"{len(accident_zones_along_route)} documented accident blackspot(s). Reduce speed and maintain safe stopping distance."
            )
        elif route_level == RoadSafetyRiskLevel.MODERATE:
            safety_advisory = (
                f"Moderate Risk (Score: {route_score}/100). {len(hazards_along_route)} verified incident(s) and "
                f"{len(accident_zones_along_route)} documented zone(s) nearby. Maintain driving vigilance."
            )
        else:
            safety_advisory = (
                "No repeated severe road hazard clusters detected along this route. Follow standard traffic guidelines."
            )

    ai_interpretation = (
        f"[AI-Generated Assessment] Route between {orig_name} and {dest_name}: "
        f"Assigned Risk Level is {route_level.value} (Score: {route_score}/100). "
        f"Grounded in {len(hazards_along_route)} approved database incident(s) and {len(accident_zones_along_route)} documented highway blackspot(s). "
        f"{len(emergency_services_along_route)} verified emergency facility/facilities identified along the path for rapid assistance."
    )

    data_limitations = (
        "তথ্য সীমাবদ্ধতা বিজ্ঞপ্তি: সড়ক নিরাপত্তা বিশ্লেষণটি প্ল্যাটফর্মের যাচাইকৃত নাগরিক প্রতিবেদন এবং বিআরটিএ/বিইউইটি এআরআই-এর ঐতিহাসিক দুর্ঘটনা রেকর্ডের ভিত্তিতে সংকলিত। "
        "কোনো সড়কে রিপোর্ট না থাকার অর্থ এই নয় যে সড়কটি সম্পূর্ণ বিপদমুক্ত। অপ্রত্যাশিত সড়ক বা আবহাওয়া পরিস্থিতি সর্বদা তৈরি হতে পারে।"
        if is_bn else
        "Data Limitations Disclosure: Route safety scores are computed from verified citizen reports and documented ARI BUET/BRTA highway statistics. "
        "The absence of reported incidents does not prove an area is hazard-free. Road and weather conditions may change dynamically."
    )

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
        accident_zones_along_route=accident_zones_along_route,
        route_alternatives=route_alternatives,
        vehicle_type=vehicle_type,
        safety_verification_status=verification_status,
        road_ai_guidance=road_ai_guidance,
        safety_advisory=safety_advisory,
        ai_interpretation=ai_interpretation,
        data_limitations=data_limitations,
    )
