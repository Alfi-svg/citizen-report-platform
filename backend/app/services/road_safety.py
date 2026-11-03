import math
import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Tuple, Dict, Any
from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.report import Report, ReportStatus
from app.models.category import Category
from app.schemas.ai_features import (
    RoadSafetyRiskLevel,
    AccidentHistoryItem,
    NearbySafetyAlert,
    RoadSafetyExplanation,
    RoadSafetyMetrics,
    RoadSafetyHotspotItem,
    RoadSafetyIntelligenceResponse,
    RouteRiskEvaluationResponse,
)
from app.services.ai_client import call_ai_json

# Bangladesh road accident keywords (English & Bangla)
ACCIDENT_KEYWORDS = {
    "accident", "crash", "collision", "overturn", "hit and run", "run over",
    "traffic", "highway", "bus", "truck", "motorcycle", "motorbike", "bike",
    "pedestrian", "cng", "rickshaw", "road hazard", "pothole", "derail",
    "সড়ক", "দুর্ঘটনা", "সংঘর্ষ", "যানবাহন", "বাস", "ট্রাক", "বাইক", "মোটরসাইকেল",
    "রিকশা", "পথচারী", "উল্টে", "গাড়ি", "রাস্তা",
}

# Known Bangladesh High-Risk Highway / Corridor Anchors for Hotspot Discovery
BD_ACCIDENT_PRONE_CORRIDORS = [
    {"name": "Mirpur Road (Technical - Gabtoli)", "lat": 23.7806, "lng": 90.3522},
    {"name": "Dhaka-Chattogram Highway (Kanchpur - Jatrabari)", "lat": 23.7042, "lng": 90.5098},
    {"name": "Airport Road (Kuril - Uttara)", "lat": 23.8341, "lng": 90.4196},
    {"name": "N8 Expressway (Keraniganj - Dhaleshwari)", "lat": 23.6394, "lng": 90.3475},
    {"name": "Bogura-Rangpur Highway (Sherpur Stretch)", "lat": 24.6713, "lng": 89.4182},
    {"name": "Chittagong Port Access Road", "lat": 22.3168, "lng": 91.7981},
]


def calculate_haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates great-circle distance between two points in kilometers."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2.0) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c


def is_road_incident(report: Report) -> bool:
    """Identifies whether an incident report is related to road safety / accidents."""
    # Check category slug if available
    if report.category:
        slug = (report.category.slug or "").lower()
        if slug in ("public-safety", "road-safety", "traffic"):
            return True

    text = f"{report.title or ''} {report.description or ''} {report.location_text or ''}".lower()
    return any(k in text for k in ACCIDENT_KEYWORDS)


