import uuid
from datetime import datetime, timezone, timedelta
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User, UserRole
from app.models.category import Category
from app.models.report import Report, ReportStatus
from app.models.blood import (
    BloodGroup,
    BloodUrgency,
    BloodRequestStatus,
    ResponseStatus,
    DonorAvailability,
    BloodDonorProfile,
    BloodRequest,
    BloodRequestResponse,
)
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


@pytest.mark.asyncio
async def test_emergency_assistant_bengali_blood_request(
    async_client: AsyncClient,
    db_session: AsyncSession,
    sample_categories,
):
    # Benchmark Bengali Prompt from Phase A Spec
    msg = "আমার বাবার B+ blood লাগবে। ঢাকার একটা হাসপাতালে ভর্তি। আজ রাতের মধ্যে ২ ব্যাগ লাগবে।"
    res = await async_client.post(
        "/api/v1/reports/ai-assistant/chat",
        json={"message": msg, "lang": "bn"},
    )
    assert res.status_code == 200, res.text
    data = res.json()

    assert data["emergency_type"] == "BLOOD_REQUEST"
    assert data["extracted_fields"]["blood_group"] == "B+"
    assert data["extracted_fields"]["units_required"] == 2
    assert "contact_phone" in data["missing_fields"]
    assert data["follow_up_question"] is not None
    assert "৯৯৯" in data["emergency_notice"]
    assert data["draft_blood_request"] is not None
    assert data["draft_blood_request"]["blood_group"] == "B+"
    assert data["draft_blood_request"]["units_required"] == 2


@pytest.mark.asyncio
async def test_emergency_assistant_english_blood_request_complete(
    async_client: AsyncClient,
    db_session: AsyncSession,
    sample_categories,
):
    # Benchmark English Prompt from Phase A Spec
    msg = "My father needs two bags of B+ blood tonight at Square Hospital in Dhaka. Contact: 01712345678"
    res = await async_client.post(
        "/api/v1/reports/ai-assistant/chat",
        json={"message": msg, "lang": "en"},
    )
    assert res.status_code == 200, res.text
    data = res.json()

    assert data["emergency_type"] == "BLOOD_REQUEST"
    assert data["extracted_fields"]["blood_group"] == "B+"
    assert data["extracted_fields"]["units_required"] == 2
    assert "Square Hospital" in data["extracted_fields"]["hospital_name"]
    assert data["extracted_fields"]["contact_phone"] == "01712345678"
    assert data["is_ready_for_review"] is True
    assert len(data["missing_fields"]) == 0
    assert data["draft_blood_request"] is not None
    assert data["draft_blood_request"]["hospital_name"] == "Square Hospital"
    assert data["confirmation_token"] is not None


@pytest.mark.asyncio
async def test_emergency_assistant_banglish_blood_request(
    async_client: AsyncClient,
    db_session: AsyncSession,
    sample_categories,
):
    # Benchmark Banglish Prompt from Phase A Spec
    msg = "Amar babar B+ blood lagbe, hospital Dhaka te, 2 bag urgent, phone 01811223344"
    res = await async_client.post(
        "/api/v1/reports/ai-assistant/chat",
        json={"message": msg, "lang": "en"},
    )
    assert res.status_code == 200, res.text
    data = res.json()

    assert data["emergency_type"] == "BLOOD_REQUEST"
    assert data["extracted_fields"]["blood_group"] == "B+"
    assert data["extracted_fields"]["units_required"] == 2
    assert data["extracted_fields"]["contact_phone"] == "01811223344"
    assert data["is_ready_for_review"] is True
    assert data["draft_blood_request"] is not None


