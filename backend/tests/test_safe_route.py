import uuid
from datetime import datetime, timezone, timedelta
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, UserRole
from app.models.category import Category
from app.models.report import Report, ReportStatus
from app.models.emergency_service import EmergencyService, ServiceType, VerificationStatus
from app.core.security import get_password_hash


@pytest.fixture
async def sample_categories(db_session: AsyncSession):
    cats = [
        Category(id=uuid.uuid4(), name="Public Safety", slug="public-safety", description="Safety hazards"),
        Category(id=uuid.uuid4(), name="Crime", slug="crime", description="General crime"),
        Category(id=uuid.uuid4(), name="Violence", slug="violence", description="Violence & clashes"),
    ]
    for c in cats:
        db_session.add(c)
    await db_session.commit()
    return cats


@pytest.fixture
async def sample_user(db_session: AsyncSession):
    user = User(
        id=uuid.uuid4(),
        email="safe_route_tester@example.com",
        username="saferoutetester",
        hashed_password=get_password_hash("SecretRoute123!"),
        role=UserRole.USER,
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    return user


# ---------------------------------------------------------------------------
# Phase F: Safe Route & Interactive Safety Map Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_safe_route_validates_coordinates(
    async_client: AsyncClient,
    db_session: AsyncSession,
):
    """Rejects out-of-range GPS coordinates with HTTP 422 or 400."""
    res = await async_client.post(
        "/api/v1/safety/safe-route/analyze",
        json={
            "origin_latitude": 150.0,  # Invalid (>90)
            "origin_longitude": 90.3742,
            "destination_latitude": 23.7806,
            "destination_longitude": 90.3522,
        },
    )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_safe_route_with_approved_reports_only(
    async_client: AsyncClient,
    db_session: AsyncSession,
    sample_categories,
    sample_user: User,
):
    """
    Verifies that only APPROVED reports appear along the route corridor.
    SUBMITTED and REJECTED reports must be strictly excluded.
    """
    pub_cat = next(c for c in sample_categories if c.slug == "public-safety")
    now = datetime.now(timezone.utc)

    # 1. Approved report at Dhanmondi 27 (lat: 23.7465, lng: 90.3745)
    approved_rep = Report(
        id=uuid.uuid4(),
        user_id=sample_user.id,
        category_id=pub_cat.id,
        title="Severe Bus and CNG Collision",
        description="Collision near Dhanmondi 27 Junction creating glass hazard on road.",
        location_text="Dhanmondi 27, Dhaka",
        latitude=23.7465,
        longitude=90.3745,
        status=ReportStatus.APPROVED,
        incident_date=now - timedelta(days=3),
    )
    # 2. Submitted (unapproved) report near route
    submitted_rep = Report(
        id=uuid.uuid4(),
        user_id=sample_user.id,
        category_id=pub_cat.id,
        title="Unverified Pothole Report",
        description="Pending review report that should not be visible to public safe route.",
        location_text="Dhanmondi 27, Dhaka",
        latitude=23.7466,
        longitude=90.3746,
        status=ReportStatus.SUBMITTED,
        incident_date=now,
    )
    # 3. Rejected report near route
    rejected_rep = Report(
        id=uuid.uuid4(),
        user_id=sample_user.id,
        category_id=pub_cat.id,
        title="False Alarm Report",
        description="Rejected spam report.",
        location_text="Dhanmondi 27, Dhaka",
        latitude=23.7467,
        longitude=90.3747,
        status=ReportStatus.REJECTED,
        incident_date=now,
    )
    db_session.add_all([approved_rep, submitted_rep, rejected_rep])
    await db_session.commit()

    # Route passing directly past Dhanmondi 27 to Farmgate
    res = await async_client.post(
        "/api/v1/safety/safe-route/analyze",
        json={
            "origin_latitude": 23.7461,
            "origin_longitude": 90.3742,
            "destination_latitude": 23.7561,
            "destination_longitude": 90.3872,
            "origin_name": "Dhanmondi 27",
            "destination_name": "Farmgate Crossing",
            "waypoints": [
                [23.7461, 90.3742],
                [23.7465, 90.3745],
                [23.7500, 90.3800],
                [23.7561, 90.3872],
            ],
            "route_distance_km": 2.4,
            "route_duration_minutes": 8.0,
            "lang": "en",
        },
    )
    assert res.status_code == 200, res.text
    data = res.json()

    assert data["origin_name"] == "Dhanmondi 27"
    assert data["destination_name"] == "Farmgate Crossing"
    assert data["route_distance_km"] == 2.4
    assert data["total_hazards_count"] == 1
    assert data["hazards_by_category"]["Public Safety"] == 1

    hazard_ids = [h["id"] for h in data["hazards_along_route"]]
    assert str(approved_rep.id) in hazard_ids
    assert str(submitted_rep.id) not in hazard_ids
    assert str(rejected_rep.id) not in hazard_ids


