import uuid
import pytest
from datetime import datetime, timezone, timedelta
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.hospital import Hospital, BloodInventory, BloodInventoryStatus
from app.models.accident_zone import AccidentZone
from app.models.report import Report, ReportStatus
from app.models.category import Category
from app.models.emergency_service import VerificationStatus
from app.models.blood import BloodGroup
from app.schemas.ai_features import SafeRouteAnalysisRequest, RoadSafetyRiskLevel
from app.services.hospital_service import get_nearby_hospitals, get_hospital_details
from app.services.google_places import search_google_places_hospitals
from app.services.agentic_road_ai import AgenticRoadAI
from app.db.seed_hospitals import seed_hospitals_and_inventory


@pytest.fixture
async def seeded_hospitals(db_session: AsyncSession):
    return await seed_hospitals_and_inventory(db_session)


@pytest.mark.asyncio
async def test_hospital_summary_all_8_blood_groups_present(
    db_session: AsyncSession,
    seeded_hospitals,
):
    """
    Verifies that every hospital summary returns all 8 blood groups in all_inventories,
    even if the hospital originally had sparse or unverified inventory records.
    """
    hospitals = await get_nearby_hospitals(db=db_session, limit=5)
    assert len(hospitals) > 0

    expected_groups = {"A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"}
    for h in hospitals:
        group_names = {item.blood_group for item in h.all_inventories}
        assert group_names == expected_groups, f"Hospital {h.name} missing blood groups: {expected_groups - group_names}"
        for item in h.all_inventories:
            assert item.available_units >= 0
            assert item.availability_status in ("AVAILABLE", "LOW_STOCK", "OUT_OF_STOCK", "UNKNOWN")


@pytest.mark.asyncio
async def test_hospital_unverified_inventory_shows_clear_unavailable_label(
    db_session: AsyncSession,
):
    """
    Verifies data integrity: if a hospital has no inventory in DB,
    stock is labeled 'Blood stock information unavailable', NOT fabricated.
    """
    # Create test hospital without any blood inventories
    h = Hospital(
        name="Rural Health Center Without Blood Bank",
        district="Bogura",
        area="Sherpur",
        address="Sherpur Bus Stand",
        latitude=24.6713,
        longitude=89.4182,
        emergency_phone="+8801700000000",
        verification_status=VerificationStatus.VERIFIED,
        has_blood_bank=False,
        is_active=True,
    )
    db_session.add(h)
    await db_session.commit()
    await db_session.refresh(h)

    details = await get_hospital_details(db=db_session, hospital_id=h.id)
    assert details is not None
    assert len(details.inventories) == 8
    for inv in details.inventories:
        assert inv.is_verified is False
        assert inv.stock_source_label == "Blood stock information unavailable"
        assert inv.availability_status == "UNKNOWN"


@pytest.mark.asyncio
async def test_hospital_distance_and_navigation_links(
    db_session: AsyncSession,
    seeded_hospitals,
):
    """
    Verifies straight-line distance and Google Maps navigation links are accurately built.
    """
    # DMCH coordinates: 23.7260, 90.3976. User at Shahbagh: 23.7388, 90.3956 (~1.4 km away)
    hospitals = await get_nearby_hospitals(
        db=db_session,
        latitude=23.7388,
        longitude=90.3956,
        radius_km=10.0,
        limit=10,
    )
    assert len(hospitals) > 0

    dmch = next((h for h in hospitals if "Dhaka Medical" in h.name), None)
    assert dmch is not None
    assert dmch.distance_km is not None
    assert 0.5 <= dmch.distance_km <= 3.0  # Shahbagh to DMCH is ~1.4 km
    assert dmch.google_maps_url is not None
    assert "maps/dir" in dmch.google_maps_url or "maps/search" in dmch.google_maps_url


@pytest.mark.asyncio
async def test_hospital_sort_by_options(
    db_session: AsyncSession,
    seeded_hospitals,
):
    """
    Tests sorting by distance, travel time, and blood stock.
    """
    by_dist = await get_nearby_hospitals(
        db=db_session,
        latitude=23.7388,
        longitude=90.3956,
        sort_by="distance",
        limit=5,
    )
    for i in range(len(by_dist) - 1):
        d1 = by_dist[i].distance_km if by_dist[i].distance_km is not None else 9999.0
        d2 = by_dist[i + 1].distance_km if by_dist[i + 1].distance_km is not None else 9999.0
        assert d1 <= d2

    by_stock = await get_nearby_hospitals(
        db=db_session,
        latitude=23.7388,
        longitude=90.3956,
        blood_group="O+",
        sort_by="stock",
        limit=5,
    )
    assert len(by_stock) > 0
    # Top hospital should have matching inventory with available stock
    assert by_stock[0].matching_inventory is not None


