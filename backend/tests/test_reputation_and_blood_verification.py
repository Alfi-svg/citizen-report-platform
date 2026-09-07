import uuid
from datetime import datetime, timezone, timedelta
import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, get_password_hash
from app.models.user import User, UserRole
from app.models.report import Report, ReportStatus
from app.models.category import Category
from app.models.missing_person import (
    MissingPersonProfile,
    MissingPersonAlert,
    MissingPersonSighting,
    AlertStatus,
    SightingStatus,
)
from app.models.blood import (
    BloodGroup,
    BloodUrgency,
    BloodRequestStatus,
    DonationStatus,
    BloodRequest,
    BloodDonationRecord,
)
from app.models.reputation import (
    UserReputation,
    ImpactPointTransaction,
    TrustScoreHistory,
)
from app.services.reputation import (
    get_or_create_user_reputation,
    award_impact_points,
    adjust_trust_score,
)


@pytest_asyncio.fixture
async def regular_user(db_session: AsyncSession) -> User:
    user = User(
        email="citizen_user@example.com",
        username="citizen_user",
        full_name="Citizen Hasan",
        hashed_password=get_password_hash("password123"),
        role=UserRole.USER,
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def second_user(db_session: AsyncSession) -> User:
    user = User(
        email="second_user@example.com",
        username="second_user",
        full_name="Second Citizen",
        hashed_password=get_password_hash("password123"),
        role=UserRole.USER,
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def admin_user(db_session: AsyncSession) -> User:
    user = User(
        email="admin_user@example.com",
        username="admin_user",
        full_name="Admin Officer",
        hashed_password=get_password_hash("password123"),
        role=UserRole.ADMIN,
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def sample_category(db_session: AsyncSession) -> Category:
    category = Category(
        name="Road Safety",
        slug="road-safety",
        description="Traffic and road incidents",
    )
    db_session.add(category)
    await db_session.commit()
    await db_session.refresh(category)
    return category


@pytest.mark.asyncio
async def test_user_reputation_initial_defaults(
    async_client: AsyncClient,
    regular_user: User,
):
    """
    Ensure a new user starts with 50 Trust Score, 0 Impact Points, and New Contributor badge.
    """
    token = create_access_token(subject=str(regular_user.id))
    headers = {"Authorization": f"Bearer {token}"}

    response = await async_client.get("/api/v1/reputation/me", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["trust_score"] == 50
    assert data["trust_level"] == "Fair"
    assert "Fair reliability" in data["trust_description"]
    assert data["impact_points"] == 0
    assert data["badge"] == "New Contributor"
    assert data["help_rating"] == 0.0
    assert data["help_rating_count"] == 0
    assert data["verified_reports_count"] == 0
    assert data["verified_blood_donations_count"] == 0


@pytest.mark.asyncio
async def test_report_approval_and_rejection_reputation_impact(
    async_client: AsyncClient,
    db_session: AsyncSession,
    regular_user: User,
    admin_user: User,
    sample_category: Category,
):
    """
    Approving a report awards +10 impact points and +5 trust score.
    Rejecting a report docks -10 trust score.
    """
    admin_token = create_access_token(subject=str(admin_user.id))
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Create a pending report for regular_user
    report = Report(
        title="Pothole on Mirpur Road",
        description="Large dangerous pothole causing traffic jams",
        category_id=sample_category.id,
        user_id=regular_user.id,
        latitude=23.7808,
        longitude=90.4192,
        location_text="Mirpur-10 Circle, Dhaka",
        status=ReportStatus.SUBMITTED,
    )
    db_session.add(report)
    await db_session.commit()
    await db_session.refresh(report)

    # 2. Admin approves report
    approve_res = await async_client.post(
        f"/api/v1/admin/reports/{report.id}/approve",
        headers=admin_headers,
    )
    assert approve_res.status_code == 200

    # Verify reputation was updated
    user_token = create_access_token(subject=str(regular_user.id))
    user_headers = {"Authorization": f"Bearer {user_token}"}
    rep_res = await async_client.get("/api/v1/reputation/me", headers=user_headers)
    assert rep_res.status_code == 200
    rep_data = rep_res.json()
    assert rep_data["impact_points"] == 10
    assert rep_data["trust_score"] == 55
    assert rep_data["verified_reports_count"] == 1

    # 3. Create a second report and reject it
    bad_report = Report(
        title="Spam False Incident",
        description="Fabricated story to cause panic",
        category_id=sample_category.id,
        user_id=regular_user.id,
        latitude=23.7808,
        longitude=90.4192,
        location_text="Gulshan 1, Dhaka",
        status=ReportStatus.SUBMITTED,
    )
    db_session.add(bad_report)
    await db_session.commit()
    await db_session.refresh(bad_report)

    reject_res = await async_client.post(
        f"/api/v1/admin/reports/{bad_report.id}/reject",
        headers=admin_headers,
        json={"reason": "Spam or fabricated content"},
    )
    assert reject_res.status_code == 200

    # Verify trust score docked by 10 (55 - 10 = 45)
    rep_res2 = await async_client.get("/api/v1/reputation/me", headers=user_headers)
    assert rep_res2.status_code == 200
    assert rep_res2.json()["trust_score"] == 45


@pytest.mark.asyncio
async def test_blood_donation_verification_and_rating_workflow(
    async_client: AsyncClient,
    db_session: AsyncSession,
    regular_user: User,
    second_user: User,
):
    """
    Test the full blood donation verification cycle:
    1. Recipient creates blood request
    2. Donor claims 'I Donated Blood' (status PENDING_CONFIRMATION, points not yet awarded)
    3. Recipient confirms -> status VERIFIED, +50 points and +5 trust score awarded to donor
    4. Recipient rates donor (5 stars)
    5. Donor reputation updates with help rating and badge
    """
    donor = regular_user
    recipient = second_user

    donor_token = create_access_token(subject=str(donor.id))
    donor_headers = {"Authorization": f"Bearer {donor_token}"}
    recipient_token = create_access_token(subject=str(recipient.id))
    recipient_headers = {"Authorization": f"Bearer {recipient_token}"}

    # 1. Recipient creates blood request
    req_payload = {
        "blood_group": "A+",
        "units_required": 1,
        "hospital_name": "Dhaka Medical College Hospital",
        "hospital_area": "Bakshibazar",
        "district": "Dhaka",
        "required_date": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
        "required_time": "10:00 AM",
        "urgency": "URGENT",
        "contact_name": "Rahim",
        "contact_phone": "01811111111",
        "contact_method": "PHONE",
    }
    req_res = await async_client.post("/api/v1/blood/requests", json=req_payload, headers=recipient_headers)
    assert req_res.status_code == 201
    request_id = req_res.json()["id"]

    # 2. Recipient cannot claim own request as donor
    self_claim_res = await async_client.post(
        f"/api/v1/blood/requests/{request_id}/claim-donation",
        json={},
        headers=recipient_headers,
    )
    assert self_claim_res.status_code == 400

    # 3. Donor claims donation
    claim_res = await async_client.post(
        f"/api/v1/blood/requests/{request_id}/claim-donation",
        json={},
        headers=donor_headers,
    )
    assert claim_res.status_code == 201
    donation_data = claim_res.json()
    donation_id = donation_data["id"]
    assert donation_data["status"] == "PENDING_CONFIRMATION"
    assert donation_data["impact_points_awarded"] is False

    # Donor points should still be 0 before recipient confirmation
    donor_rep_res = await async_client.get("/api/v1/reputation/me", headers=donor_headers)
    assert donor_rep_res.json()["impact_points"] == 0
    assert donor_rep_res.json()["verified_blood_donations_count"] == 0

    # 4. Donor cannot confirm their own donation
    invalid_confirm_res = await async_client.post(
        f"/api/v1/blood/donations/{donation_id}/confirm",
        headers=donor_headers,
    )
    assert invalid_confirm_res.status_code == 403

    # 5. Recipient confirms donation
    confirm_res = await async_client.post(
        f"/api/v1/blood/donations/{donation_id}/confirm",
        headers=recipient_headers,
    )
    assert confirm_res.status_code == 200
    confirm_data = confirm_res.json()
    assert confirm_data["status"] == "VERIFIED"
    assert confirm_data["impact_points_awarded"] is True

    # 6. Check donor reputation: +50 points, +5 trust (50+5=55), Active Helper badge (50+ pts)
    donor_rep_res2 = await async_client.get("/api/v1/reputation/me", headers=donor_headers)
    rep2 = donor_rep_res2.json()
    assert rep2["impact_points"] == 50
    assert rep2["trust_score"] == 55
    assert rep2["badge"] == "Active Helper"
    assert rep2["verified_blood_donations_count"] == 1

    # 7. Recipient rates donor
    rate_res = await async_client.post(
        f"/api/v1/blood/donations/{donation_id}/rate",
        json={"rating": 5, "review": "Arrived promptly at DMCH, true lifesaver!"},
        headers=recipient_headers,
    )
    assert rate_res.status_code == 200
    rate_data = rate_res.json()
    assert rate_data["donor_rating"] == 5
    assert rate_data["donor_review"] == "Arrived promptly at DMCH, true lifesaver!"

    # 8. Rating cannot be submitted twice
    rate_again_res = await async_client.post(
        f"/api/v1/blood/donations/{donation_id}/rate",
        json={"rating": 4},
        headers=recipient_headers,
    )
    assert rate_again_res.status_code == 400

    # 9. Verify donor rating on public profile
    donor_pub_res = await async_client.get(f"/api/v1/reputation/users/{donor.id}")
    assert donor_pub_res.status_code == 200
    assert donor_pub_res.json()["help_rating"] == 5.0
    assert donor_pub_res.json()["help_rating_count"] == 1


@pytest.mark.asyncio
async def test_blood_donation_dispute_and_admin_moderation(
    async_client: AsyncClient,
    db_session: AsyncSession,
    regular_user: User,
    second_user: User,
    admin_user: User,
):
    """
    Test disputing a false blood donation claim and admin oversight:
    1. Donor claims donation
    2. Recipient disputes ("Donor never arrived at hospital")
    3. Status becomes DISPUTED, 0 points awarded
    4. Admin inspects list and rejects claim
    5. Donor trust score penalised for false claim
    """
    donor = regular_user
    recipient = second_user

    donor_token = create_access_token(subject=str(donor.id))
    donor_headers = {"Authorization": f"Bearer {donor_token}"}
    recipient_token = create_access_token(subject=str(recipient.id))
    recipient_headers = {"Authorization": f"Bearer {recipient_token}"}
    admin_token = create_access_token(subject=str(admin_user.id))
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Create request & claim donation
    req_payload = {
        "blood_group": "B+",
        "units_required": 1,
        "hospital_name": "Apollo Hospital Dhaka",
        "hospital_area": "Bashundhara",
        "district": "Dhaka",
        "required_date": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
        "required_time": "12:00 PM",
        "urgency": "NORMAL",
        "contact_name": "Karim",
        "contact_phone": "01722222222",
        "contact_method": "PHONE",
    }
    req_res = await async_client.post("/api/v1/blood/requests", json=req_payload, headers=recipient_headers)
    assert req_res.status_code == 201
    request_id = req_res.json()["id"]

    claim_res = await async_client.post(
        f"/api/v1/blood/requests/{request_id}/claim-donation",
        json={},
        headers=donor_headers,
    )
    assert claim_res.status_code == 201
    donation_id = claim_res.json()["id"]

    # 2. Recipient disputes claim
    dispute_res = await async_client.post(
        f"/api/v1/blood/donations/{donation_id}/dispute",
        json={"dispute_reason": "Donor never came to the hospital"},
        headers=recipient_headers,
    )
    assert dispute_res.status_code == 200
    assert dispute_res.json()["status"] == "DISPUTED"
    assert dispute_res.json()["dispute_reason"] == "Donor never came to the hospital"

    # 3. Admin lists disputed donations
    admin_list_res = await async_client.get(
        "/api/v1/admin/blood/donations?status_filter=DISPUTED",
        headers=admin_headers,
    )
    assert admin_list_res.status_code == 200
    donations_list = admin_list_res.json()["items"]
    assert any(d["id"] == donation_id for d in donations_list)

    # 4. Admin moderates with REJECT
    mod_res = await async_client.post(
        f"/api/v1/admin/blood/donations/{donation_id}/moderate",
        json={"action": "REJECT", "admin_notes": "Verified with hospital reception, donor did not attend"},
        headers=admin_headers,
    )
    assert mod_res.status_code == 200
    assert mod_res.json()["donation"]["status"] == "REJECTED"

    # 5. Check donor reputation docked by -10 trust score (50 - 10 = 40)
    rep_res = await async_client.get("/api/v1/reputation/me", headers=donor_headers)
    assert rep_res.json()["trust_score"] == 40
    assert rep_res.json()["impact_points"] == 0


@pytest.mark.asyncio
async def test_admin_manual_reputation_adjustment_and_audit(
    async_client: AsyncClient,
    regular_user: User,
    admin_user: User,
):
    """
    Test admin adjusting reputation manually with reason and verifying audit history.
    """
    admin_token = create_access_token(subject=str(admin_user.id))
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    user_token = create_access_token(subject=str(regular_user.id))
    user_headers = {"Authorization": f"Bearer {user_token}"}

    adjust_payload = {
        "user_id": str(regular_user.id),
        "points_delta": 250,
        "trust_score_delta": 15,
        "reason": "Outstanding flood rescue assistance recognition",
    }
    adjust_res = await async_client.post(
        "/api/v1/admin/reputation/adjust",
        json=adjust_payload,
        headers=admin_headers,
    )
    assert adjust_res.status_code == 200
    rep = adjust_res.json()["reputation"]
    assert rep["impact_points"] == 250
    assert rep["trust_score"] == 65
    assert rep["badge"] == "Trusted Contributor"

    # Check history endpoint contains transaction
    history_res = await async_client.get("/api/v1/reputation/history", headers=user_headers)
    assert history_res.status_code == 200
    h_data = history_res.json()
    assert len(h_data["transactions"]) > 0
    assert any("flood rescue" in t["description"] for t in h_data["transactions"])
    assert len(h_data["trust_history"]) > 0
    assert any("flood rescue" in s["reason"] for s in h_data["trust_history"])


@pytest.mark.asyncio
async def test_trust_score_bounds_clamping(
    db_session: AsyncSession,
    regular_user: User,
):
    """
    Ensure Trust Score is strictly clamped between 0 and 100.
    """
    # Over-increment past 100
    await adjust_trust_score(
        db=db_session,
        user_id=regular_user.id,
        delta=200,
        reason="Super massive increase",
    )
    rep = await get_or_create_user_reputation(db_session, regular_user.id)
    assert rep.trust_score == 100

    # Over-decrement below 0
    await adjust_trust_score(
        db=db_session,
        user_id=regular_user.id,
        delta=-300,
        reason="Super massive penalty",
    )
    rep2 = await get_or_create_user_reputation(db_session, regular_user.id)
    assert rep2.trust_score == 0
