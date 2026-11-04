import pytest
import uuid
from datetime import datetime, timezone, timedelta
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.user import User, UserRole
from app.models.blood import (
    BloodGroup,
    BloodUrgency,
    BloodRequestStatus,
    DonorAvailability,
    ResponseStatus,
    BloodRequest,
    BloodDonorProfile,
    BloodRequestResponse,
)
from app.core.security import create_access_token, get_password_hash
from app.schemas.ai_features import (
    SearchBloodDonorsInput,
    GetBloodRequestInput,
    GetDonorMatchesInput,
    GetDonorResponseSummaryInput,
    ExplainMatchingResultsInput,
    PrepareOutreachPreviewInput,
    DonorCoordinationRequest,
    DonorCoordinationIntent,
)
from app.services.donor_coordination import (
    tool_search_blood_donors,
    tool_get_blood_request,
    tool_get_donor_matches,
    tool_get_donor_response_summary,
    tool_explain_matching_results,
    tool_prepare_outreach_preview,
    process_donor_coordination_chat,
    execute_donor_coordination_confirmation,
    extract_blood_group,
    extract_location_info,
)


@pytest.fixture
async def seed_agentic_test_data(db_session: AsyncSession):
    """
    Seeds a controlled set of synthetic donors across all blood groups,
    with distinct locations, availability, and donation freshness.
    """
    now = datetime.now(timezone.utc)
    hashed_pwd = get_password_hash("test_password_123")

    users = {}
    profiles = {}

    donors_spec = [
        ("opos_savar", "opos_savar@test.local", BloodGroup.O_POS, "Dhaka", "Savar", DonorAvailability.AVAILABLE, 120),
        ("opos_mirpur_recent", "opos_mirpur@test.local", BloodGroup.O_POS, "Dhaka", "Mirpur", DonorAvailability.AVAILABLE, 20),
        ("opos_dhanmondi_unavail", "opos_dhanmondi@test.local", BloodGroup.O_POS, "Dhaka", "Dhanmondi", DonorAvailability.NOT_AVAILABLE, 150),
        ("oneg_uttara", "oneg_uttara@test.local", BloodGroup.O_NEG, "Dhaka", "Uttara", DonorAvailability.AVAILABLE, 140),
        ("apos_dhanmondi", "apos_dhanmondi@test.local", BloodGroup.A_POS, "Dhaka", "Dhanmondi", DonorAvailability.AVAILABLE, 100),
        ("aneg_mohakhali", "aneg_mohakhali@test.local", BloodGroup.A_NEG, "Dhaka", "Mohakhali", DonorAvailability.AVAILABLE, 110),
        ("bpos_savar", "bpos_savar@test.local", BloodGroup.B_POS, "Dhaka", "Savar", DonorAvailability.AVAILABLE, 95),
        ("bneg_ctg", "bneg_ctg@test.local", BloodGroup.B_NEG, "Chattogram", "GEC", DonorAvailability.AVAILABLE, 130),
        ("abpos_sylhet", "abpos_sylhet@test.local", BloodGroup.AB_POS, "Sylhet", "Zindabazar", DonorAvailability.AVAILABLE, 160),
        ("abneg_panthapath", "abneg_panthapath@test.local", BloodGroup.AB_NEG, "Dhaka", "Panthapath", DonorAvailability.AVAILABLE, 105),
    ]

    for key, email, bg, dist, area, avail, days_ago in donors_spec:
        u = User(
            id=uuid.uuid4(),
            email=email,
            username=key,
            full_name=f"Volunteer {key.upper()}",
            hashed_password=hashed_pwd,
            role=UserRole.USER,
            is_active=True,
            is_verified=True,
        )
        db_session.add(u)
        users[key] = u

        p = BloodDonorProfile(
            id=uuid.uuid4(),
            user_id=u.id,
            blood_group=bg,
            district=dist,
            area=area,
            availability_status=avail,
            last_donation_date=now - timedelta(days=days_ago),
            preferred_contact_method="IN_APP",
            contact_phone="01700000000",
            additional_notes="Controlled test donor",
        )
        db_session.add(p)
        profiles[key] = p

    # Requester user
    requester = User(
        id=uuid.uuid4(),
        email="requester@test.local",
        username="requester_savar",
        full_name="Requester Savar Enam",
        hashed_password=hashed_pwd,
        role=UserRole.USER,
        is_active=True,
        is_verified=True,
    )
    db_session.add(requester)
    users["requester"] = requester

    # Stranger user
    stranger = User(
        id=uuid.uuid4(),
        email="stranger@test.local",
        username="stranger_user",
        full_name="Stranger User",
        hashed_password=hashed_pwd,
        role=UserRole.USER,
        is_active=True,
        is_verified=True,
    )
    db_session.add(stranger)
    users["stranger"] = stranger

    # Blood Request: O+ at Enam Hospital (Savar, Dhaka)
    req1 = BloodRequest(
        id=uuid.uuid4(),
        user_id=requester.id,
        blood_group=BloodGroup.O_POS,
        units_required=2,
        hospital_name="Enam Medical College Hospital",
        hospital_area="Savar",
        district="Dhaka",
        required_date=now + timedelta(days=1),
        urgency=BloodUrgency.EMERGENCY,
        status=BloodRequestStatus.OPEN,
        is_active=True,
    )
    db_session.add(req1)

    # Response by bpos_savar on req1
    resp1 = BloodRequestResponse(
        id=uuid.uuid4(),
        request_id=req1.id,
        donor_user_id=users["bpos_savar"].id,
        message="I can donate tomorrow morning.",
        status=ResponseStatus.ACCEPTED,
    )
    db_session.add(resp1)

    await db_session.commit()

    return {
        "users": users,
        "profiles": profiles,
        "request": req1,
        "response": resp1,
    }


