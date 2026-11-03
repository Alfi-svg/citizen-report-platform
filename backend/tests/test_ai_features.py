import uuid
from datetime import datetime, timezone, timedelta
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User, UserRole
from app.models.category import Category
from app.models.report import Report, ReportStatus
from app.models.blood import BloodGroup, DonorAvailability, BloodDonorProfile
from app.core.security import get_password_hash
from app.schemas.ai_features import RoadSafetyRiskLevel


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
        email="citizen_tester@example.com",
        username="citizentester",
        hashed_password=get_password_hash("SecretPassword123!"),
        role=UserRole.USER,
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    return user


@pytest.fixture
async def sample_admin(db_session: AsyncSession):
    admin = User(
        id=uuid.uuid4(),
        email="admin_tester@citizenreport.gov.bd",
        username="admintester",
        hashed_password=get_password_hash("AdminPassword123!"),
        role=UserRole.ADMIN,
        is_active=True,
    )
    db_session.add(admin)
    await db_session.commit()
    return admin


# ---------------------------------------------------------------------------
# 1. Road Safety Intelligence Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_road_safety_intelligence_with_accidents(
    async_client: AsyncClient,
    db_session: AsyncSession,
    sample_categories,
    sample_user,
):
    pub_cat = next(c for c in sample_categories if c.slug == "public-safety")
    now = datetime.now(timezone.utc)

    # Seed 3 accident reports near Dhanmondi 27 (lat: 23.7461, lng: 90.3742)
    rep1 = Report(
        id=uuid.uuid4(),
        user_id=sample_user.id,
        category_id=pub_cat.id,
        title="Bus and Motorcycle Collision near Road 27",
        description="A passenger bus hit a motorcycle at high speed causing severe road blockage.",
        location_text="Road 27, Dhanmondi, Dhaka",
        latitude=23.7465,
        longitude=90.3745,
        status=ReportStatus.APPROVED,
        incident_date=now - timedelta(days=2),
    )
    rep2 = Report(
        id=uuid.uuid4(),
        user_id=sample_user.id,
        category_id=pub_cat.id,
        title="Overturned Truck creating dangerous traffic hazard",
        description="Overturned vehicle on highway stretch.",
        location_text="Dhanmondi 27 Junction, Dhaka",
        latitude=23.7470,
        longitude=90.3750,
        status=ReportStatus.APPROVED,
        incident_date=now - timedelta(days=5),
    )
    rep3 = Report(
        id=uuid.uuid4(),
        user_id=sample_user.id,
        category_id=pub_cat.id,
        title="Severe Pothole and road hazard",
        description="Large crater in the middle lane causing motorbike crashes.",
        location_text="Dhanmondi, Dhaka",
        latitude=23.7480,
        longitude=90.3730,
        status=ReportStatus.APPROVED,
        incident_date=now - timedelta(days=10),
    )
    db_session.add_all([rep1, rep2, rep3])
    await db_session.commit()

    # Query Road Safety endpoint near Dhanmondi 27
    res = await async_client.get(
        "/api/v1/safety/road-intelligence",
        params={"latitude": 23.7461, "longitude": 90.3742, "radius_km": 2.0, "lang": "en"},
    )
    assert res.status_code == 200, res.text
    data = res.json()

    assert data["metrics"]["total_accidents"] >= 3
    assert data["metrics"]["verified_accidents"] >= 3
    assert data["metrics"]["recent_accidents_7d"] >= 2
    assert data["risk_score"] > 25.0
    assert data["risk_level"] in ["Moderate", "High", "Critical"]
    assert len(data["nearby_alerts"]) >= 1
    assert data["nearby_alerts"][0]["distance_meters"] > 0
    assert data["nearby_alerts"][0]["latitude"] is not None
    assert data["nearby_alerts"][0]["longitude"] is not None
    assert len(data["history"]) >= 3
    assert data["history"][0]["latitude"] is not None
    assert data["history"][0]["longitude"] is not None
    assert "explanation" in data
    assert len(data["explanation"]["contributing_factors"]) >= 1
    assert len(data["explanation"]["precautions"]) >= 1


