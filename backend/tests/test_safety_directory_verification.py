import pytest
import uuid
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.security import create_access_token, get_password_hash
from app.models.user import User, UserRole
from app.models.emergency_service import EmergencyService, ServiceType, VerificationStatus, SafetyServiceVerificationAudit


@pytest.fixture
async def admin_and_citizen(db_session: AsyncSession):
    admin = User(
        email=f"admin_sd_{uuid.uuid4().hex[:6]}@example.com",
        username=f"admin_sd_{uuid.uuid4().hex[:6]}",
        hashed_password=get_password_hash("AdminPass123!"),
        role=UserRole.ADMIN,
        is_active=True,
    )
    citizen = User(
        email=f"citizen_sd_{uuid.uuid4().hex[:6]}@example.com",
        username=f"citizen_sd_{uuid.uuid4().hex[:6]}",
        hashed_password=get_password_hash("CitizenPass123!"),
        role=UserRole.USER,
        is_active=True,
    )
    db_session.add_all([admin, citizen])
    await db_session.commit()
    await db_session.refresh(admin)
    await db_session.refresh(citizen)

    admin_token = create_access_token(subject=admin.id, role=UserRole.ADMIN.value)
    citizen_token = create_access_token(subject=citizen.id, role=UserRole.USER.value)
    return {
        "admin": admin,
        "citizen": citizen,
        "admin_headers": {"Authorization": f"Bearer {admin_token}"},
        "citizen_headers": {"Authorization": f"Bearer {citizen_token}"},
    }


@pytest.mark.asyncio
async def test_service_creation_and_phone_validation(async_client: AsyncClient, admin_and_citizen: dict):
    headers = admin_and_citizen["admin_headers"]

    # 1. Valid BD Mobile Number
    payload_mobile = {
        "name": "Dhanmondi Sector Unit",
        "service_type": "POLICE_BOX",
        "district": "Dhaka",
        "area": "Dhanmondi",
        "address": "Road 8A, Dhanmondi, Dhaka",
        "phone": "+8801711223344",
        "latitude": 23.7461,
        "longitude": 90.3742,
    }
    r1 = await async_client.post("/api/v1/admin/safety/services", json=payload_mobile, headers=headers)
    assert r1.status_code == 201
    assert r1.json()["verification_status"] == "UNVERIFIED"

    # 2. Valid 3-digit Emergency Hotline
    payload_hotline = {
        "name": "Central Fire Emergency Hotline",
        "service_type": "FIRE_SERVICE",
        "district": "Dhaka",
        "area": "Fulbaria",
        "address": "Kazi Alauddin Road, Dhaka",
        "phone": "999",
        "latitude": 23.7226,
        "longitude": 90.4082,
    }
    r2 = await async_client.post("/api/v1/admin/safety/services", json=payload_hotline, headers=headers)
    assert r2.status_code == 201

    # 3. Invalid phone format rejected
    payload_invalid_phone = {
        "name": "Invalid Phone Unit",
        "service_type": "OTHER",
        "district": "Dhaka",
        "area": "Mirpur",
        "address": "Section 10, Mirpur, Dhaka",
        "phone": "12345abcdef",
        "latitude": 23.8055,
        "longitude": 90.3639,
    }
    r3 = await async_client.post("/api/v1/admin/safety/services", json=payload_invalid_phone, headers=headers)
    assert r3.status_code == 422


@pytest.mark.asyncio
async def test_location_validation(async_client: AsyncClient, admin_and_citizen: dict):
    headers = admin_and_citizen["admin_headers"]

    # 1. Invalid coordinates outside Bangladesh
    payload_out_of_bounds = {
        "name": "London Outpost",
        "service_type": "OTHER",
        "district": "Dhaka",
        "area": "Gulshan",
        "address": "Gulshan Avenue, Dhaka",
        "phone": "01711000000",
        "latitude": 51.5074,  # Outside Bangladesh
        "longitude": -0.1278,
    }
    r_bad = await async_client.post("/api/v1/admin/safety/services", json=payload_out_of_bounds, headers=headers)
    assert r_bad.status_code == 422

    # 2. Missing/None coordinates allowed (e.g. hotline or service without exact verified GPS)
    payload_no_coords = {
        "name": "National Cyber Help Desk",
        "service_type": "EMERGENCY_SERVICE",
        "district": "Dhaka",
        "area": "Agargaon",
        "address": "Bhaban 2, ICT Division, Agargaon, Dhaka",
        "phone": "02223388990",
        "latitude": None,
        "longitude": None,
    }
    r_ok = await async_client.post("/api/v1/admin/safety/services", json=payload_no_coords, headers=headers)
    assert r_ok.status_code == 201
    assert r_ok.json()["latitude"] is None