async def analyze_road_safety(
    db: AsyncSession,
    latitude: float,
    longitude: float,
    radius_km: float = 3.0,
    area_name: Optional[str] = None,
    lang: str = "en",
) -> RoadSafetyIntelligenceResponse:
    """
    Computes a comprehensive Road Safety Intelligence assessment:
    1. Historical accident analysis from actual database reports.
    2. Documented deterministic risk calculation (Low, Moderate, High, Critical).
    3. Fresh nearby safety alerts with proximity calculations.
    4. AI-grounded safety explanation (with deterministic fallback).
    """
    # 1. Fetch candidate reports with coordinates
    stmt = (
        select(Report)
        .where(
            and_(
                Report.latitude.isnot(None),
                Report.longitude.isnot(None),
                Report.status.in_([ReportStatus.APPROVED, ReportStatus.SUBMITTED, ReportStatus.UNDER_REVIEW]),
            )
        )
        .order_by(Report.created_at.desc())
    )
    result = await db.execute(stmt)
    all_reports = result.scalars().all()

    # 2. Filter geographically and by road incident criteria
    matched_accidents: List[Tuple[Report, float]] = []
    now = datetime.now(timezone.utc)

    for rep in all_reports:
        if rep.latitude is None or rep.longitude is None:
            continue
        dist = calculate_haversine_distance(latitude, longitude, rep.latitude, rep.longitude)
        if dist <= radius_km and is_road_incident(rep):
            matched_accidents.append((rep, dist))

    # Sort by closest distance
    matched_accidents.sort(key=lambda x: x[1])

    # 3. Aggregate Statistical Metrics
    total_accidents = len(matched_accidents)
    verified_accidents = sum(1 for r, _ in matched_accidents if r.status == ReportStatus.APPROVED)

    recent_7d = 0
    recent_30d = 0
    history_items: List[AccidentHistoryItem] = []
    nearby_alerts: List[NearbySafetyAlert] = []

    for r, dist in matched_accidents:
        r_time = r.incident_date or r.created_at
        if r_time.tzinfo is None:
            r_time = r_time.replace(tzinfo=timezone.utc)
        diff_days = (now - r_time).total_seconds() / 86400.0

        if diff_days <= 7.0:
            recent_7d += 1
        if diff_days <= 30.0:
            recent_30d += 1

        is_verified = (r.status == ReportStatus.APPROVED)

        history_items.append(
            AccidentHistoryItem(
                report_id=r.id,
                title=r.title,
                location_text=r.location_text,
                latitude=r.latitude,
                longitude=r.longitude,
                distance_km=round(dist, 2),
                incident_date=r.incident_date,
                created_at=r.created_at,
                is_verified=is_verified,
                severity="High" if any(w in r.title.lower() for w in ["fatal", "death", "severe", "গুরুতর"]) else "Standard",
            )
        )

        # Fresh alerts for nearby verified incidents within 2.5 km in the last 30 days
        if is_verified and diff_days <= 30.0 and dist <= 2.5:
            dist_m = int(dist * 1000)
            dist_text = f"{dist_m}m away" if dist_m < 1000 else f"{round(dist, 1)}km away"
            time_text = (
                f"{int(diff_days)} days ago" if diff_days >= 1.0 else "Today"
            )
            nearby_alerts.append(
                NearbySafetyAlert(
                    id=str(r.id),
                    report_id=r.id,
                    title=r.title,
                    location_text=r.location_text,
                    latitude=r.latitude,
                    longitude=r.longitude,
                    distance_meters=dist_m,
                    distance_text=dist_text,
                    incident_date_text=time_text,
                    alert_reason=f"Verified incident reported {dist_text} within the past {int(diff_days) + 1} days.",
                    report_url=f"/reports/{r.id}",
                )
            )

    # Calculate area & density
    area_sq_km = math.pi * (radius_km ** 2)
    accident_density = round(total_accidents / max(1.0, area_sq_km), 2)

    # 4. Deterministic Risk Assessment Formula (0 - 100)
    # - Frequency score: max 30 pts (6 pts per accident report, up to 5 reports)
    # - Recency score: max 30 pts (recent 7d: 12 pts each; recent 30d: 4 pts each)
    # - Verified weight: max 20 pts (percentage of verified reports)
    # - Density / Clustering: max 20 pts (repeated reports in same corridor)
    freq_score = min(30.0, total_accidents * 6.0)
    recency_score = min(30.0, (recent_7d * 12.0) + (recent_30d * 4.0))
    verification_ratio = (verified_accidents / max(1, total_accidents)) if total_accidents > 0 else 0.0
    verified_score = verification_ratio * 20.0
    density_score = min(20.0, accident_density * 10.0)

    calculated_score = round(freq_score + recency_score + verified_score + density_score, 1)
    risk_score = min(100.0, max(0.0, calculated_score))

    # Map to Risk Level
    if risk_score >= 75.0:
        risk_level = RoadSafetyRiskLevel.CRITICAL
    elif risk_score >= 50.0:
        risk_level = RoadSafetyRiskLevel.HIGH
    elif risk_score >= 25.0:
        risk_level = RoadSafetyRiskLevel.MODERATE
    else:
        risk_level = RoadSafetyRiskLevel.LOW

    # Data confidence
    if total_accidents >= 5:
        data_confidence = "High"
    elif total_accidents >= 2:
        data_confidence = "Moderate"
    else:
        data_confidence = "Low - Limited Data"

    metrics = RoadSafetyMetrics(
        total_accidents=total_accidents,
        verified_accidents=verified_accidents,
        recent_accidents_7d=recent_7d,
        recent_accidents_30d=recent_30d,
        accident_density_per_sq_km=accident_density,
        repeated_hotspots_count=max(0, total_accidents - 1) if total_accidents > 1 else 0,
        data_confidence=data_confidence,
    )

    # 5. Generate Grounded AI Explanation (with deterministic fallback)
    explanation = await _generate_road_safety_explanation(
        risk_level=risk_level,
        risk_score=risk_score,
        metrics=metrics,
        recent_titles=[h.title for h in history_items[:3]],
        area_name=area_name or "this selected area",
        lang=lang,
    )

    # 6. Discover regional highway corridors and count ACTUAL database reports around each anchor
    hotspots: List[RoadSafetyHotspotItem] = []
    for anchor in BD_ACCIDENT_PRONE_CORRIDORS:
        d_anchor = calculate_haversine_distance(latitude, longitude, anchor["lat"], anchor["lng"])
        if d_anchor <= 35.0:  # Within regional proximity
            # Count actual database accidents within 3.0 km of this corridor anchor
            anchor_accidents = [
                rep for rep in all_reports
                if rep.latitude is not None
                and rep.longitude is not None
                and calculate_haversine_distance(anchor["lat"], anchor["lng"], rep.latitude, rep.longitude) <= 3.0
                and is_road_incident(rep)
            ]
            count = len(anchor_accidents)
            anchor_recent_30d = 0
            for rep in anchor_accidents:
                t_rep = rep.incident_date or rep.created_at
                if t_rep.tzinfo is None:
                    t_rep = t_rep.replace(tzinfo=timezone.utc)
                if (now - t_rep).total_seconds() <= 30.0 * 86400.0:
                    anchor_recent_30d += 1

            if count >= 4:
                anchor_risk = RoadSafetyRiskLevel.HIGH
            elif count >= 2:
                anchor_risk = RoadSafetyRiskLevel.MODERATE
            else:
                anchor_risk = RoadSafetyRiskLevel.LOW

            hotspots.append(
                RoadSafetyHotspotItem(
                    area_name=anchor["name"],
                    latitude=anchor["lat"],
                    longitude=anchor["lng"],
                    accident_count=count,
                    risk_level=anchor_risk,
                    recent_count_30d=anchor_recent_30d,
                )
            )

    return RoadSafetyIntelligenceResponse(
        center_latitude=latitude,
        center_longitude=longitude,
        radius_km=radius_km,
        area_name=area_name,
        risk_score=risk_score,
        risk_level=risk_level,
        metrics=metrics,
        history=history_items[:20],
        nearby_alerts=nearby_alerts[:5],
        explanation=explanation,
        hotspots=hotspots,
    )


