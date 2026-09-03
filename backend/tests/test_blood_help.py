import uuid
from datetime import datetime, timezone, timedelta
import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, get_password_hash
from app.models.user import User, UserRole
from app.models.blood import (
    BloodGroup,
    BloodUrgency,
    BloodRequestStatus,
    DonorAvailability,
    ResponseStatus,
    BloodFlagStatus,
    BloodRequest,
    BloodDonorProfile,
    BloodRequestResponse,
    BloodRequestFlag,
)
from app.models.notification import Notification, NotificationType


@pytest_asyncio.fixture
async def requester_user(db_session: AsyncSession) -> User:
    user = User(
        email="blood_requester@example.com",
        username="blood_requester",
        full_name="Requester Hasan",
        hashed_password=get_password_hash("password123"),
        role=UserRole.USER,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def donor_user(db_session: AsyncSession) -> User:
    user = User(
        email="blood_donor@example.com",
        username="blood_donor",
        full_name="Donor Fahim",
        hashed_password=get_password_hash("password123"),
        role=UserRole.USER,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def admin_user(db_session: AsyncSession) -> User:
    user = User(
        email="blood_admin@example.com",
        username="blood_admin",
        full_name="Blood Admin",
        hashed_password=get_password_hash("password123"),
        role=UserRole.ADMIN,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.mark.asyncio
async def test_create_and_validate_blood_request(
    async_client: AsyncClient,
    requester_user: User,
):
    token = create_access_token(subject=str(requester_user.id))
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Successful request creation
    valid_payload = {
        "blood_group": "O+",
        "units_required": 2,
        "hospital_name": "Square Hospital",
        "hospital_area": "Panthapath, Dhanmondi",
        "district": "Dhaka",
        "required_date": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
        "required_time": "2:00 PM",
        "urgency": "EMERGENCY",
        "contact_name": "Family Member",
        "contact_phone": "01700000000",
        "contact_method": "PHONE",
        "additional_information": "Patient in ICU, emergency surgery scheduled",
    }
    response = await async_client.post("/api/v1/blood/requests", json=valid_payload, headers=headers)
    assert response.status_code == 201
    data = response.json()
    assert data["blood_group"] == "O+"
    assert data["units_required"] == 2
    assert data["urgency"] == "EMERGENCY"
    assert data["status"] == "OPEN"
    assert data["is_own_request"] is True
    assert data["contact_name"] == "Family Member"
    assert data["contact_phone"] == "01700000000"

    # 2. Invalid blood group validation
    invalid_group_payload = {**valid_payload, "blood_group": "XYZ"}
    res2 = await async_client.post("/api/v1/blood/requests", json=invalid_group_payload, headers=headers)
    assert res2.status_code == 422

    # 3. Required fields validation (missing hospital_name)
    missing_fields_payload = {**valid_payload, "hospital_name": ""}
    res3 = await async_client.post("/api/v1/blood/requests", json=missing_fields_payload, headers=headers)
    assert res3.status_code == 422

    # 4. Unauthenticated creation blocked
    res4 = await async_client.post("/api/v1/blood/requests", json=valid_payload)
    assert res4.status_code == 401


@pytest.mark.asyncio
async def test_view_and_filter_active_requests(
    async_client: AsyncClient,
    requester_user: User,
    donor_user: User,
):
    token = create_access_token(subject=str(requester_user.id))
    headers = {"Authorization": f"Bearer {token}"}

    # Create O+ and A- requests
    req_date = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    await async_client.post(
        "/api/v1/blood/requests",
        headers=headers,
        json={
            "blood_group": "O+",
            "units_required": 1,
            "hospital_name": "Dhaka Medical",
            "hospital_area": "Bakshibazar",
            "district": "Dhaka",
            "required_date": req_date,
            "urgency": "EMERGENCY",
        },
    )
    await async_client.post(
        "/api/v1/blood/requests",
        headers=headers,
        json={
            "blood_group": "A-",
            "units_required": 3,
            "hospital_name": "Chittagong Medical",
            "hospital_area": "Panchlaish",
            "district": "Chittagong",
            "required_date": req_date,
            "urgency": "NORMAL",
        },
    )

    # Public visitor listing (all active)
    res = await async_client.get("/api/v1/blood/requests")
    assert res.status_code == 200
    all_reqs = res.json()
    assert all_reqs["total"] >= 2

    # Privacy check for public visitor: contact_phone must be null
    sample = all_reqs["items"][0]
    assert sample["contact_phone"] is None
    assert sample["is_own_request"] is False

    # Filter by blood_group
    res_o = await async_client.get("/api/v1/blood/requests?blood_group=O+")
    assert res_o.status_code == 200
    assert all(r["blood_group"] == "O+" for r in res_o.json()["items"])

    # Filter by district
    res_ctg = await async_client.get("/api/v1/blood/requests?district=Chittagong")
    assert res_ctg.status_code == 200
    assert all(r["district"] == "Chittagong" for r in res_ctg.json()["items"])

    # Filter by urgency
    res_urg = await async_client.get("/api/v1/blood/requests?urgency=EMERGENCY")
    assert res_urg.status_code == 200
    assert all(r["urgency"] == "EMERGENCY" for r in res_urg.json()["items"])


@pytest.mark.asyncio
async def test_donor_profile_registration_and_update(
    async_client: AsyncClient,
    donor_user: User,
):
    token = create_access_token(subject=str(donor_user.id))
    headers = {"Authorization": f"Bearer {token}"}

    # Register donor profile
    reg_payload = {
        "blood_group": "O+",
        "district": "Dhaka",
        "area": "Mirpur",
        "availability_status": "AVAILABLE",
        "preferred_contact_method": "IN_APP",
        "contact_phone": "01800000000",
        "additional_notes": "Ready to donate on weekends",
    }
    res = await async_client.post("/api/v1/blood/donor-profile", json=reg_payload, headers=headers)
    assert res.status_code == 201
    profile = res.json()
    assert profile["blood_group"] == "O+"
    assert profile["availability_status"] == "AVAILABLE"
    assert profile["district"] == "Dhaka"

    # Get my donor profile
    res_get = await async_client.get("/api/v1/blood/donor-profile", headers=headers)
    assert res_get.status_code == 200
    assert res_get.json()["id"] == profile["id"]

    # Toggle availability to NOT_AVAILABLE
    patch_payload = {"availability_status": "NOT_AVAILABLE"}
    res_patch = await async_client.patch("/api/v1/blood/donor-profile", json=patch_payload, headers=headers)
    assert res_patch.status_code == 200
    assert res_patch.json()["availability_status"] == "NOT_AVAILABLE"


@pytest.mark.asyncio
async def test_matching_and_response_notification_flow(
    async_client: AsyncClient,
    requester_user: User,
    donor_user: User,
    db_session: AsyncSession,
):
    req_token = create_access_token(subject=str(requester_user.id))
    donor_token = create_access_token(subject=str(donor_user.id))

    # 1. Setup donor profile (O- in Dhaka, available) -> O- can donate to A+, B+, AB+, O+, etc.
    donor_headers = {"Authorization": f"Bearer {donor_token}"}
    await async_client.post(
        "/api/v1/blood/donor-profile",
        headers=donor_headers,
        json={
            "blood_group": "O-",
            "district": "Dhaka",
            "area": "Dhanmondi",
            "availability_status": "AVAILABLE",
        },
    )

    # 2. Requester creates an urgent request for A+ in Dhaka
    req_headers = {"Authorization": f"Bearer {req_token}"}
    req_res = await async_client.post(
        "/api/v1/blood/requests",
        headers=req_headers,
        json={
            "blood_group": "A+",
            "units_required": 1,
            "hospital_name": "United Hospital",
            "hospital_area": "Gulshan",
            "district": "Dhaka",
            "required_date": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
            "urgency": "EMERGENCY",
            "contact_name": "Patient Guardian",
            "contact_phone": "01711223344",
        },
    )
    assert req_res.status_code == 201
    request_id = req_res.json()["id"]

    # 3. Verify notification created for compatible donor in Dhaka
    stmt = select(Notification).where(
        Notification.user_id == donor_user.id,
        Notification.type == NotificationType.BLOOD_REQUEST_MATCH,
    )
    donor_notif = (await db_session.execute(stmt)).scalar_one_or_none()
    assert donor_notif is not None
    assert "Community Blood Needed" in donor_notif.title

    # 4. Donor checks /matches
    matches_res = await async_client.get("/api/v1/blood/matches", headers=donor_headers)
    assert matches_res.status_code == 200
    matching_ids = [m["id"] for m in matches_res.json()]
    assert request_id in matching_ids

    # 5. Donor responds ("I Can Help")
    respond_res = await async_client.post(
        f"/api/v1/blood/requests/{request_id}/respond",
        headers=donor_headers,
        json={
            "message": "I am O- universal donor, I can reach United Hospital in 1 hour.",
            "contact_phone": "01999887766",
        },
    )
    assert respond_res.status_code == 201
    assert respond_res.json()["status"] == "PENDING"
    assert respond_res.json()["donor_display_name"] == donor_user.full_name

    # 6. Verify notification dispatched to requester
    req_notif_stmt = select(Notification).where(
        Notification.user_id == requester_user.id,
        Notification.type == NotificationType.BLOOD_REQUEST_RESPONSE,
    )
    req_notif = (await db_session.execute(req_notif_stmt)).scalar_one_or_none()
    assert req_notif is not None
    assert "Donor Responded" in req_notif.title

    # 7. Requester views responses
    responses_list = await async_client.get(f"/api/v1/blood/requests/{request_id}/responses", headers=req_headers)
    assert responses_list.status_code == 200
    items = responses_list.json()
    assert len(items) == 1
    assert items[0]["contact_phone"] == "01999887766"

    # 8. Requester marks request FULFILLED
    patch_res = await async_client.patch(
        f"/api/v1/blood/requests/{request_id}",
        headers=req_headers,
        json={"status": "FULFILLED"},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["status"] == "FULFILLED"

    # 9. Verify responding donor receives fulfillment notification
    ful_stmt = select(Notification).where(
        Notification.user_id == donor_user.id,
        Notification.type == NotificationType.BLOOD_REQUEST_FULFILLED,
    )
    ful_notif = (await db_session.execute(ful_stmt)).scalar_one_or_none()
    assert ful_notif is not None


@pytest.mark.asyncio
async def test_security_idor_and_moderation(
    async_client: AsyncClient,
    requester_user: User,
    donor_user: User,
    admin_user: User,
):
    req_token = create_access_token(subject=str(requester_user.id))
    donor_token = create_access_token(subject=str(donor_user.id))
    admin_token = create_access_token(subject=str(admin_user.id))

    req_headers = {"Authorization": f"Bearer {req_token}"}
    donor_headers = {"Authorization": f"Bearer {donor_token}"}
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Requester creates a request
    req_res = await async_client.post(
        "/api/v1/blood/requests",
        headers=req_headers,
        json={
            "blood_group": "B+",
            "units_required": 1,
            "hospital_name": "Labaid Hospital",
            "hospital_area": "Dhanmondi",
            "district": "Dhaka",
            "required_date": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
        },
    )
    request_id = req_res.json()["id"]

    # IDOR check: another user cannot patch/edit requester's request
    idor_res = await async_client.patch(
        f"/api/v1/blood/requests/{request_id}",
        headers=donor_headers,
        json={"hospital_name": "Hacked Hospital"},
    )
    assert idor_res.status_code == 403

    # IDOR check: another user cannot view private responses
    idor_resp_res = await async_client.get(
        f"/api/v1/blood/requests/{request_id}/responses",
        headers=donor_headers,
    )
    assert idor_resp_res.status_code == 403

    # Flag request
    flag_res = await async_client.post(
        f"/api/v1/blood/requests/{request_id}/flag",
        headers=donor_headers,
        json={
            "reason": "Commercial selling / spam",
            "details": "Asking for money instead of community donation",
        },
    )
    assert flag_res.status_code == 201

    # Admin moderation: list requests & flags
    admin_flags = await async_client.get("/api/v1/admin/blood/flags", headers=admin_headers)
    assert admin_flags.status_code == 200
    flag_items = admin_flags.json()["items"]
    assert any(f["request_id"] == request_id for f in flag_items)
    flag_id = [f["id"] for f in flag_items if f["request_id"] == request_id][0]

    # Admin resolves flag and deactivates abusive request
    resolve_res = await async_client.post(
        f"/api/v1/admin/blood/flags/{flag_id}/resolve",
        headers=admin_headers,
        json={"action": "RESOLVE", "deactivate_request": True},
    )
    assert resolve_res.status_code == 200

    # Verify request is now inactive / cancelled
    get_res = await async_client.get(f"/api/v1/blood/requests/{request_id}")
    assert get_res.status_code == 404  # Inactive requests return 404