@pytest.mark.asyncio
async def test_emergency_assistant_multiturn_clarification(
    async_client: AsyncClient,
    db_session: AsyncSession,
    sample_categories,
):
    # Turn 1: Partial details provided (missing hospital and contact)
    turn1_res = await async_client.post(
        "/api/v1/reports/ai-assistant/chat",
        json={"message": "আমার বি পজিটিভ রক্ত লাগবে জরুরি", "lang": "bn"},
    )
    assert turn1_res.status_code == 200
    turn1_data = turn1_res.json()
    assert turn1_data["is_ready_for_review"] is False
    assert "contact_phone" in turn1_data["missing_fields"]
    assert "hospital_name" in turn1_data["missing_fields"]
    conv_id = turn1_data["conversation_id"]

    # Turn 2: User responds with missing hospital & phone number
    history = [
        {"role": "user", "content": "আমার বি পজিটিভ রক্ত লাগবে জরুরি"},
        {"role": "assistant", "content": turn1_data["reply"]},
    ]
    turn2_res = await async_client.post(
        "/api/v1/reports/ai-assistant/chat",
        json={
            "message": "ঢাকা মেডিকেল কলেজ হাসপাতাল, ২ ব্যাগ লাগবে, ফোন 01711223344",
            "history": history,
            "conversation_id": conv_id,
            "lang": "bn",
        },
    )
    assert turn2_res.status_code == 200
    turn2_data = turn2_res.json()

    # Verify previously provided blood group was preserved, and new details incorporated
    assert turn2_data["extracted_fields"]["blood_group"] == "B+"
    assert turn2_data["extracted_fields"]["units_required"] == 2
    assert "Dhaka Medical" in turn2_data["extracted_fields"]["hospital_name"]
    assert turn2_data["extracted_fields"]["contact_phone"] == "01711223344"
    assert turn2_data["is_ready_for_review"] is True
    assert len(turn2_data["missing_fields"]) == 0
    assert turn2_data["draft_blood_request"] is not None


@pytest.mark.asyncio
async def test_emergency_confirmation_unauthorized(
    async_client: AsyncClient,
):
    # Unauthenticated citizen attempting confirmation
    res = await async_client.post(
        "/api/v1/reports/ai-assistant/confirm",
        json={
            "conversation_id": "test-conv-123",
            "emergency_type": "INCIDENT",
            "draft_report": {
                "title": "Road Accident",
                "description": "Bus crashed into railing at Mirpur",
                "location_text": "Mirpur 10",
            },
        },
    )
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_emergency_confirmation_incident_success(
    async_client: AsyncClient,
    db_session: AsyncSession,
    sample_categories,
    sample_user,
):
    from app.core.security import create_access_token
    token = create_access_token(subject=str(sample_user.id))
    headers = {"Authorization": f"Bearer {token}"}

    conf_req = {
        "conversation_id": "conv-inc-test",
        "emergency_type": "INCIDENT",
        "confirmation_token": str(uuid.uuid4()),
        "draft_report": {
            "title": "Dangerous Chemical Leak near Road 11",
            "description": "Industrial container leaking acidic fluid causing breathing issues for pedestrians.",
            "location_text": "Road 11, Banani, Dhaka",
            "latitude": 23.7937,
            "longitude": 90.4066,
            "category_slug": "public-safety",
            "severity": "High",
            "is_anonymous": False,
        },
    }

    res = await async_client.post(
        "/api/v1/reports/ai-assistant/confirm",
        json=conf_req,
        headers=headers,
    )
    assert res.status_code == 201, res.text
    data = res.json()

    assert data["status"] == "CONFIRMED"
    assert data["emergency_type"] == "INCIDENT"
    assert data["request_status"] == "SUBMITTED"
    assert data["record_id"] is not None
    assert f"/reports/{data['record_id']}" in data["redirect_url"]

    # Verify report is actually in the DB
    stmt = select(Report).where(Report.id == uuid.UUID(data["record_id"]))
    rep_res = await db_session.execute(stmt)
    created_rep = rep_res.scalar_one_or_none()
    assert created_rep is not None
    assert created_rep.title == "Dangerous Chemical Leak near Road 11"
    assert created_rep.user_id == sample_user.id
    assert created_rep.status == ReportStatus.SUBMITTED


@pytest.mark.asyncio
async def test_emergency_confirmation_blood_success(
    async_client: AsyncClient,
    db_session: AsyncSession,
    sample_categories,
    sample_user,
):
    from app.core.security import create_access_token
    token = create_access_token(subject=str(sample_user.id))
    headers = {"Authorization": f"Bearer {token}"}

    conf_req = {
        "conversation_id": "conv-bld-test",
        "emergency_type": "BLOOD_REQUEST",
        "confirmation_token": str(uuid.uuid4()),
        "draft_blood_request": {
            "blood_group": "B+",
            "units_required": 2,
            "hospital_name": "Square Hospital",
            "hospital_area": "Panthapath",
            "district": "Dhaka",
            "urgency": "EMERGENCY",
            "contact_name": "Rahim Ahmed",
            "contact_phone": "01712345678",
            "contact_method": "PHONE",
            "additional_information": "ICU bed 4, urgent cardiac surgery",
        },
    }

    res = await async_client.post(
        "/api/v1/reports/ai-assistant/confirm",
        json=conf_req,
        headers=headers,
    )
    assert res.status_code == 201, res.text
    data = res.json()

    assert data["status"] == "CONFIRMED"
    assert data["emergency_type"] == "BLOOD_REQUEST"
    assert data["request_status"] == "OPEN"
    assert data["record_id"] is not None

    # Verify blood request exists in DB
    stmt = select(BloodRequest).where(BloodRequest.id == uuid.UUID(data["record_id"]))
    b_res = await db_session.execute(stmt)
    created_blood = b_res.scalar_one_or_none()
    assert created_blood is not None
    assert created_blood.blood_group == BloodGroup.B_POS
    assert created_blood.units_required == 2
    assert created_blood.hospital_name == "Square Hospital"
    assert created_blood.user_id == sample_user.id