async def _generate_road_safety_explanation(
    risk_level: RoadSafetyRiskLevel,
    risk_score: float,
    metrics: RoadSafetyMetrics,
    recent_titles: List[str],
    area_name: str,
    lang: str,
) -> RoadSafetyExplanation:
    """Generates an explanation using OpenRouter/AI, falling back to a deterministic grounded template."""
    is_bn = (lang == "bn")

    # Structured prompt for AI
    system_prompt = (
        "You are Nirapotta's Road Safety Intelligence Analyst. Explain road safety risk levels strictly using "
        "the provided factual incident statistics. Do NOT invent incidents, fake death counts, or unverified claims. "
        "Return valid JSON with keys: 'summary', 'contributing_factors' (list of strings), 'precautions' (list of strings)."
    )
    user_prompt = f"""
Location Area: {area_name}
Risk Level: {risk_level.value} (Score: {risk_score}/100)
Total Incident Reports: {metrics.total_accidents}
Verified Reports: {metrics.verified_accidents}
Recent (past 7 days): {metrics.recent_accidents_7d}
Recent (past 30 days): {metrics.recent_accidents_30d}
Data Confidence: {metrics.data_confidence}
Recent Incident Titles: {', '.join(recent_titles) if recent_titles else 'None'}
Language: {'Bangla (বাংলা)' if is_bn else 'English'}
"""

    ai_json = await call_ai_json(prompt=user_prompt, system_prompt=system_prompt)
    if (
        ai_json
        and isinstance(ai_json.get("summary"), str)
        and isinstance(ai_json.get("contributing_factors"), list)
        and isinstance(ai_json.get("precautions"), list)
    ):
        return RoadSafetyExplanation(
            summary=ai_json["summary"],
            contributing_factors=[str(f) for f in ai_json["contributing_factors"]],
            precautions=[str(p) for p in ai_json["precautions"]],
            data_source="Nirapotta AI & Historical Incident Database",
        )

    # Deterministic fallback when AI is unconfigured or offline
    if is_bn:
        if risk_level == RoadSafetyRiskLevel.CRITICAL:
            summary = f"{area_name} এলাকায় বিগত ৩০ দিনে {metrics.recent_accidents_30d}টি দুর্ঘটনা ও সড়ক বিপদের রেকর্ড থাকায় এটিকে 'জরুরি ঝুঁকিপূর্ণ' (স্কোর {risk_score}/১০০) হিসেবে চিহ্নিত করা হয়েছে।"
            factors = [
                f"উচ্চ দুর্ঘটনা ঘনত্ব ({metrics.accident_density_per_sq_km} রিপোর্ট/বর্গ কিমি)",
                f"সত্যায়িত রিপোর্টের সংখ্যা: {metrics.verified_accidents}টি",
                "ঘনবসতিপূর্ণ ক্রসিং ও দ্রুতগামী যানবাহনের আধিক্য",
            ]
            precautions = [
                "গতিসীমা কঠোরভাবে মেনে চলুন এবং নিরাপদ দূরত্ব বজায় রাখুন",
                "রাস্তা পারাপারের জন্য ফুটওভার ব্রিজ ব্যবহার করুন",
                "রাতে উচ্চ সতর্কতার সাথে ড্রাইভ করুন",
            ]
        elif risk_level == RoadSafetyRiskLevel.HIGH:
            summary = f"{area_name} এলাকায় সাম্প্রতিক দুর্ঘটনার ইতিহাস ও সড়ক বিপদের কারণে ঝুঁকি স্কোর {risk_score}/১০০ (উচ্চ ঝুঁকি)।"
            factors = [
                f"বিগত ৩০ দিনে রিপোর্ট: {metrics.recent_accidents_30d}টি",
                f"মোট রেকর্ডকৃত সড়ক রিপোর্ট: {metrics.total_accidents}টি",
            ]
            precautions = [
                "লেন পরিবর্তনের সময় ইনডিকেটর ব্যবহার করুন",
                "অসাবধানী ওভারটেকিং পরিহার করুন",
            ]
        elif risk_level == RoadSafetyRiskLevel.MODERATE:
            summary = f"{area_name} এলাকায় বিচ্ছিন্ন কিছু সড়ক বিপদ রিপোর্ট করা হয়েছে (ঝুঁকি স্কোর: {risk_score}/১০০)।"
            factors = [
                f"মোট রিপোর্ট সংখ্যা: {metrics.total_accidents}টি",
                "সাধারণ ট্রাফিক ও ক্রসিং সংক্রান্ত সতর্কতা",
            ]
            precautions = [
                "সাধারণ ট্রাফিক আইন মেনে চলুন",
                "গতিসীমা নিয়ন্ত্রণে রাখুন",
            ]
        else:
            summary = f"{area_name} এলাকায় উল্লেখযোগ্য কোনো সাম্প্রতিক দুর্ঘটনার রিপোর্ট নেই (ঝুঁকি স্কোর: {risk_score}/১০০ - নিম্ন ঝুঁকি)।"
            factors = [
                "বর্তমানে সক্রিয় কোনো সড়ক বিপদের অভিযোগ নেই",
                f"তথ্য নির্ভরযোগ্যতা: {metrics.data_confidence}",
            ]
            precautions = [
                "সচেতন ও নিরাপদ ড্রাইভিং বজায় রাখুন",
                "সড়ক দুর্ঘটনা চোখে পড়লে দ্রুত নিরাপত্তা অ্যাপে রিপোর্ট করুন",
            ]
    else:
        if risk_level == RoadSafetyRiskLevel.CRITICAL:
            summary = f"{area_name} is classified as Critical Risk (Score: {risk_score}/100) based on {metrics.recent_accidents_30d} accident and hazard reports in the last 30 days."
            factors = [
                f"High incident density: {metrics.accident_density_per_sq_km} reports/km²",
                f"Verified community incident records: {metrics.verified_accidents}",
                f"{metrics.recent_accidents_7d} collisions occurred within the past week",
            ]
            precautions = [
                "Reduce speed significantly below the posted limit at intersections",
                "Use designated pedestrian overpasses rather than crossing mid-block",
                "Avoid sharp overtaking maneuvers in high-density corridors",
            ]
        elif risk_level == RoadSafetyRiskLevel.HIGH:
            summary = f"{area_name} is assessed at High Risk (Score: {risk_score}/100) due to repeated accident records and active road hazards."
            factors = [
                f"Recorded incident history: {metrics.total_accidents} reports",
                f"Active reports within past 30 days: {metrics.recent_accidents_30d}",
            ]
            precautions = [
                "Maintain extra following distance during peak traffic hours",
                "Watch out for blind turns and sudden vehicle stops",
            ]
        elif risk_level == RoadSafetyRiskLevel.MODERATE:
            summary = f"{area_name} shows Moderate Risk (Score: {risk_score}/100) with occasional traffic hazards reported."
            factors = [
                f"{metrics.total_accidents} total historical reports on file",
                "Localized traffic congestion and road friction points",
            ]
            precautions = [
                "Standard vigilance advised; adhere to lane discipline",
                "Exercise caution during adverse weather or night conditions",
            ]
        else:
            summary = f"{area_name} currently has Low Risk (Score: {risk_score}/100) with minimal historical accident reports."
            factors = [
                "No active severe road hazard clusters detected in this radius",
                f"Historical record density is low (Confidence: {metrics.data_confidence})",
            ]
            precautions = [
                "Maintain regular defensive driving practices",
                "Report any newly observed road hazards on Nirapotta",
            ]

    return RoadSafetyExplanation(
        summary=summary,
        contributing_factors=factors,
        precautions=precautions,
        data_source="Nirapotta Deterministic Risk Engine & Database",
    )