@pytest.mark.asyncio
async def test_safe_route_excludes_private_reporter_data(
    async_client: AsyncClient,
    db_session: AsyncSession,
    sample_categories,
    sample_user: User,
):
    """Ensures reporter identity, email, username, and internal notes are not leaked in the route response."""
    pub_cat = next(c for c in sample_categories if c.slug == "public-safety")
    rep = Report(
        id=uuid.uuid4(),
        user_id=sample_user.id,
        category_id=pub_cat.id,
        title="Oil Spill on Mirpur Road",
        description="Slippery surface near road junction.",
        location_text="Mirpur Road, Dhaka",
        latitude=23.7800,
        longitude=90.3520,
        status=ReportStatus.APPROVED,
    )
    db_session.add(rep)
    await db_session.commit()

    res = await async_client.post(
        "/api/v1/safety/safe-route/analyze",
        json={
            "origin_latitude": 23.7780,
            "origin_longitude": 90.3510,
            "destination_latitude": 23.7820,
            "destination_longitude": 90.3530,
            "waypoints": [[23.7780, 90.3510], [23.7800, 90.3520], [23.7820, 90.3530]],
        },
    )
    assert res.status_code == 200
    res_text = res.text

    # Verify no private reporter info leaked
    assert sample_user.email not in res_text
    assert sample_user.username not in res_text
    assert "SecretRoute123" not in res_text


@pytest.mark.asyncio
async def test_safe_route_detects_emergency_services_along_path(
    async_client: AsyncClient,
    db_session: AsyncSession,
    sample_categories,
):
    """Verified police and hospital facilities within the route corridor are surfaced."""
    # 1. Verified police station near Farmgate
    ps = EmergencyService(
        id=uuid.uuid4(),
        name="Tejgaon Police Station",
        name_bn="তেজগাঁও থানা",
        service_type=ServiceType.POLICE_STATION,
        phone="01713373155",
        address="Farmgate, Tejgaon, Dhaka",
        district="Dhaka",
        area="Tejgaon",
        latitude=23.7580,
        longitude=90.3890,
        is_active=True,
        verification_status=VerificationStatus.VERIFIED,
    )
    # 2. Unverified service (should be excluded)
    unverified_ps = EmergencyService(
        id=uuid.uuid4(),
        name="Unverified Security Post",
        service_type=ServiceType.POLICE_BOX,
        phone="01700000000",
        address="Farmgate, Tejgaon, Dhaka",
        district="Dhaka",
        area="Tejgaon",
        latitude=23.7585,
        longitude=90.3895,
        is_active=True,
        verification_status=VerificationStatus.UNVERIFIED,
    )
    db_session.add_all([ps, unverified_ps])
    await db_session.commit()

    res = await async_client.post(
        "/api/v1/safety/safe-route/analyze",
        json={
            "origin_latitude": 23.7500,
            "origin_longitude": 90.3850,
            "destination_latitude": 23.7600,
            "destination_longitude": 90.3920,
            "waypoints": [[23.7500, 90.3850], [23.7580, 90.3890], [23.7600, 90.3920]],
        },
    )
    assert res.status_code == 200
    data = res.json()

    svc_ids = [s["id"] for s in data["emergency_services_along_route"]]
    assert str(ps.id) in svc_ids
    assert str(unverified_ps.id) not in svc_ids

    nearest_svc = next(s for s in data["emergency_services_along_route"] if s["id"] == str(ps.id))
    assert nearest_svc["phone_number"] == "01713373155"
    assert nearest_svc["distance_meters"] <= 1500