@pytest.mark.asyncio
async def test_verification_lifecycle_and_audit_trail(async_client: AsyncClient, admin_and_citizen: dict):
    headers = admin_and_citizen["admin_headers"]

    # 1. Create UNVERIFIED service
    create_payload = {
        "name": "Mohakhali Wireless Police Box",
        "name_bn": "মহাখালী ওয়ারলেস পুলিশ বক্স",
        "service_type": "POLICE_BOX",
        "division": "Dhaka",
        "district": "Dhaka",
        "area": "Mohakhali",
        "address": "Wireless Gate, Mohakhali, Dhaka",
        "phone": "01320040000",
        "latitude": 23.7778,
        "longitude": 90.4055,
        "source": "Unverified Community Submission",
    }
    r_create = await async_client.post("/api/v1/admin/safety/services", json=create_payload, headers=headers)
    assert r_create.status_code == 201
    svc = r_create.json()
    svc_id = svc["id"]
    assert svc["verification_status"] == "UNVERIFIED"

    # 2. Admin Verifies Service
    verify_payload = {
        "source": "Dhaka Metropolitan Police Official Portal",
        "source_url": "https://dmp.gov.bd",
        "verification_notes": "Cross-referenced with DMP 2026 directory roster",
    }
    r_verify = await async_client.post(f"/api/v1/admin/safety/services/{svc_id}/verify", json=verify_payload, headers=headers)
    assert r_verify.status_code == 200
    v_svc = r_verify.json()
    assert v_svc["verification_status"] == "VERIFIED"
    assert v_svc["last_verified_at"] is not None
    assert v_svc["verified_by_admin_id"] is not None

    # 3. Check History / Audit Trail
    r_hist1 = await async_client.get(f"/api/v1/admin/safety/services/{svc_id}/history", headers=headers)
    assert r_hist1.status_code == 200
    audits = r_hist1.json()
    assert len(audits) >= 2  # creation + verify
    latest_audit = audits[0]
    assert latest_audit["new_status"] == "VERIFIED"
    assert "Cross-referenced with DMP" in latest_audit["verification_notes"]
    assert latest_audit["source_url"] == "https://dmp.gov.bd"

    # 4. Mark Needs Review
    review_payload = {"verification_notes": "Phone number was reported disconnected by a citizen"}
    r_review = await async_client.post(f"/api/v1/admin/safety/services/{svc_id}/needs-review", json=review_payload, headers=headers)
    assert r_review.status_code == 200
    assert r_review.json()["verification_status"] == "NEEDS_REVIEW"

    # 5. Mark Outdated
    r_outdated = await async_client.post(f"/api/v1/admin/safety/services/{svc_id}/mark-outdated", headers=headers)
    assert r_outdated.status_code == 200
    assert r_outdated.json()["verification_status"] == "OUTDATED"

    # 6. Deactivate
    r_deact = await async_client.post(f"/api/v1/admin/safety/services/{svc_id}/deactivate", headers=headers)
    assert r_deact.status_code == 200
    assert r_deact.json()["is_active"] is False
    assert r_deact.json()["verification_status"] == "INACTIVE"

    # 7. Reactivate
    r_react = await async_client.post(f"/api/v1/admin/safety/services/{svc_id}/reactivate", headers=headers)
    assert r_react.status_code == 200
    assert r_react.json()["is_active"] is True
    assert r_react.json()["verification_status"] == "PENDING_VERIFICATION"