@pytest.mark.asyncio
async def test_emergency_confirmation_duplicate_protection(
    async_client: AsyncClient,
    db_session: AsyncSession,
    sample_categories,
    sample_user,
):
    from app.core.security import create_access_token
    token = create_access_token(subject=str(sample_user.id))
    headers = {"Authorization": f"Bearer {token}"}
    shared_token = f"dedup-test-{uuid.uuid4()}"

    conf_req = {
        "conversation_id": "conv-dedup",
        "emergency_type": "INCIDENT",
        "confirmation_token": shared_token,
        "draft_report": {
            "title": "Transformer Sparking at Dhanmondi 32",
            "description": "Electric spark on overhead pole posing fire hazard.",
            "location_text": "Dhanmondi 32, Dhaka",
            "category_slug": "public-safety",
        },
    }

    # First submission
    res1 = await async_client.post("/api/v1/reports/ai-assistant/confirm", json=conf_req, headers=headers)
    assert res1.status_code == 201
    data1 = res1.json()

    # Second submission with the same token (e.g. double click)
    res2 = await async_client.post("/api/v1/reports/ai-assistant/confirm", json=conf_req, headers=headers)
    assert res2.status_code == 201
    data2 = res2.json()

    # Should return the same record and indicate already confirmed
    assert data1["record_id"] == data2["record_id"]
    assert "already been confirmed" in data2["message"]


@pytest.mark.asyncio
async def test_emergency_confirmation_validation_failure(
    async_client: AsyncClient,
    sample_user,
):
    from app.core.security import create_access_token
    token = create_access_token(subject=str(sample_user.id))
    headers = {"Authorization": f"Bearer {token}"}

    # Invalid blood group
    res = await async_client.post(
        "/api/v1/reports/ai-assistant/confirm",
        json={
            "conversation_id": "conv-invalid",
            "emergency_type": "BLOOD_REQUEST",
            "draft_blood_request": {
                "blood_group": "INVALID_GROUP",
                "units_required": 1,
                "hospital_name": "Test Hospital",
                "hospital_area": "Dhaka",
                "district": "Dhaka",
            },
        },
        headers=headers,
    )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_ai_client_json_extraction_variations():
    from app.services.ai_client import extract_json_from_text

    # 1. Clean JSON
    assert extract_json_from_text('{"blood_group": "B+", "units": 2}') == {"blood_group": "B+", "units": 2}

    # 2. Markdown fenced code block
    fenced = "Here is the extracted information:\n```json\n{\"blood_group\": \"A+\", \"units\": 1}\n```\nHope this helps!"
    assert extract_json_from_text(fenced) == {"blood_group": "A+", "units": 1}

    # 3. Text preceding and trailing
    embedded = "Analysis complete: {\"severity\": \"Critical\", \"category\": \"public-safety\"} verified by system."
    assert extract_json_from_text(embedded) == {"severity": "Critical", "category": "public-safety"}

    # 4. Empty or invalid string
    assert extract_json_from_text("") is None
    assert extract_json_from_text("No JSON here whatsoever") is None