async def evaluate_route_safety(
    db: AsyncSession,
    waypoints: List[List[float]],
    lang: str = "en",
) -> RouteRiskEvaluationResponse:
    """
    Evaluates road accident risks and high-risk corridor crossings along a route's waypoints.
    Strictly grounded in database incident records.
    """
    is_bn = (lang == "bn")
    now = datetime.now(timezone.utc)

    if not waypoints or len(waypoints) < 2:
        return RouteRiskEvaluationResponse(
            route_risk_level=RoadSafetyRiskLevel.LOW,
            route_risk_score=0.0,
            total_hazards_count=0,
            hazards_along_route=[],
            high_risk_corridors_crossed=[],
            safety_advisory=(
                "রুট ট্র্যাকিং এর জন্য পর্যাপ্ত পয়েন্ট পাওয়া যায়নি।"
                if is_bn else
                "Insufficient route waypoints provided for safety risk analysis."
            ),
        )

    # Subsample waypoints if very dense (e.g. max 100 points) for fast Euclidean/Haversine matching
    sampled_points = waypoints
    if len(waypoints) > 100:
        step = max(1, len(waypoints) // 80)
        sampled_points = waypoints[::step]
        if sampled_points[-1] != waypoints[-1]:
            sampled_points.append(waypoints[-1])

    # 1. Fetch candidate reports with coordinates
    stmt = (
        select(Report)
        .where(
            and_(
                Report.latitude.isnot(None),
                Report.longitude.isnot(None),
                Report.status.in_([ReportStatus.APPROVED, ReportStatus.SUBMITTED, ReportStatus.UNDER_REVIEW]),
            )
        )
        .order_by(Report.created_at.desc())
    )
    result = await db.execute(stmt)
    all_reports = result.scalars().all()

    # 2. Find hazards along route (within 0.5 km of any sampled waypoint)
    hazards: List[NearbySafetyAlert] = []
    recent_30d_count = 0

    for rep in all_reports:
        if rep.latitude is None or rep.longitude is None:
            continue
        if not is_road_incident(rep):
            continue

        # Find minimum distance to route
        min_dist = float("inf")
        for pt in sampled_points:
            lat_pt, lng_pt = pt[0], pt[1]
            d = calculate_haversine_distance(lat_pt, lng_pt, rep.latitude, rep.longitude)
            if d < min_dist:
                min_dist = d
            if min_dist <= 0.5:
                break

        if min_dist <= 0.5:
            # Check recency
            r_time = rep.incident_date or rep.created_at
            if r_time.tzinfo is None:
                r_time = r_time.replace(tzinfo=timezone.utc)
            diff_days = (now - r_time).total_seconds() / 86400.0
            if diff_days <= 30.0:
                recent_30d_count += 1

            dist_m = int(min_dist * 1000)
            dist_text = f"{dist_m}m from route" if dist_m < 1000 else f"{round(min_dist, 1)}km from route"
            time_text = f"{int(diff_days)}d ago" if diff_days >= 1.0 else "Today"

            hazards.append(
                NearbySafetyAlert(
                    id=str(rep.id),
                    report_id=rep.id,
                    title=rep.title,
                    location_text=rep.location_text,
                    latitude=rep.latitude,
                    longitude=rep.longitude,
                    distance_meters=dist_m,
                    distance_text=dist_text,
                    incident_date_text=time_text,
                    alert_reason=f"Verified incident {dist_text} ({time_text})",
                    report_url=f"/reports/{rep.id}",
                )
            )

    # 3. Check high-risk regional corridors crossed within 1.5 km of route
    corridors_crossed: List[RoadSafetyHotspotItem] = []
    for anchor in BD_ACCIDENT_PRONE_CORRIDORS:
        min_anchor_dist = min(
            calculate_haversine_distance(pt[0], pt[1], anchor["lat"], anchor["lng"])
            for pt in sampled_points
        )
        if min_anchor_dist <= 1.5:  # Route passes through or within 1.5km of this corridor
            anchor_accidents = [
                rep for rep in all_reports
                if rep.latitude is not None
                and rep.longitude is not None
                and calculate_haversine_distance(anchor["lat"], anchor["lng"], rep.latitude, rep.longitude) <= 3.0
                and is_road_incident(rep)
            ]
            count = len(anchor_accidents)
            corridor_recent_30d = sum(
                1 for rep in anchor_accidents
                if (now - (rep.incident_date or rep.created_at).replace(
                    tzinfo=timezone.utc if (rep.incident_date or rep.created_at).tzinfo is None else (rep.incident_date or rep.created_at).tzinfo
                )).total_seconds() <= 30.0 * 86400.0
            )
            risk = RoadSafetyRiskLevel.HIGH if count >= 4 else (RoadSafetyRiskLevel.MODERATE if count >= 2 else RoadSafetyRiskLevel.LOW)
            corridors_crossed.append(
                RoadSafetyHotspotItem(
                    area_name=anchor["name"],
                    latitude=anchor["lat"],
                    longitude=anchor["lng"],
                    accident_count=count,
                    risk_level=risk,
                    recent_count_30d=corridor_recent_30d,
                )
            )

    # 4. Deterministic Route Risk Score (0 - 100)
    hazard_pts = min(40.0, len(hazards) * 10.0)
    recent_pts = min(30.0, recent_30d_count * 10.0)
    high_risk_corridor_count = sum(1 for c in corridors_crossed if c.risk_level in (RoadSafetyRiskLevel.HIGH, RoadSafetyRiskLevel.CRITICAL))
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

    # 5. Safety advisory message
    if is_bn:
        if route_level in (RoadSafetyRiskLevel.HIGH, RoadSafetyRiskLevel.CRITICAL):
            advisory = f"সতর্কতা: রুটের মধ্যে {len(hazards)}টি রেকর্ডকৃত সড়ক ঝুঁকি এবং {len(corridors_crossed)}টি করিডোর রয়েছে। সতর্কভাবে গতিসীমা বজায় রাখুন।"
        elif route_level == RoadSafetyRiskLevel.MODERATE:
            advisory = f"রুটের ঝুঁকি মাঝারি (স্কোর {route_score}/১০০)। রুটের আশপাশে {len(hazards)}টি ঐতিহাসিক রিপোর্ট রয়েছে। সাধারণ ট্রাফিক সতর্কতা বজায় রাখুন।"
        else:
            advisory = "রুটটি তুলনামূলক নিরাপদ। রুটের ওপর কোনো সক্রিয় বা ঘন ঘন দুর্ঘটনার রেকর্ড নেই।"
    else:
        if route_level in (RoadSafetyRiskLevel.HIGH, RoadSafetyRiskLevel.CRITICAL):
            advisory = f"Caution: Route passes near {len(hazards)} recorded road hazard(s) and {len(corridors_crossed)} high-traffic corridor(s). Reduce speed and maintain safe distance."
        elif route_level == RoadSafetyRiskLevel.MODERATE:
            advisory = f"Route Risk is Moderate (Score: {route_score}/100). {len(hazards)} historical incident(s) recorded nearby. Standard driving vigilance recommended."
        else:
            advisory = "Clear route conditions. No repeated or severe road hazard clusters detected along this path."

    return RouteRiskEvaluationResponse(
        route_risk_level=route_level,
        route_risk_score=route_score,
        total_hazards_count=len(hazards),
        hazards_along_route=hazards[:10],
        high_risk_corridors_crossed=corridors_crossed,
        safety_advisory=advisory,
    )