# ---------------------------------------------------------------------------
# 1. Natural Language O+ Donor Search
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_agentic_opos_donor_search(async_client: AsyncClient, seed_agentic_test_data):
    # Test query 1: English
    res1 = await async_client.post(
        "/api/v1/reports/ai-assistant/donor-coordination",
        json={"message": "Find O+ donors.", "lang": "en"},
    )
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["intent"] == "SEARCH_BLOOD_DONORS"
    assert len(data1["matched_donors"]) > 0
    for d in data1["matched_donors"]:
        assert d["blood_group"] == "O+"
        assert d["eligible_to_donate"] is True
        assert d["availability_status"] == "AVAILABLE"
        assert d["contact_phone"] == "Protected by Nirapotta"

    # Test query 2: Bengali
    res2 = await async_client.post(
        "/api/v1/reports/ai-assistant/donor-coordination",
        json={"message": "Amar O+ blood lagbe, available donor dekhao.", "lang": "bn"},
    )
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["intent"] == "SEARCH_BLOOD_DONORS"
    assert len(data2["matched_donors"]) > 0


# ---------------------------------------------------------------------------
# 2. Other Supported Blood Groups Search (A+, B+, AB+, O-, A-, B-, AB-)
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_agentic_other_blood_groups_search(async_client: AsyncClient, seed_agentic_test_data):
    test_queries = [
        ("Find B- donors in Chattogram", "B-", "Chattogram"),
        ("Show available O negative donors", "O-", None),
        ("Show me A+ donors near Dhanmondi", "A+", "Dhaka"),
        ("Find AB- donors", "AB-", None),
        ("Find A- donors in Mohakhali", "A-", "Dhaka"),
        ("Find AB+ donors in Sylhet", "AB+", "Sylhet"),
    ]

    for query, expected_bg, expected_dist in test_queries:
        res = await async_client.post(
            "/api/v1/reports/ai-assistant/donor-coordination",
            json={"message": query, "lang": "en"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["intent"] == "SEARCH_BLOOD_DONORS"
        assert len(data["matched_donors"]) >= 1
        for d in data["matched_donors"]:
            assert d["blood_group"] == expected_bg
            if expected_dist:
                assert d["district"].lower() == expected_dist.lower()


# ---------------------------------------------------------------------------
# 3. Area-based Filtering (e.g. Savar)
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_agentic_area_based_filtering(async_client: AsyncClient, seed_agentic_test_data):
    res = await async_client.post(
        "/api/v1/reports/ai-assistant/donor-coordination",
        json={"message": "Show available O positive donors near Savar.", "lang": "en"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["intent"] == "SEARCH_BLOOD_DONORS"
    assert len(data["matched_donors"]) == 1
    donor = data["matched_donors"][0]
    assert donor["area"] == "Savar"
    assert donor["blood_group"] == "O+"
    assert donor["approximate_latitude"] is not None
    assert donor["approximate_longitude"] is not None


# ---------------------------------------------------------------------------
# 4. No Matching Records (Zero Hallucination)
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_agentic_no_matching_records(async_client: AsyncClient, seed_agentic_test_data):
    # Search for a blood group in a district where no records exist
    res = await async_client.post(
        "/api/v1/reports/ai-assistant/donor-coordination",
        json={"message": "Find AB- donors in Barishal", "lang": "en"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["intent"] == "SEARCH_BLOOD_DONORS"
    assert len(data["matched_donors"]) == 0
    assert "No active and eligible AB- donors were found" in data["reply"]
    # Verify no fake sample names are present
    assert "Volunteer" not in data["reply"]


# ---------------------------------------------------------------------------
# 5. Unavailable Donor Filtering
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_agentic_unavailable_donor_filtering(db_session: AsyncSession, seed_agentic_test_data):
    # With availability_only=True (default), unavailable donor 'opos_dhanmondi_unavail' must NOT appear
    out1 = await tool_search_blood_donors(
        db_session,
        SearchBloodDonorsInput(blood_group="O+", district="Dhaka", area="Dhanmondi", availability_only=True),
    )
    assert out1.total_found == 0

    # With availability_only=False, unavailable donor appears marked NOT_AVAILABLE
    out2 = await tool_search_blood_donors(
        db_session,
        SearchBloodDonorsInput(blood_group="O+", district="Dhaka", area="Dhanmondi", availability_only=False),
    )
    assert out2.total_found == 1
    assert out2.donors[0].availability_status == "NOT_AVAILABLE"


# ---------------------------------------------------------------------------
# 6. Consent & Freshness Filtering (90-day Clinical Cooldown)
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_agentic_freshness_filtering(db_session: AsyncSession, seed_agentic_test_data):
    # Mirpur donor donated 20 days ago (< 90 days)
    # When eligible_only=True, this donor must be excluded
    out1 = await tool_search_blood_donors(
        db_session,
        SearchBloodDonorsInput(blood_group="O+", district="Dhaka", area="Mirpur", eligible_only=True),
    )
    assert out1.total_found == 0

    # When eligible_only=False, this donor is retrieved with eligible_to_donate=False
    out2 = await tool_search_blood_donors(
        db_session,
        SearchBloodDonorsInput(blood_group="O+", district="Dhaka", area="Mirpur", eligible_only=False),
    )
    assert out2.total_found == 1
    assert out2.donors[0].eligible_to_donate is False
    assert "interval pending" in out2.donors[0].match_explanation.lower()


# ---------------------------------------------------------------------------
# 7. Unauthorized Request Access Protection
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_agentic_unauthorized_request_access(db_session: AsyncSession, seed_agentic_test_data):
    req = seed_agentic_test_data["request"]
    stranger = seed_agentic_test_data["users"]["stranger"]
    requester = seed_agentic_test_data["users"]["requester"]

    # Stranger tries to access private donor responses
    out_stranger = await tool_get_donor_response_summary(
        db_session,
        GetDonorResponseSummaryInput(request_id=str(req.id)),
        current_user=stranger,
    )
    assert out_stranger.is_authorized is False
    assert "Authorization Denied" in out_stranger.error_message
    assert len(out_stranger.responses) == 0

    # Requester (owner) can access responses
    out_owner = await tool_get_donor_response_summary(
        db_session,
        GetDonorResponseSummaryInput(request_id=str(req.id)),
        current_user=requester,
    )
    assert out_owner.is_authorized is True
    assert out_owner.total_responses == 1
    assert out_owner.accepted_count == 1

    # Stranger tries to prepare outreach
    outreach_stranger = await tool_prepare_outreach_preview(
        db_session,
        PrepareOutreachPreviewInput(request_id=str(req.id)),
        current_user=stranger,
    )
    assert outreach_stranger.is_authorized is False
    assert outreach_stranger.action_preview is None


# ---------------------------------------------------------------------------
# 8. Invalid Tool Arguments Validation
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_agentic_invalid_tool_arguments(db_session: AsyncSession, seed_agentic_test_data):
    # Invalid recipient blood group in explanation tool
    with pytest.raises(ValueError, match="Invalid recipient blood group"):
        tool_explain_matching_results(
            ExplainMatchingResultsInput(recipient_blood_group="INVALID_GROUP")
        )

    # Invalid request UUID in get_blood_request
    with pytest.raises(ValueError, match="not a valid UUID|badly formed"):
        await tool_get_blood_request(
            db_session,
            GetBloodRequestInput(request_id="not-a-uuid"),
        )


# ---------------------------------------------------------------------------
# 9. AI Hallucination Prevention
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_agentic_ai_hallucination_prevention(async_client: AsyncClient, seed_agentic_test_data):
    res = await async_client.post(
        "/api/v1/reports/ai-assistant/donor-coordination",
        json={"message": "Show available O positive donors near Savar.", "lang": "en"},
    )
    assert res.status_code == 200
    data = res.json()
    assert len(data["matched_donors"]) == 1
    returned_donor = data["matched_donors"][0]

    # Authoritative verification: check that this donor actually exists in the database
    seeded_profile = seed_agentic_test_data["profiles"]["opos_savar"]
    assert returned_donor["donor_id"] == str(seeded_profile.id)
    assert returned_donor["display_name"] == "Volunteer OPOS_SAVAR"
    assert returned_donor["area"] == "Savar"
    assert returned_donor["district"] == "Dhaka"


# ---------------------------------------------------------------------------
# 10. Clarification when Blood Group and Request are Missing
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_agentic_clarification_on_missing_blood_group(async_client: AsyncClient):
    res = await async_client.post(
        "/api/v1/reports/ai-assistant/donor-coordination",
        json={"message": "Find donors for me", "lang": "en"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["intent"] == "CLARIFY_REQUEST"
    assert data["is_clarification_needed"] is True
    assert "specify the required blood group" in data["reply"]


# ---------------------------------------------------------------------------
# 11. State-Changing Action Confirmation Workflow
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_agentic_action_confirmation_workflow(
    async_client: AsyncClient,
    db_session: AsyncSession,
    seed_agentic_test_data,
):
    req = seed_agentic_test_data["request"]
    donor_user = seed_agentic_test_data["users"]["opos_savar"]
    token = create_access_token(subject=str(donor_user.id))
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Donor asks to volunteer
    res1 = await async_client.post(
        "/api/v1/reports/ai-assistant/donor-coordination",
        json={
            "message": "I can help with this blood request",
            "request_id": str(req.id),
            "lang": "en",
        },
        headers=headers,
    )
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["action_preview"] is not None
    assert data1["action_preview"]["requires_confirmation"] is True
    conf_token = data1["action_preview"]["confirmation_token"]

    # Verify no database mutation happened during the chat turn
    stmt_before = select(BloodRequestResponse).where(
        BloodRequestResponse.request_id == req.id,
        BloodRequestResponse.donor_user_id == donor_user.id,
    )
    assert (await db_session.execute(stmt_before)).scalar_one_or_none() is None

    # 2. Donor submits explicit confirmation
    res2 = await async_client.post(
        "/api/v1/reports/ai-assistant/donor-coordination/confirm",
        json={
            "conversation_id": data1["conversation_id"],
            "confirmation_token": conf_token,
            "action_type": "EXPRESS_INTEREST",
            "request_id": str(req.id),
            "message": "Ready to arrive at Enam Hospital",
            "contact_phone": "01700000001",
        },
        headers=headers,
    )
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["status"] == "SUCCESS"

    # 3. Duplicate confirmation attempt returns ALREADY_PROCESSED
    res3 = await async_client.post(
        "/api/v1/reports/ai-assistant/donor-coordination/confirm",
        json={
            "conversation_id": data1["conversation_id"],
            "confirmation_token": conf_token,
            "action_type": "EXPRESS_INTEREST",
            "request_id": str(req.id),
        },
        headers=headers,
    )
    assert res3.status_code == 200
    assert res3.json()["status"] == "ALREADY_PROCESSED"