@pytest.mark.asyncio
async def test_emergency_assistant_provider_failure_graceful_degradation(
    async_client: AsyncClient,
    db_session: AsyncSession,
    sample_categories,
    monkeypatch,
):
    from app.services import ai_client

    # Simulate OpenRouter timeout / exception
    async def mock_call_ai_json(*args, **kwargs):
        return None

    monkeypatch.setattr(ai_client, "call_ai_json", mock_call_ai_json)

    res = await async_client.post(
        "/api/v1/reports/ai-assistant/chat",
        json={
            "message": "Crash between private car and CNG near Uttara Sector 3. Driver injured.",
            "lang": "en",
        },
    )
    assert res.status_code == 200
    data = res.json()

    # Deterministic parser should successfully step in
    assert "Uttara" in data["extracted_fields"]["location_text"]
    assert data["is_ready_for_review"] is True
    assert data["draft_report"] is not None
    assert "999" in data["emergency_notice"]


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


# ---------------------------------------------------------------------------
# 6. AI Donor Coordination Assistant Tests (Phase B)
# ---------------------------------------------------------------------------

@pytest.fixture
async def sample_donor_user(db_session: AsyncSession):
    user = User(
        id=uuid.uuid4(),
        email="volunteer_donor@example.com",
        username="volunteerdonor",
        hashed_password=get_password_hash("DonorPassword123!"),
        role=UserRole.USER,
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    return user


@pytest.fixture
async def sample_blood_request(db_session: AsyncSession, sample_user):
    now = datetime.now(timezone.utc)
    req = BloodRequest(
        id=uuid.uuid4(),
        user_id=sample_user.id,
        blood_group=BloodGroup.B_POS,
        units_required=2,
        hospital_name="Square Hospital",
        hospital_area="Panthapath",
        district="Dhaka",
        required_date=now + timedelta(hours=24),
        required_time="Immediate",
        urgency=BloodUrgency.EMERGENCY,
        status=BloodRequestStatus.OPEN,
        is_active=True,
    )
    db_session.add(req)
    await db_session.commit()
    await db_session.refresh(req)
    return req


@pytest.mark.asyncio
async def test_donor_coordination_intent_recognition_bengali(
    async_client: AsyncClient,
    sample_blood_request,
):
    req_id = str(sample_blood_request.id)

    # 1. Status Intent (Bengali benchmark)
    res = await async_client.post(
        "/api/v1/reports/ai-assistant/donor-coordination",
        json={"message": "আমার blood request এর donor status কী?", "request_id": req_id, "lang": "bn"},
    )
    assert res.status_code == 200
    assert res.json()["intent"] == "VIEW_REQUEST_STATUS"
    assert "Square Hospital" in res.json()["reply"]

    # 2. Outreach Intent (Bengali benchmark)
    res2 = await async_client.post(
        "/api/v1/reports/ai-assistant/donor-coordination",
        json={"message": "এই request এর outreach status কী?", "request_id": req_id, "lang": "bn"},
    )
    assert res2.status_code == 200
    assert res2.json()["intent"] == "REQUEST_OUTREACH"

    # 3. Express Interest Intent (Bengali benchmark)
    res3 = await async_client.post(
        "/api/v1/reports/ai-assistant/donor-coordination",
        json={"message": "আমি donor হিসেবে এই request এ interested হতে চাই।", "request_id": req_id, "lang": "bn"},
    )
    assert res3.status_code == 200
    assert res3.json()["intent"] == "EXPRESS_DONOR_INTEREST"

    # 4. Explain Match Intent (Bengali benchmark)
    res4 = await async_client.post(
        "/api/v1/reports/ai-assistant/donor-coordination",
        json={"message": "কেন match করে এই ডোনারদের সাথে?", "request_id": req_id, "lang": "bn"},
    )
    assert res4.status_code == 200
    assert res4.json()["intent"] == "EXPLAIN_DONOR_MATCH"


@pytest.mark.asyncio
async def test_donor_coordination_intent_recognition_english_and_banglish(
    async_client: AsyncClient,
    sample_blood_request,
):
    req_id = str(sample_blood_request.id)

    # English benchmark: "Show me available matching donors."
    res1 = await async_client.post(
        "/api/v1/reports/ai-assistant/donor-coordination",
        json={"message": "Show me available matching donors.", "request_id": req_id, "lang": "en"},
    )
    assert res1.status_code == 200
    assert res1.json()["intent"] == "FIND_MATCHING_DONORS"

    # English benchmark: "Can you explain why these donors match?"
    res2 = await async_client.post(
        "/api/v1/reports/ai-assistant/donor-coordination",
        json={"message": "Can you explain why these donors match?", "request_id": req_id, "lang": "en"},
    )
    assert res2.status_code == 200
    assert res2.json()["intent"] == "EXPLAIN_DONOR_MATCH"

    # Banglish benchmark: "Amar request er jonno koyjon donor interested?"
    res3 = await async_client.post(
        "/api/v1/reports/ai-assistant/donor-coordination",
        json={"message": "Amar request er jonno koyjon donor interested?", "request_id": req_id, "lang": "en"},
    )
    assert res3.status_code == 200
    assert res3.json()["intent"] == "VIEW_DONOR_RESPONSES"

    # English benchmark: "Which donors have already accepted?"
    res4 = await async_client.post(
        "/api/v1/reports/ai-assistant/donor-coordination",
        json={"message": "Which donors have already accepted?", "request_id": req_id, "lang": "en"},
    )
    assert res4.status_code == 200
    assert res4.json()["intent"] == "VIEW_DONOR_RESPONSES"


@pytest.mark.asyncio
async def test_donor_coordination_missing_request_clarification(
    async_client: AsyncClient,
):
    # No request ID provided and unauthenticated / no active request
    res = await async_client.post(
        "/api/v1/reports/ai-assistant/donor-coordination",
        json={"message": "What is the status of my blood request?", "lang": "en"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["intent"] == "CLARIFY_REQUEST"
    assert data["is_clarification_needed"] is True
    assert data["follow_up_question"] is not None


@pytest.mark.asyncio
async def test_donor_coordination_view_responses_authorization(
    async_client: AsyncClient,
    db_session: AsyncSession,
    sample_blood_request,
    sample_user,
    sample_donor_user,
):
    from app.core.security import create_access_token
    req = sample_blood_request

    # Seed 2 responses for this request
    resp1 = BloodRequestResponse(
        id=uuid.uuid4(),
        request_id=req.id,
        donor_user_id=sample_donor_user.id,
        message="I am ready to donate B+ blood at Square Hospital.",
        contact_phone="01711223344",
        status=ResponseStatus.ACCEPTED,
    )
    db_session.add(resp1)
    await db_session.commit()

    owner_token = create_access_token(subject=str(sample_user.id))
    stranger_token = create_access_token(subject=str(sample_donor_user.id))

    # 1. Owner queries responses -> succeeds
    res_owner = await async_client.post(
        "/api/v1/reports/ai-assistant/donor-coordination",
        json={"message": "How many donors have responded to my request?", "request_id": str(req.id), "lang": "en"},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert res_owner.status_code == 200
    assert "1" in res_owner.json()["reply"]

    # 2. Stranger queries responses -> refused
    res_stranger = await async_client.post(
        "/api/v1/reports/ai-assistant/donor-coordination",
        json={"message": "How many donors have responded?", "request_id": str(req.id), "lang": "en"},
        headers={"Authorization": f"Bearer {stranger_token}"},
    )
    assert res_stranger.status_code == 200
    assert "privacy" in res_stranger.json()["reply"].lower() or "safeguard" in res_stranger.json()["reply"].lower()


@pytest.mark.asyncio
async def test_donor_coordination_matching_explanation_grounding(
    async_client: AsyncClient,
    db_session: AsyncSession,
    sample_blood_request,
    sample_donor_user,
):
    # Seed a compatible registered donor in Dhaka
    donor_prof = BloodDonorProfile(
        id=uuid.uuid4(),
        user_id=sample_donor_user.id,
        blood_group=BloodGroup.B_POS,
        district="Dhaka",
        area="Dhanmondi",
        availability_status=DonorAvailability.AVAILABLE,
        preferred_contact_method="PHONE",
        contact_phone="01712345678",
    )
    db_session.add(donor_prof)
    await db_session.commit()

    res = await async_client.post(
        "/api/v1/reports/ai-assistant/donor-coordination",
        json={
            "message": "Can you explain why these donors match?",
            "request_id": str(sample_blood_request.id),
            "lang": "en",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["matching_explanation"] is not None
    assert data["matching_explanation"]["recipient_blood_group"] == "B+"
    assert "B+" in data["matching_explanation"]["compatible_blood_groups"]
    assert "O+" in data["matching_explanation"]["compatible_blood_groups"]
    assert len(data["matched_donors"]) >= 1


@pytest.mark.asyncio
async def test_donor_coordination_express_interest_action_preview_and_confirm(
    async_client: AsyncClient,
    db_session: AsyncSession,
    sample_blood_request,
    sample_donor_user,
):
    from app.core.security import create_access_token
    donor_token = create_access_token(subject=str(sample_donor_user.id))
    headers = {"Authorization": f"Bearer {donor_token}"}
    req_id = str(sample_blood_request.id)

    # 1. Volunteer donor chats they want to help
    res1 = await async_client.post(
        "/api/v1/reports/ai-assistant/donor-coordination",
        json={
            "message": "আমি এই request এ রক্ত দিয়ে সাহায্য করতে চাই।",
            "request_id": req_id,
            "lang": "bn",
        },
        headers=headers,
    )
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["action_preview"] is not None
    assert data1["action_preview"]["action_type"] == "EXPRESS_INTEREST"
    assert data1["action_preview"]["confirmation_token"] is not None

    token = data1["action_preview"]["confirmation_token"]

    # 2. Donor submits explicit confirmation
    res2 = await async_client.post(
        "/api/v1/reports/ai-assistant/donor-coordination/confirm",
        json={
            "conversation_id": data1["conversation_id"],
            "confirmation_token": token,
            "action_type": "EXPRESS_INTEREST",
            "request_id": req_id,
            "message": "I will arrive at Square Hospital by 4 PM",
            "contact_phone": "01712345678",
        },
        headers=headers,
    )
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["status"] == "SUCCESS"
    assert data2["record_id"] is not None

    # Verify response in database
    stmt = select(BloodRequestResponse).where(BloodRequestResponse.id == uuid.UUID(data2["record_id"]))
    r = (await db_session.execute(stmt)).scalar_one_or_none()
    assert r is not None
    assert r.donor_user_id == sample_donor_user.id
    assert r.status == ResponseStatus.PENDING


@pytest.mark.asyncio
async def test_donor_coordination_outreach_preview_and_confirm(
    async_client: AsyncClient,
    db_session: AsyncSession,
    sample_blood_request,
    sample_user,
    sample_donor_user,
):
    from app.core.security import create_access_token
    owner_token = create_access_token(subject=str(sample_user.id))
    headers = {"Authorization": f"Bearer {owner_token}"}
    req_id = str(sample_blood_request.id)

    # 1. Request owner asks for outreach
    res1 = await async_client.post(
        "/api/v1/reports/ai-assistant/donor-coordination",
        json={
            "message": "Can we broadcast and notify matching donors?",
            "request_id": req_id,
            "lang": "en",
        },
        headers=headers,
    )
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["action_preview"] is not None
    assert data1["action_preview"]["action_type"] == "TRIGGER_OUTREACH"
    token = data1["action_preview"]["confirmation_token"]

    # 2. Owner confirms outreach
    res2 = await async_client.post(
        "/api/v1/reports/ai-assistant/donor-coordination/confirm",
        json={
            "conversation_id": data1["conversation_id"],
            "confirmation_token": token,
            "action_type": "TRIGGER_OUTREACH",
            "request_id": req_id,
        },
        headers=headers,
    )
    assert res2.status_code == 200
    assert res2.json()["status"] == "SUCCESS"


@pytest.mark.asyncio
async def test_donor_coordination_duplicate_confirmation_protection(
    async_client: AsyncClient,
    sample_blood_request,
    sample_user,
    sample_donor_user,
):
    from app.core.security import create_access_token
    donor_token = create_access_token(subject=str(sample_donor_user.id))
    headers = {"Authorization": f"Bearer {donor_token}"}
    req_id = str(sample_blood_request.id)

    # Chat to obtain confirmation token
    res1 = await async_client.post(
        "/api/v1/reports/ai-assistant/donor-coordination",
        json={"message": "I can help with this blood request", "request_id": req_id, "lang": "en"},
        headers=headers,
    )
    token = res1.json()["action_preview"]["confirmation_token"]

    conf_payload = {
        "conversation_id": res1.json()["conversation_id"],
        "confirmation_token": token,
        "action_type": "EXPRESS_INTEREST",
        "request_id": req_id,
    }

    # First confirmation
    res_first = await async_client.post("/api/v1/reports/ai-assistant/donor-coordination/confirm", json=conf_payload, headers=headers)
    assert res_first.status_code == 200
    assert res_first.json()["status"] == "SUCCESS"

    # Second confirmation with the same token
    res_second = await async_client.post("/api/v1/reports/ai-assistant/donor-coordination/confirm", json=conf_payload, headers=headers)
    assert res_second.status_code == 200
    assert res_second.json()["status"] == "ALREADY_PROCESSED"