@pytest.mark.asyncio
async def test_public_visibility_and_internal_shielding(async_client: AsyncClient, admin_and_citizen: dict):
    headers = admin_and_citizen["admin_headers"]

    # Create one verified service and one inactive service
    r_v = await async_client.post(
        "/api/v1/admin/safety/services",
        json={
            "name": "Public Verified Station",
            "service_type": "POLICE_STATION",
            "district": "Dhaka",
            "area": "Dhanmondi",
            "address": "Road 5, Dhanmondi, Dhaka",
            "phone": "01711111111",
            "latitude": 23.7400,
            "longitude": 90.3700,
            "verification_status": "VERIFIED",
        },
        headers=headers,
    )
    v_id = r_v.json()["id"]

    r_inact = await async_client.post(
        "/api/v1/admin/safety/services",
        json={
            "name": "Deactivated Station",
            "service_type": "POLICE_STATION",
            "district": "Dhaka",
            "area": "Dhanmondi",
            "address": "Road 6, Dhanmondi, Dhaka",
            "phone": "01722222222",
            "latitude": 23.7410,
            "longitude": 90.3710,
            "is_active": False,
        },
        headers=headers,
    )
    inact_id = r_inact.json()["id"]

    # Public Nearby Search
    r_nearby = await async_client.get("/api/v1/safety/services/nearby?latitude=23.7400&longitude=90.3700&radius_km=5.0")
    assert r_nearby.status_code == 200
    nearby_data = r_nearby.json()
    returned_ids = [s["id"] for s in nearby_data["nearby_services"]]
    if nearby_data.get("nearest_police_station"):
        returned_ids.append(nearby_data["nearest_police_station"]["id"])

    assert v_id in returned_ids
    assert inact_id not in returned_ids

    # Verify internal admin notes and verifier admin ID are NOT present in public response
    for s in nearby_data["nearby_services"]:
        assert "verification_notes_internal" not in s
        assert "verified_by_admin_id" not in s


@pytest.mark.asyncio
async def test_duplicate_detection(async_client: AsyncClient, admin_and_citizen: dict):
    headers = admin_and_citizen["admin_headers"]

    # Create two services with identical phone
    shared_phone = "01819998877"
    await async_client.post(
        "/api/v1/admin/safety/services",
        json={
            "name": "Duplicate Unit Alpha",
            "service_type": "POLICE_BOX",
            "district": "Dhaka",
            "area": "Tejgaon",
            "address": "Tejgaon Station Road, Dhaka",
            "phone": shared_phone,
            "latitude": 23.7590,
            "longitude": 90.3910,
        },
        headers=headers,
    )
    await async_client.post(
        "/api/v1/admin/safety/services",
        json={
            "name": "Duplicate Unit Beta",
            "service_type": "POLICE_BOX",
            "district": "Dhaka",
            "area": "Tejgaon",
            "address": "Tejgaon Station Road, Dhaka",
            "phone": shared_phone,
            "latitude": 23.7595,
            "longitude": 90.3915,
        },
        headers=headers,
    )

    r_dup = await async_client.get("/api/v1/admin/safety/services/duplicates", headers=headers)
    assert r_dup.status_code == 200
    duplicates = r_dup.json()
    assert any("Matching phone number" in d["reason"] for d in duplicates)


@pytest.mark.asyncio
async def test_bulk_action_safety_services(async_client: AsyncClient, admin_and_citizen: dict):
    headers = admin_and_citizen["admin_headers"]

    # Create 2 services
    r1 = await async_client.post(
        "/api/v1/admin/safety/services",
        json={
            "name": "Bulk Unit 1",
            "service_type": "OTHER",
            "district": "Dhaka",
            "area": "Badda",
            "address": "Middle Badda, Dhaka",
            "phone": "01911111111",
        },
        headers=headers,
    )
    r2 = await async_client.post(
        "/api/v1/admin/safety/services",
        json={
            "name": "Bulk Unit 2",
            "service_type": "OTHER",
            "district": "Dhaka",
            "area": "Badda",
            "address": "South Badda, Dhaka",
            "phone": "01922222222",
        },
        headers=headers,
    )
    id1 = r1.json()["id"]
    id2 = r2.json()["id"]

    # 1. Bulk NEEDS_REVIEW
    r_bulk = await async_client.post(
        "/api/v1/admin/safety/services/bulk-action",
        json={"service_ids": [id1, id2], "action": "NEEDS_REVIEW", "admin_notes": "Annual audit cycle"},
        headers=headers,
    )
    assert r_bulk.status_code == 200
    assert r_bulk.json()["updated_count"] == 2

    # 2. Bulk VERIFIED must be rejected
    r_bulk_bad = await async_client.post(
        "/api/v1/admin/safety/services/bulk-action",
        json={"service_ids": [id1, id2], "action": "VERIFIED"},
        headers=headers,
    )
    assert r_bulk_bad.status_code == 422


@pytest.mark.asyncio
async def test_security_and_rbac(async_client: AsyncClient, admin_and_citizen: dict):
    citizen_headers = admin_and_citizen["citizen_headers"]

    # 1. Citizen cannot access admin directory
    r_cit = await async_client.get("/api/v1/admin/safety/services", headers=citizen_headers)
    assert r_cit.status_code == 403

    # 2. Unauthenticated cannot access admin directory
    r_unauth = await async_client.get("/api/v1/admin/safety/services")
    assert r_unauth.status_code == 401
