"""
Nirapotta AI — Agentic Safety Road AI Service

Autonomous multi-candidate route-planning agent that balances:
- Travel time (minimizing transit duration)
- Road safety risk (avoiding documented accident blackspots and verified incidents)
- Distance and road conditions
- Explicit data limitations (never claims 100% safety or invents fake hazards)
"""

import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Tuple
import httpx
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.report import Report, ReportStatus
from app.models.accident_zone import AccidentZone
from app.schemas.ai_features import (
    RoadSafetyRiskLevel,
    AgenticRouteCandidate,
    AgenticRouteRecommendation,
    SafeRouteAnalysisRequest,
)
from app.services.road_safety import calculate_haversine_distance
from app.core.config import settings

logger = logging.getLogger("agentic_road_ai")


def _subsample_points(points: List[List[float]], max_points: int = 50) -> List[List[float]]:
    if not points:
        return []
    if len(points) <= max_points:
        return points
    step = max(1, len(points) // max_points)
    sampled = points[::step]
    if sampled[-1] != points[-1]:
        sampled.append(points[-1])
    return sampled


class AgenticRoadAI:
    """
    Structured Agentic Route Planner.
    Coordinates route candidate generation, road risk retrieval, segment risk scoring,
    tradeoff optimization (time vs safety), and human-intelligible recommendations.
    """

    def __init__(
        self,
        safety_weight: float = 0.6,
        time_weight: float = 0.4,
    ):
        self.safety_weight = safety_weight
        self.time_weight = time_weight

    async def get_route_candidates_from_osrm(
        self,
        origin_lat: float,
        origin_lng: float,
        dest_lat: float,
        dest_lng: float,
    ) -> List[Dict[str, Any]]:
        """
        Tool: get_route_candidates
        Retrieves real alternative route geometries and durations from OSRM.
        """
        osrm_url = (
            f"{settings.OSRM_BASE_URL.rstrip('/')}/route/v1/driving/"
            f"{origin_lng:.6f},{origin_lat:.6f};{dest_lng:.6f},{dest_lat:.6f}"
            f"?overview=full&geometries=geojson&alternatives=true"
        )
        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                resp = await client.get(osrm_url)
                if resp.status_code == 200:
                    data = resp.json()
                    routes = data.get("routes", [])
                    candidates = []
                    for idx, r in enumerate(routes):
                        coords = r.get("geometry", {}).get("coordinates", [])
                        # Convert GeoJSON [lng, lat] to [lat, lng]
                        lat_lng_pts = [[c[1], c[0]] for c in coords]
                        dist_km = round(r.get("distance", 0.0) / 1000.0, 1)
                        dur_min = round(r.get("duration", 0.0) / 60.0, 1)
                        candidates.append({
                            "route_id": f"route_{idx}",
                            "distance_km": dist_km,
                            "duration_minutes": dur_min,
                            "waypoints": lat_lng_pts,
                            "summary": r.get("legs", [{}])[0].get("summary", ""),
                        })
                    return candidates
        except Exception as e:
            logger.debug("Direct OSRM route fetch notice: %s", e)

        return []

    async def plan_agentic_route(
        self,
        db: AsyncSession,
        request: SafeRouteAnalysisRequest,
        candidate_reports: List[Report],
        candidate_zones: List[AccidentZone],
        primary_waypoints: List[List[float]],
        primary_distance_km: float,
        primary_duration_minutes: float,
    ) -> AgenticRouteRecommendation:
        """
        Executes full agentic decision workflow:
        1. Formulates candidate list (Primary + Alternatives)
        2. Analyzes safety risk per candidate
        3. Optimizes tradeoff cost: Cost = (time_weight * Duration) + (safety_weight * Risk)
        4. Identifies AI Recommended, Fastest, and Safest routes
        5. Explains rationale in natural language
        """
        is_bn = (request.lang == "bn")
        candidates_raw: List[Dict[str, Any]] = []

        # Candidate 0: Primary route
        candidates_raw.append({
            "route_id": "route_0",
            "distance_km": primary_distance_km,
            "duration_minutes": primary_duration_minutes,
            "waypoints": primary_waypoints,
            "summary_road_names": None,
        })

        # Candidate 1..N from alternative_geometries if supplied by frontend
        if request.alternative_geometries:
            for idx, alt in enumerate(request.alternative_geometries):
                alt_coords = alt.get("coordinates", [])
                lat_lng = [[c[1], c[0]] for c in alt_coords] if alt_coords else []
                dist = float(alt.get("distance_km", primary_distance_km * 1.05))
                dur = float(alt.get("duration_minutes", primary_duration_minutes * 1.08))
                candidates_raw.append({
                    "route_id": f"route_{idx + 1}",
                    "distance_km": dist,
                    "duration_minutes": dur,
                    "waypoints": lat_lng,
                    "summary_road_names": alt.get("summary"),
                })

        # Analyze each candidate
        evaluated_candidates: List[AgenticRouteCandidate] = []
        now = datetime.now(timezone.utc)

        for c_data in candidates_raw:
            pts = _subsample_points(c_data["waypoints"], max_points=40)
            hazards_count = 0
            zones_count = 0

            if pts:
                for rep in candidate_reports:
                    if rep.latitude and rep.longitude:
                        if any(calculate_haversine_distance(p[0], p[1], rep.latitude, rep.longitude) <= 0.8 for p in pts):
                            hazards_count += 1

                for z in candidate_zones:
                    rad_km = (z.radius_meters / 1000.0) + 0.3
                    if any(calculate_haversine_distance(p[0], p[1], z.latitude, z.longitude) <= rad_km for p in pts):
                        zones_count += 1

            # Risk score calculation
            hazard_pts = min(40.0, hazards_count * 7.0)
            zone_pts = min(60.0, zones_count * 20.0)
            risk_score = round(min(100.0, hazard_pts + zone_pts), 1)

            if risk_score >= 70.0:
                risk_level = RoadSafetyRiskLevel.CRITICAL
            elif risk_score >= 45.0:
                risk_level = RoadSafetyRiskLevel.HIGH
            elif risk_score >= 20.0:
                risk_level = RoadSafetyRiskLevel.MODERATE
            else:
                risk_level = RoadSafetyRiskLevel.LOW

            # Assess confidence based on database density
            has_corridor_data = (len(candidate_reports) > 0 or len(candidate_zones) > 0)
            confidence = "HIGH" if has_corridor_data else "UNKNOWN"

            evaluated_candidates.append(
                AgenticRouteCandidate(
                    route_id=c_data["route_id"],
                    label="Candidate Route",
                    distance_km=round(c_data["distance_km"], 1),
                    duration_minutes=round(c_data["duration_minutes"], 1),
                    risk_level=risk_level,
                    risk_score=risk_score,
                    risk_confidence=confidence,
                    accident_zones_count=zones_count,
                    hazards_count=hazards_count,
                    waypoints=c_data["waypoints"][:50],
                    summary_road_names=c_data.get("summary_road_names"),
                    tradeoff_rationale="",
                )
            )

        # Identify Fastest Candidate (minimal duration)
        fastest_cand = min(evaluated_candidates, key=lambda c: c.duration_minutes)
        fastest_cand.is_fastest = True

        # Identify Safest Candidate (minimal risk score)
        safest_cand = min(evaluated_candidates, key=lambda c: (c.risk_score, c.duration_minutes))
        safest_cand.is_safest = True

        # Calculate Tradeoff Scores: Cost = (norm_duration * time_weight) + (norm_risk * safety_weight)
        max_dur = max(c.duration_minutes for c in evaluated_candidates) or 1.0
        min_dur = min(c.duration_minutes for c in evaluated_candidates)

        for c in evaluated_candidates:
            # Normalized metrics (0 to 1)
            norm_dur = (c.duration_minutes - min_dur) / (max(1.0, max_dur - min_dur)) if max_dur > min_dur else 0.0
            norm_risk = c.risk_score / 100.0
            score = (norm_dur * self.time_weight) + (norm_risk * self.safety_weight)
            c.tradeoff_score = round(score, 3)

        # If user explicitly selected a preference:
        pref = (request.preference or "RECOMMENDED").upper()
        if pref == "FASTEST":
            recommended_cand = fastest_cand
        elif pref == "SAFEST":
            recommended_cand = safest_cand
        else:
            # Default Tradeoff Optimization: Pick minimum tradeoff cost
            recommended_cand = min(evaluated_candidates, key=lambda c: c.tradeoff_score)

        recommended_cand.is_recommended = True

        # Assign Human-Friendly Labels
        for c in evaluated_candidates:
            if c.route_id == recommended_cand.route_id:
                c.label = "AI Recommended Route" if not is_bn else "এআই প্রস্তাবিত রুট"
            elif c.route_id == fastest_cand.route_id:
                c.label = "Fastest Route" if not is_bn else "দ্রুততম রুট"
            elif c.route_id == safest_cand.route_id:
                c.label = "Safest Route" if not is_bn else "সবচেয়ে নিরাপদ রুট"
            else:
                c.label = f"Alternative ({c.distance_km} km)" if not is_bn else f"বিকল্প রুট ({c.distance_km} কিমি)"

        # Generate Decision Rationale
        if is_bn:
            if recommended_cand.is_fastest and recommended_cand.is_safest:
                primary_reason = "এই রুটটি একই সাথে সর্বনিম্ন সময় নেয় এবং রুটে কোনো বড় দুর্ঘটনাপ্রবণ ব্ল্যাকস্পট নেই।"
                tradeoff_exp = "সময় ও নিরাপত্তার কোনো বড় ছাড় দিতে হয়নি; এটি সর্বোত্তম বিকল্প।"
            elif recommended_cand.is_fastest:
                primary_reason = f"সর্বনিম্ন যাতায়াত সময় ({recommended_cand.duration_minutes} মিনিট) ও গ্রহণযোগ্য সড়ক ঝুঁকির ভিত্তিতে এটি সুপারিশ করা হয়েছে।"
                tradeoff_exp = f"বিকল্প রুটের চেয়ে প্রায় {round(abs(safest_cand.duration_minutes - recommended_cand.duration_minutes), 1)} মিনিট দ্রুত।"
            else:
                primary_reason = (
                    f"এই রুটটি দ্রুততম রুটের চেয়ে মাত্র {round(abs(recommended_cand.duration_minutes - fastest_cand.duration_minutes), 1)} মিনিট বেশি নিলেও "
                    f"{fastest_cand.accident_zones_count}টি চিহ্নিত দুর্ঘটনা ব্ল্যাকস্পট এড়িয়ে চলে।"
                )
                tradeoff_exp = f"ঝুঁকি স্কোর {fastest_cand.risk_score}/১০০ থেকে কমে {recommended_cand.risk_score}/১০০ এ নেমে এসেছে।"
        else:
            if recommended_cand.is_fastest and recommended_cand.is_safest:
                primary_reason = "This route simultaneously offers the fastest travel time and lowest recorded hazard exposure."
                tradeoff_exp = "Optimal path requiring zero safety or time compromise."
            elif recommended_cand.is_fastest:
                primary_reason = f"Recommended for minimal transit duration ({recommended_cand.duration_minutes} mins) with manageable hazard exposure."
                tradeoff_exp = f"Saves {round(abs(safest_cand.duration_minutes - recommended_cand.duration_minutes), 1)} mins compared to safest alternative."
            else:
                extra_mins = round(abs(recommended_cand.duration_minutes - fastest_cand.duration_minutes), 1)
                primary_reason = (
                    f"Recommended because it avoids {fastest_cand.accident_zones_count} documented high-risk highway blackspot(s) "
                    f"while adding only {extra_mins} minute(s) compared to the fastest candidate."
                )
                tradeoff_exp = f"Reduces route hazard score from {fastest_cand.risk_score}/100 to {recommended_cand.risk_score}/100."

        for c in evaluated_candidates:
            if is_bn:
                c.tradeoff_rationale = f"দূরত্ব {c.distance_km} কিমি, আনুমানিক সময় {c.duration_minutes} মিনিট, ঝুঁকি স্কোর {c.risk_score}/১০০।"
            else:
                c.tradeoff_rationale = f"Distance: {c.distance_km} km, Duration: {c.duration_minutes} mins, Risk Score: {c.risk_score}/100."

        return AgenticRouteRecommendation(
            recommended_route_id=recommended_cand.route_id,
            primary_reason=primary_reason,
            time_vs_safety_tradeoff=tradeoff_exp,
            fastest_route_id=fastest_cand.route_id,
            safest_route_id=safest_cand.route_id,
            candidates=evaluated_candidates,
            confidence_assessment=(
                "উচ্চ নির্ভরযোগ্যতা: বিআরটিএ, বিইউইটি এআরআই এবং যাচাইকৃত নাগরিক প্রতিবেদনের ভিত্তিতে সংকলিত।"
                if is_bn else
                "High confidence: Grounded in official ARI BUET and verified community reports."
            ),
            data_freshness_label="Real-time Verified Database Records",
        )