@pytest.mark.asyncio
async def test_safe_route_linear_interpolation_when_no_waypoints(
    async_client: AsyncClient,
    db_session: AsyncSession,
    sample_categories,
):
    """When waypoints are omitted, linear interpolation allows safe evaluation without failure."""
    res = await async_client.post(
        "/api/v1/safety/safe-route/analyze",
        json={
            "origin_latitude": 23.7461,
            "origin_longitude": 90.3742,
            "destination_latitude": 23.8341,
            "destination_longitude": 90.4196,
            "origin_name": "Dhanmondi",
            "destination_name": "Uttara",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["route_risk_level"] in ("Low", "Moderate", "High", "Critical")
    assert "data_limitations" in data
    assert "999" in data["emergency_notice"]


@pytest.mark.asyncio
async def test_safe_route_multi_lingual_advisory(
    async_client: AsyncClient,
    db_session: AsyncSession,
    sample_categories,
):
    """Advisory and limitations are provided in Bengali or English based on lang query."""
    # Bengali
    res_bn = await async_client.post(
        "/api/v1/safety/safe-route/analyze",
        json={
            "origin_latitude": 23.7461,
            "origin_longitude": 90.3742,
            "destination_latitude": 23.7561,
            "destination_longitude": 90.3872,
            "lang": "bn",
        },
    )
    assert res_bn.status_code == 200
    assert "সীমাবদ্ধতা" in res_bn.json()["data_limitations"]

    # English
    res_en = await async_client.post(
        "/api/v1/safety/safe-route/analyze",
        json={
            "origin_latitude": 23.7461,
            "origin_longitude": 90.3742,
            "destination_latitude": 23.7561,
            "destination_longitude": 90.3872,
            "lang": "en",
        },
    )
    assert res_en.status_code == 200
    assert "Limitations" in res_en.json()["data_limitations"]


@pytest.mark.asyncio
async def test_safe_route_no_reports_does_not_claim_guaranteed_safe(
    async_client: AsyncClient,
    db_session: AsyncSession,
    sample_categories,
):
    """When zero reports exist along a path, disclaimer clarifies that absence of reports != guaranteed safe."""
    res = await async_client.post(
        "/api/v1/safety/safe-route/analyze",
        json={
            "origin_latitude": 24.0000,
            "origin_longitude": 90.0000,
            "destination_latitude": 24.0100,
            "destination_longitude": 90.0100,
            "lang": "en",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["total_hazards_count"] == 0
    assert data["route_risk_level"] == "Low"
    assert "cannot be guaranteed 100% safe" in data["disclaimer"]
    assert "absence of reported incidents does not prove" in data["data_limitations"]


@pytest.mark.asyncio
async def test_safe_route_detects_high_risk_corridor(
    async_client: AsyncClient,
    db_session: AsyncSession,
    sample_categories,
    sample_user: User,
):
    """Route passing near known high-risk highway corridor flags corridor crossing."""
    # Route through Gabtoli (Mirpur Road anchor: lat 23.7806, lng 90.3522)
    res = await async_client.post(
        "/api/v1/safety/safe-route/analyze",
        json={
            "origin_latitude": 23.7750,
            "origin_longitude": 90.3500,
            "destination_latitude": 23.7850,
            "destination_longitude": 90.3550,
            "waypoints": [[23.7750, 90.3500], [23.7806, 90.3522], [23.7850, 90.3550]],
            "lang": "en",
        },
    )
    assert res.status_code == 200
    data = res.json()
    corridor_names = [c["area_name"] for c in data["high_risk_corridors_crossed"]]
    assert any("Mirpur Road" in name for name in corridor_names)


@pytest.mark.asyncio
async def test_safe_route_explicit_fallback_distinction(
    async_client: AsyncClient,
    db_session: AsyncSession,
):
    """Verifies that missing road waypoints trigger explicit fallback labels without fabricating driving duration."""
    # 1. Fallback mode: no waypoints provided
    res_fallback = await async_client.post(
        "/api/v1/safety/safe-route/analyze",
        json={
            "origin_latitude": 23.7461,
            "origin_longitude": 90.3742,
            "destination_latitude": 23.7561,
            "destination_longitude": 90.3872,
            "route_duration_minutes": 15.0,  # Should not be treated as road duration under fallback
            "lang": "en",
        },
    )
    assert res_fallback.status_code == 200
    data_fb = res_fallback.json()
    assert data_fb["is_fallback"] is True
    assert data_fb["routing_mode"] == "DIRECT_CORRIDOR_FALLBACK"
    assert data_fb["fallback_notice"] is not None
    assert "Direct corridor estimation" in data_fb["fallback_notice"]
    assert data_fb["route_duration_minutes"] is None  # Cannot claim verified road driving duration

    # 2. Road network mode: actual waypoints provided
    res_road = await async_client.post(
        "/api/v1/safety/safe-route/analyze",
        json={
            "origin_latitude": 23.7461,
            "origin_longitude": 90.3742,
            "destination_latitude": 23.7561,
            "destination_longitude": 90.3872,
            "waypoints": [
                [23.7461, 90.3742],
                [23.7500, 90.3800],
                [23.7561, 90.3872],
            ],
            "route_duration_minutes": 12.0,
            "route_distance_km": 2.1,
            "lang": "en",
        },
    )
    assert res_road.status_code == 200
    data_road = res_road.json()
    assert data_road["is_fallback"] is False
    assert data_road["routing_mode"] == "ROAD_NETWORK"
    assert data_road["fallback_notice"] is None
    assert data_road["route_duration_minutes"] == 12.0