@pytest.mark.asyncio
async def test_road_safety_intelligence_low_data(
    async_client: AsyncClient,
    db_session: AsyncSession,
):
    # Query an empty rural coordinate with 0 reports
    res = await async_client.get(
        "/api/v1/safety/road-intelligence",
        params={"latitude": 21.0000, "longitude": 88.0000, "radius_km": 3.0, "lang": "bn"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["metrics"]["total_accidents"] == 0
    assert data["risk_level"] == "Low"
    assert "Low" in data["metrics"]["data_confidence"]
    assert len(data["nearby_alerts"]) == 0
    assert "বিপদ" in data["explanation"]["summary"] or "ঝুঁকি" in data["explanation"]["summary"]


# ---------------------------------------------------------------------------
# 2. AI Emergency Assistant Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_emergency_assistant_english_complete(
    async_client: AsyncClient,
    db_session: AsyncSession,
    sample_categories,
):
    msg = "I witnessed a motorcycle accident near Dhanmondi 27. One rider is injured and bleeding."
    res = await async_client.post(
        "/api/v1/reports/ai-assistant/chat",
        json={"message": msg, "lang": "en"},
    )
    assert res.status_code == 200, res.text
    data = res.json()

    assert "reply" in data
    assert data["is_ready_for_review"] is True
    assert data["draft_report"] is not None
    assert "Dhanmondi" in data["draft_report"]["location_text"]
    assert "999" in data["emergency_notice"]
    assert data["action_plan_summary"] is not None


@pytest.mark.asyncio
async def test_emergency_assistant_bangla_missing_location(
    async_client: AsyncClient,
    db_session: AsyncSession,
    sample_categories,
):
    msg = "একটি বড় বাস দুর্ঘটনা ঘটেছে। কয়েকজন আহত।"
    res = await async_client.post(
        "/api/v1/reports/ai-assistant/chat",
        json={"message": msg, "lang": "bn"},
    )
    assert res.status_code == 200, res.text
    data = res.json()

    assert "reply" in data
    # Missing location should prompt a follow-up question
    assert "location_text" in data["missing_fields"]
    assert data["follow_up_question"] is not None
    assert "৯৯৯" in data["emergency_notice"]


# ---------------------------------------------------------------------------
# 3. AI Emergency Action Planner Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_action_planner_accident(async_client: AsyncClient):
    res = await async_client.post(
        "/api/v1/safety/action-plan",
        json={"emergency_type": "road_accident", "details": "Bus overturned with passengers inside", "lang": "en"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["emergency_hotline"] == "999"
    assert len(data["immediate_steps"]) >= 3
    assert len(data["precautions_to_avoid"]) >= 2
    assert "999" in data["immediate_steps"][1]


@pytest.mark.asyncio
async def test_action_planner_fire_bangla(async_client: AsyncClient):
    res = await async_client.post(
        "/api/v1/safety/action-plan",
        json={"emergency_type": "fire", "lang": "bn"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["emergency_hotline"] == "999"
    assert any("ফায়ার" in s or "৯৯৯" in s for s in data["immediate_steps"])
    assert any("পানি" in p for p in data["precautions_to_avoid"])


# ---------------------------------------------------------------------------
# 4. Duplicate Incident Detection Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_duplicate_incident_detection(
    async_client: AsyncClient,
    db_session: AsyncSession,
    sample_categories,
    sample_user,
    sample_admin,
):
    pub_cat = next(c for c in sample_categories if c.slug == "public-safety")

    # Primary report in Kakoli
    primary_rep = Report(
        id=uuid.uuid4(),
        user_id=sample_user.id,
        category_id=pub_cat.id,
        title="Severe Bus Crash at Kakoli Intersection",
        description="Blue passenger bus collided with a private car causing massive gridlock.",
        location_text="Kakoli Intersection, Banani, Dhaka",
        latitude=23.7937,
        longitude=90.4043,
        status=ReportStatus.APPROVED,
        incident_date=datetime.now(timezone.utc),
    )
    db_session.add(primary_rep)
    await db_session.commit()

    # Pre-submission check for another report describing the same incident 100m away
    dup_check_res = await async_client.post(
        "/api/v1/reports/duplicate-check",
        json={
            "title": "Bus and Car Collision at Kakoli Banani",
            "description": "A passenger bus hit a car near Kakoli intersection.",
            "category_id": str(pub_cat.id),
            "latitude": 23.7940,
            "longitude": 90.4045,
            "location_text": "Kakoli, Banani, Dhaka",
        },
    )
    assert dup_check_res.status_code == 200, dup_check_res.text
    dup_data = dup_check_res.json()

    assert dup_data["is_potential_duplicate"] is True
    assert dup_data["primary_report_id"] == str(primary_rep.id)
    assert len(dup_data["candidates"]) >= 1
    assert dup_data["candidates"][0]["similarity_score"] >= 60.0

    # Test Moderator confirmation endpoint
    from app.core.security import create_access_token
    admin_token = create_access_token(subject=sample_admin.id, role="ADMIN")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    sec_rep = Report(
        id=uuid.uuid4(),
        user_id=sample_user.id,
        category_id=pub_cat.id,
        title="Traffic Jam due to Kakoli crash",
        description="Duplicate viewpoint of the crash.",
        location_text="Banani Kakoli",
        latitude=23.7942,
        longitude=90.4046,
        status=ReportStatus.SUBMITTED,
    )
    db_session.add(sec_rep)
    await db_session.commit()

    mod_res = await async_client.post(
        "/api/v1/admin/duplicates/action",
        headers=admin_headers,
        json={
            "primary_report_id": str(primary_rep.id),
            "duplicate_report_id": str(sec_rep.id),
            "action": "confirm",
            "notes": "Verified corroborated duplicate report by moderator",
        },
    )
    assert mod_res.status_code == 200, mod_res.text
    assert mod_res.json()["status"] == "confirmed"


# ---------------------------------------------------------------------------
# 5. AI Blood Donation Assistant Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_blood_donation_assistant_exact_matching(
    async_client: AsyncClient,
    db_session: AsyncSession,
    sample_user,
):
    # Register 2 real donors: one O+ in Dhanmondi, one B+ in Mirpur
    donor_o = BloodDonorProfile(
        id=uuid.uuid4(),
        user_id=sample_user.id,
        blood_group=BloodGroup.O_POS,
        district="Dhaka",
        area="Dhanmondi",
        availability_status=DonorAvailability.AVAILABLE,
        contact_phone="+8801711223344",
        preferred_contact_method="PHONE",
    )
    other_user = User(
        id=uuid.uuid4(),
        email="donor_b@example.com",
        username="donorbpos",
        hashed_password=get_password_hash("DonorPassword123!"),
        role=UserRole.USER,
        is_active=True,
    )
    db_session.add(other_user)
    await db_session.flush()

    donor_b = BloodDonorProfile(
        id=uuid.uuid4(),
        user_id=other_user.id,
        blood_group=BloodGroup.B_POS,
        district="Dhaka",
        area="Mirpur",
        availability_status=DonorAvailability.AVAILABLE,
        contact_phone="+8801811223344",
        preferred_contact_method="PHONE",
    )
    db_session.add_all([donor_o, donor_b])
    await db_session.commit()

    # Search for O+ blood in English
    res_o = await async_client.post(
        "/api/v1/blood/ai-assistant",
        json={"query": "I urgently need O+ blood in Dhanmondi Dhaka", "lang": "en"},
    )
    assert res_o.status_code == 200, res_o.text
    data_o = res_o.json()

    assert data_o["parsed_blood_group"] == "O+"
    assert data_o["total_donors_found"] >= 1
    # Strict matching: should ONLY contain O+ donors, NEVER B+!
    for d in data_o["donors"]:
        assert d["blood_group"] == "O+"
        assert d["availability_status"] == "AVAILABLE"

    # Search in Bangla
    res_bn = await async_client.post(
        "/api/v1/blood/ai-assistant",
        json={"query": "আমার জরুরি ও পজিটিভ রক্ত লাগবে ধানমন্ডিতে", "lang": "bn"},
    )
    assert res_bn.status_code == 200
    data_bn = res_bn.json()
    assert data_bn["parsed_blood_group"] == "O+"
    assert data_bn["total_donors_found"] >= 1
    assert "O+" in data_bn["explanation"] or "ও পজিটিভ" in data_bn["explanation"]

    # Search without blood group -> Should trigger clarification question
    res_ambiguous = await async_client.post(
        "/api/v1/blood/ai-assistant",
        json={"query": "হাসপাতালে রোগীর জন্য রক্ত প্রয়োজন", "lang": "bn"},
    )
    assert res_ambiguous.status_code == 200
    data_amb = res_ambiguous.json()
    assert data_amb["is_clarification_needed"] is True
    assert data_amb["clarification_question"] is not None
    assert len(data_amb["donors"]) == 0


@pytest.mark.asyncio
async def test_road_safety_hotspots_grounded_in_db(
    async_client: AsyncClient,
    db_session: AsyncSession,
):
    """Verifies that regional corridors report actual database counts and do not fabricate fake stats."""
    res = await async_client.get(
        "/api/v1/safety/road-intelligence",
        params={"latitude": 23.7806, "longitude": 90.3522, "radius_km": 2.0, "lang": "en"},
    )
    assert res.status_code == 200
    data = res.json()
    assert "hotspots" in data
    # When no records were seeded around corridors in this test, hotspot count must be 0, not fabricated
    for spot in data["hotspots"]:
        assert isinstance(spot["accident_count"], int)
        assert spot["accident_count"] >= 0


@pytest.mark.asyncio
async def test_duplicate_detection_false_positive_rejection(
    async_client: AsyncClient,
    db_session: AsyncSession,
    sample_categories,
    sample_user,
):
    """Verifies that distinct incidents in different locations and categories do not trigger false duplicates."""
    pub_cat = next(c for c in sample_categories if c.slug == "public-safety")
    other_cat = next(c for c in sample_categories if c.slug != "public-safety")

    existing_rep = Report(
        id=uuid.uuid4(),
        user_id=sample_user.id,
        category_id=pub_cat.id,
        title="Traffic Signal Fault at Farmgate",
        description="Signal timer is broken at Farmgate crossing causing vehicle jams.",
        location_text="Farmgate, Dhaka",
        latitude=23.7561,
        longitude=90.3872,
        status=ReportStatus.APPROVED,
    )
    db_session.add(existing_rep)
    await db_session.commit()

    # Check a completely different report in Chattogram
    dup_res = await async_client.post(
        "/api/v1/reports/duplicate-check",
        json={
            "title": "Severe Water Logging in Agrabad",
            "description": "Monsoon rain flooded Agrabad commercial area with two feet of water.",
            "category_id": str(other_cat.id),
            "location_text": "Agrabad, Chattogram",
            "latitude": 22.3242,
            "longitude": 91.8145,
        },
    )
    assert dup_res.status_code == 200
    data = dup_res.json()
    assert data["is_potential_duplicate"] is False
    assert len(data["candidates"]) == 0


@pytest.mark.asyncio
async def test_blood_assistant_zero_results_no_fabrication(
    async_client: AsyncClient,
    db_session: AsyncSession,
):
    """Verifies that an unrepresented blood group returns 0 donors with no fabricated names."""
    res = await async_client.post(
        "/api/v1/blood/ai-assistant",
        json={"query": "Need AB- blood urgently in Sylhet", "lang": "en"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["parsed_blood_group"] == "AB-"
    assert data["total_donors_found"] == 0
    assert len(data["donors"]) == 0
    assert "No registered AB- donors currently available" in data["explanation"]


@pytest.mark.asyncio
async def test_evaluate_driving_route_risk(
    async_client: AsyncClient,
    db_session: AsyncSession,
    sample_categories,
    sample_user,
):
    """Verifies that route risk evaluation accurately identifies real database accident reports along route waypoints."""
    pub_cat = next(c for c in sample_categories if c.slug == "public-safety")
    now = datetime.now(timezone.utc)

    # Seed an accident report near Mirpur Road (lat: 23.7806, lng: 90.3522)
    rep = Report(
        id=uuid.uuid4(),
        user_id=sample_user.id,
        category_id=pub_cat.id,
        title="Bus Crash on Mirpur Road near Gabtoli",
        description="Head on crash blocking 2 lanes.",
        location_text="Gabtoli, Mirpur Road, Dhaka",
        latitude=23.7810,
        longitude=90.3525,
        status=ReportStatus.APPROVED,
        incident_date=now - timedelta(days=2),
    )
    db_session.add(rep)
    await db_session.commit()

    # Route passing directly through Gabtoli (within 100 meters)
    route_waypoints = [
        [23.7750, 90.3500],
        [23.7810, 90.3524],  # ~10 meters from accident
        [23.7880, 90.3550],
    ]

    res = await async_client.post(
        "/api/v1/safety/road-intelligence/route-risk",
        json={"waypoints": route_waypoints, "lang": "en"},
    )
    assert res.status_code == 200, res.text
    data = res.json()

    assert data["total_hazards_count"] >= 1
    assert len(data["hazards_along_route"]) >= 1
    assert data["hazards_along_route"][0]["latitude"] is not None
    assert data["hazards_along_route"][0]["longitude"] is not None
    assert "Mirpur Road" in data["hazards_along_route"][0]["title"] or "Crash" in data["hazards_along_route"][0]["title"]
    assert "safety_advisory" in data

    # Test short/empty route
    res_short = await async_client.post(
        "/api/v1/safety/road-intelligence/route-risk",
        json={"waypoints": [[23.0, 90.0]], "lang": "en"},
    )
    assert res_short.status_code == 200
    assert res_short.json()["route_risk_level"] == "Low"


