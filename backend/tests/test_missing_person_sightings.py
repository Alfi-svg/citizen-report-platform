import pytest
import uuid
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User, UserRole
from app.models.category import Category
from app.models.report import Report, ReportStatus
from app.models.missing_person import (
    MissingPersonProfile,
    MissingPersonAlert,
    MissingPersonSighting,
    AlertStatus,
    SightingStatus,
)
from app.core.security import get_password_hash, create_access_token


@pytest.mark.asyncio
async def test_missing_person_sighting_lifecycle_and_privacy(
    async_client: AsyncClient,
    db_session: AsyncSession,
):
    # 1. Setup Admin and Normal User
    admin = User(
        email="sighting_admin@example.com",
        username="sighting_admin",
        hashed_password=get_password_hash("AdminPass123!"),
        role=UserRole.ADMIN,
        is_active=True,
    )
    user = User(
        email="sighter@example.com",
        username="sighter_citizen",
        hashed_password=get_password_hash("UserPass123!"),
        role=UserRole.USER,
        is_active=True,
    )
    db_session.add_all([admin, user])
    await db_session.flush()

    admin_token = create_access_token(subject=admin.id)
    user_token = create_access_token(subject=user.id)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    user_headers = {"Authorization": f"Bearer {user_token}"}

    # 2. Setup Category, Report, Profile, and Alert
    category = Category(name="Missing Person", slug="missing-person-sighting-test", is_active=True)
    db_session.add(category)
    await db_session.flush()

    report = Report(
        title="Missing Child in Mirpur",
        description="A 7-year-old child went missing near Mirpur 10 circle.",
        status=ReportStatus.APPROVED,
        category_id=category.id,
        user_id=user.id,
        latitude=23.806891,
        longitude=90.368722,
        location_text="Mirpur 10, Dhaka",
    )
    db_session.add(report)
    await db_session.flush()

    profile = MissingPersonProfile(
        report_id=report.id,
        full_name="Tanvir Ahmed",
        age=7,
        gender="Male",
        clothing="Blue t-shirt and white sneakers",
        last_seen_location="Mirpur 10 Circle, Dhaka",
        last_seen_latitude=23.806891,
        last_seen_longitude=90.368722,
    )
    db_session.add(profile)

    alert = MissingPersonAlert(
        report_id=report.id,
        status=AlertStatus.ALERT_ACTIVE,
        is_active=True,
        alert_radius_km=10.0,
    )
    db_session.add(alert)
    await db_session.commit()
    await db_session.refresh(alert)

    # 3. Submit Sighting 1 (Active alert)
    sighting_payload_1 = {
        "approximate_location": "Mirpur 2 Bus Stand",
        "latitude": 23.80412345,
        "longitude": 90.36298765,
        "sighting_time": "2:30 PM",
        "description": "Saw a young boy matching the description walking towards the tea stall.",
        "clothing": "Blue t-shirt",
        "direction": "Heading south towards Section 1",
        "additional_information": "He was holding a red water bottle.",
        "photo_url": "https://storage.example.com/sighting1.jpg",
    }

    res = await async_client.post(
        f"/api/v1/missing-person/alerts/{alert.id}/sightings",
        json=sighting_payload_1,
        headers=user_headers,
    )
    assert res.status_code == 201
    s1_data = res.json()
    assert s1_data["status"] == "PENDING"
    assert s1_data["approximate_location"] == "Mirpur 2 Bus Stand"
    assert s1_data["clothing"] == "Blue t-shirt"
    sighting_1_id = s1_data["id"]

    # 4. Public alert view must NOT show pending sightings
    res_pub = await async_client.get(f"/api/v1/missing-person/alerts/{alert.id}")
    assert res_pub.status_code == 200
    assert len(res_pub.json()["approved_sightings"]) == 0

    # 5. Public sightings endpoint must NOT show pending sightings
    res_sightings = await async_client.get(f"/api/v1/missing-person/alerts/{alert.id}/sightings")
    assert res_sightings.status_code == 200
    assert len(res_sightings.json()) == 0

    # 6. Admin lists sightings and sees duplicate analysis
    res_admin_list = await async_client.get(
        "/api/v1/admin/missing-person/sightings",
        headers=admin_headers,
    )
    assert res_admin_list.status_code == 200
    admin_sightings = res_admin_list.json()
    assert any(s["id"] == sighting_1_id for s in admin_sightings)

    # 7. Non-admin cannot moderate sightings (RBAC check)
    res_unauth_mod = await async_client.post(
        f"/api/v1/admin/missing-person/sightings/{sighting_1_id}/moderate",
        json={"status": "APPROVED", "admin_notes": "Verified by community team"},
        headers=user_headers,
    )
    assert res_unauth_mod.status_code == 403

    # 8. Admin approves Sighting 1
    res_mod = await async_client.post(
        f"/api/v1/admin/missing-person/sightings/{sighting_1_id}/moderate",
        json={"status": "APPROVED", "admin_notes": "Verified by community team"},
        headers=admin_headers,
    )
    assert res_mod.status_code == 200
    assert res_mod.json()["status"] == "APPROVED"

    # 9. Now public alert and public sightings endpoint show approved sighting
    res_pub_after = await async_client.get(f"/api/v1/missing-person/alerts/{alert.id}")
    assert res_pub_after.status_code == 200
    assert len(res_pub_after.json()["approved_sightings"]) == 1
    pub_s = res_pub_after.json()["approved_sightings"][0]
    assert pub_s["approximate_location"] == "Mirpur 2 Bus Stand"
    # Ensure sensitive fields are stripped
    assert "user_id" not in pub_s
    assert "admin_notes" not in pub_s

    # 10. Submit Sighting 2 (Duplicate Candidate with same location)
    sighting_payload_2 = {
        "approximate_location": "Mirpur 2 Bus Stand",
        "sighting_time": "3:00 PM",
        "description": "Saw a young boy matching the description walking near tea stall.",
    }
    res_dup = await async_client.post(
        f"/api/v1/missing-person/alerts/{alert.id}/sightings",
        json=sighting_payload_2,
        headers=user_headers,
    )
    assert res_dup.status_code == 201

    # Admin list should flag duplicate candidate
    res_admin_dup = await async_client.get(
        f"/api/v1/admin/missing-person/sightings?alert_id={alert.id}",
        headers=admin_headers,
    )
    assert res_admin_dup.status_code == 200
    dup_items = res_admin_dup.json()
    assert any(s["is_potential_duplicate"] is True for s in dup_items)

    # 11. Mark Alert as FOUND
    res_found = await async_client.post(
        f"/api/v1/admin/missing-person/alerts/{alert.id}/found",
        json={"found_notes": "Tanvir has been safely found and reunited with family."},
        headers=admin_headers,
    )
    assert res_found.status_code == 200
    assert res_found.json()["status"] == "FOUND"

    # 12. Submitting sightings on FOUND alert must be rejected with 400
    res_rejected = await async_client.post(
        f"/api/v1/missing-person/alerts/{alert.id}/sightings",
        json={"approximate_location": "Dhanmondi", "description": "Saw someone similar"},
        headers=user_headers,
    )
    assert res_rejected.status_code == 400
    assert "inactive or resolved" in res_rejected.json()["detail"].lower()