@pytest.mark.asyncio
async def test_google_places_service_graceful_missing_credentials():
    """
    Verifies that Google Places service safely handles missing API keys without crashing.
    """
    results = await search_google_places_hospitals(latitude=23.75, longitude=90.38)
    assert isinstance(results, list)


@pytest.mark.asyncio
async def test_agentic_road_ai_multi_candidate_tradeoff(
    db_session: AsyncSession,
):
    """
    Tests that AgenticRoadAI compares candidate routes and balances travel time vs road safety risk.
    """

    # Add an accident zone along highway
    blackspot = AccidentZone(
        id=uuid.uuid4(),
        zone_name="Gabtoli Severe Highway Curve",
        road_name="N5 Highway",
        district="Dhaka",
        division="Dhaka",
        latitude=23.7845,
        longitude=90.3538,
        radius_meters=800,
        accident_count=35,
        observation_period="2021-2024",
        data_source="ARI BUET",
        source_url="https://ari.buet.ac.bd",
        verification_status=VerificationStatus.VERIFIED,
        risk_level="CRITICAL",
        description="Dangerous highway junction.",
    )
    db_session.add(blackspot)
    await db_session.commit()

    agent = AgenticRoadAI(safety_weight=0.6, time_weight=0.4)

    # Primary route passes through blackspot (23.7845, 90.3538), duration 18 mins
    primary_pts = [
        [23.7461, 90.3742],
        [23.7845, 90.3538],
        [23.8071, 90.3686],
    ]
    # Alternative bypass route avoids blackspot, duration 21 mins (+3 mins, but avoids critical zone)
    alt_pts = [
        [23.7461, 90.3742],
        [23.7650, 90.3800],
        [23.8071, 90.3686],
    ]

    req = SafeRouteAnalysisRequest(
        origin_latitude=23.7461,
        origin_longitude=90.3742,
        destination_latitude=23.8071,
        destination_longitude=90.3686,
        origin_name="Dhanmondi",
        destination_name="Mirpur",
        waypoints=primary_pts,
        route_distance_km=8.2,
        route_duration_minutes=18.0,
        preference="RECOMMENDED",
        alternative_geometries=[
            {
                "distance_km": 9.0,
                "duration_minutes": 21.0,
                "coordinates": [[p[1], p[0]] for p in alt_pts],  # GeoJSON [lng, lat]
                "summary": "Via Ring Road Bypass",
            }
        ],
    )

    rec = await agent.plan_agentic_route(
        db=db_session,
        request=req,
        candidate_reports=[],
        candidate_zones=[blackspot],
        primary_waypoints=primary_pts,
        primary_distance_km=8.2,
        primary_duration_minutes=18.0,
    )

    assert rec is not None
    assert len(rec.candidates) == 2
    assert rec.fastest_route_id == "route_0"  # 18 mins
    assert rec.safest_route_id == "route_1"   # avoids blackspot (risk score 0)
    # The recommended route should have an explanation
    assert rec.primary_reason is not None and len(rec.primary_reason) > 10
    assert rec.time_vs_safety_tradeoff is not None


@pytest.mark.asyncio
async def test_agentic_road_ai_user_preference_override(
    db_session: AsyncSession,
):
    """
    Verifies that when user explicitly selects preference='FASTEST',
    the agent respects user autonomy and selects the fastest candidate.
    """
    agent = AgenticRoadAI()
    req = SafeRouteAnalysisRequest(
        origin_latitude=23.7461,
        origin_longitude=90.3742,
        destination_latitude=23.8071,
        destination_longitude=90.3686,
        preference="FASTEST",
        route_distance_km=8.0,
        route_duration_minutes=16.0,
        alternative_geometries=[
            {
                "distance_km": 10.0,
                "duration_minutes": 24.0,
                "coordinates": [[90.38, 23.76], [90.36, 23.80]],
            }
        ],
    )
    rec = await agent.plan_agentic_route(
        db=db_session,
        request=req,
        candidate_reports=[],
        candidate_zones=[],
        primary_waypoints=[[23.7461, 90.3742], [23.8071, 90.3686]],
        primary_distance_km=8.0,
        primary_duration_minutes=16.0,
    )
    assert rec.recommended_route_id == rec.fastest_route_id == "route_0"
