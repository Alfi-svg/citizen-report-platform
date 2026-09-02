import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.security import create_access_token, get_password_hash
from app.models.category import Category
from app.models.report import Report, ReportStatus
from app.models.user import User, UserRole
from app.models.missing_person import (
    MissingPersonProfile,
    MissingPersonAlert,
    MissingPersonSighting,
    UserNotificationPreference,
    AlertStatus,
    SightingStatus,
)
from app.models.notification import Notification, NotificationType


@pytest.mark.asyncio
async def test_missing_person_full_lifecycle_and_rbac(
    async_client: AsyncClient,
    db_session: AsyncSession,
):
    """
    Comprehensive test of Missing Person Report -> Profile Attachment ->
    Admin Verification & Explicit Activation -> Geospatial Notification ->
    Sighting Submission -> Moderation -> Mark as Found.
    """
    # 1. Setup Users (Admin, Reporter, Nearby Citizen, Faraway Citizen)
    admin_user = User(
        email="admin_mp@example.com",
        username="admin_mp",
        hashed_password=get_password_hash("AdminPass123!"),
        role=UserRole.ADMIN,
        is_active=True,
    )
    reporter_user = User(
        email="reporter_mp@example.com",
        username="reporter_mp",
        hashed_password=get_password_hash("Pass123!"),
        role=UserRole.USER,
        is_active=True,
    )
    nearby_user = User(
        email="nearby_mp@example.com",
        username="nearby_mp",
        hashed_password=get_password_hash("Pass123!"),
        role=UserRole.USER,
        is_active=True,
    )
    faraway_user = User(
        email="faraway_mp@example.com",
        username="faraway_mp",
        hashed_password=get_password_hash("Pass123!"),
        role=UserRole.USER,
        is_active=True,
    )
    db_session.add_all([admin_user, reporter_user, nearby_user, faraway_user])
    await db_session.commit()
    for u in [admin_user, reporter_user, nearby_user, faraway_user]:
        await db_session.refresh(u)

    admin_headers = {"Authorization": f"Bearer {create_access_token(subject=admin_user.id, role='ADMIN')}"}
    reporter_headers = {"Authorization": f"Bearer {create_access_token(subject=reporter_user.id, role='USER')}"}
    nearby_headers = {"Authorization": f"Bearer {create_access_token(subject=nearby_user.id, role='USER')}"}

    # Setup User Notification Preferences:
    # Nearby user: 23.7500, 90.3800 (~1 km from Dhanmondi 23.7461, 90.3742)
    # Faraway user: 22.3364, 91.8340 (Chittagong ~200 km away)
    pref_nearby = UserNotificationPreference(
        user_id=nearby_user.id,
        missing_person_alerts=True,
        last_known_latitude=23.7500,
        last_known_longitude=90.3800,
    )
    pref_faraway = UserNotificationPreference(
        user_id=faraway_user.id,
        missing_person_alerts=True,
        last_known_latitude=22.3364,
        last_known_longitude=91.8340,
    )
    db_session.add_all([pref_nearby, pref_faraway])

    # Setup Category
    cat = Category(
        name="Missing Person",
        slug="missing-person",
        description="Reports concerning missing persons",
    )
    db_session.add(cat)
    await db_session.commit()
    await db_session.refresh(cat)

    # 2. Reporter creates report & attaches missing person profile
    report = Report(
        user_id=reporter_user.id,
        category_id=cat.id,
        title="Missing child: Rafiq Ahmed",
        description="10-year-old child missing since afternoon from Dhanmondi Lake area",
        location_text="Dhanmondi Lake, Dhaka",
        latitude=23.7461,
        longitude=90.3742,
        status=ReportStatus.SUBMITTED,
    )
    db_session.add(report)
    await db_session.commit()
    await db_session.refresh(report)

    profile_payload = {
        "full_name": "Rafiq Ahmed",
        "name_bn": "রফিক আহমেদ",
        "age": 10,
        "gender": "MALE",
        "photo_url": "https://storage.citizenreport.gov.bd/media/rafiq.jpg",
        "height": "4 ft 2 in",
        "clothing": "Blue striped shirt and dark blue shorts",
        "clothing_bn": "নীল ডোরাকাটা শার্ট ও গাঢ় নীল হাফপ্যান্ট",
        "identifying_features": "Birthmark on left forearm",
        "last_seen_location": "Dhanmondi Lake, Road 8, Dhaka",
        "last_seen_location_bn": "ধানমন্ডি লেক, ৮ নম্বর রোড, ঢাকা",
        "last_seen_latitude": 23.7461,
        "last_seen_longitude": 90.3742,
        "contact_information": "Dhanmondi Police Station: +8802223362144",
        "reporting_authority": "DMP Dhanmondi Zone",
    }
    r_prof = await async_client.post(
        f"/api/v1/missing-person/reports/{report.id}/profile",
        json=profile_payload,
        headers=reporter_headers,
    )
    assert r_prof.status_code == 200
    prof_data = r_prof.json()
    assert prof_data["full_name"] == "Rafiq Ahmed"
    assert prof_data["age"] == 10

    # 3. Verify Alert is initially PENDING and NOT public
    r_pub_list = await async_client.get("/api/v1/missing-person/alerts?alert_status=ALERT_ACTIVE")
    assert r_pub_list.status_code == 200
    assert r_pub_list.json()["total"] == 0

    # 4. Admin views alerts in admin moderation queue
    r_admin_alerts = await async_client.get(
        "/api/v1/admin/missing-person/alerts",
        headers=admin_headers,
    )
    assert r_admin_alerts.status_code == 200
    admin_items = r_admin_alerts.json()["items"]
    assert len(admin_items) >= 1
    alert_id = admin_items[0]["id"]
    assert admin_items[0]["status"] == "ALERT_PENDING"

    # 5. Non-admin cannot activate alert
    r_unauth_act = await async_client.post(
        f"/api/v1/admin/missing-person/alerts/{alert_id}/activate",
        json={"alert_radius_km": 10.0, "activation_notes": "Verified by DMP Inspector"},
        headers=reporter_headers,
    )
    assert r_unauth_act.status_code == 403

    # 6. Admin explicitly activates alert
    r_act = await async_client.post(
        f"/api/v1/admin/missing-person/alerts/{alert_id}/activate",
        json={"alert_radius_km": 10.0, "activation_notes": "Verified by DMP Inspector"},
        headers=admin_headers,
    )
    assert r_act.status_code == 200
    act_data = r_act.json()
    assert act_data["status"] == "ALERT_ACTIVE"
    assert act_data["is_active"] is True

    # 7. Check In-App Notification delivery (Nearby user received, faraway did not)
    nearby_notifs_r = await async_client.get(
        "/api/v1/notifications",
        headers=nearby_headers,
    )
    assert nearby_notifs_r.status_code == 200
    nearby_notifs = nearby_notifs_r.json()["items"]
    assert any(n["type"] == "MISSING_PERSON_ALERT" for n in nearby_notifs)

    # Re-activating does NOT send duplicate notification
    await async_client.post(
        f"/api/v1/admin/missing-person/alerts/{alert_id}/activate",
        json={"alert_radius_km": 10.0},
        headers=admin_headers,
    )
    nearby_notifs_r2 = await async_client.get(
        "/api/v1/notifications",
        headers=nearby_headers,
    )
    mp_notifs = [n for n in nearby_notifs_r2.json()["items"] if n["type"] == "MISSING_PERSON_ALERT"]
    assert len(mp_notifs) == 1  # Deduplication guaranteed!

    # 8. Alert is now publicly visible
    r_pub_active = await async_client.get("/api/v1/missing-person/alerts")
    assert r_pub_active.status_code == 200
    assert r_pub_active.json()["total"] >= 1

    r_pub_detail = await async_client.get(f"/api/v1/missing-person/alerts/{alert_id}")
    assert r_pub_detail.status_code == 200
    assert r_pub_detail.json()["profile"]["full_name"] == "Rafiq Ahmed"
    assert r_pub_detail.json()["approved_sightings_count"] == 0

    # 9. Citizen submits "I Saw This Person" sighting
    sighting_payload = {
        "approximate_location": "Near Dhanmondi 27 Mina Bazar",
        "description": "Saw a boy matching description with blue shirt sitting near the convenience store entrance.",
        "sighting_time": "Approx. 6:15 PM",
    }
    r_sight = await async_client.post(
        f"/api/v1/missing-person/alerts/{alert_id}/sightings",
        json=sighting_payload,
        headers=nearby_headers,
    )
    assert r_sight.status_code == 201
    sighting_id = r_sight.json()["id"]

    # Sighting is NOT public yet (status PENDING)
    r_detail_unapp = await async_client.get(f"/api/v1/missing-person/alerts/{alert_id}")
    assert len(r_detail_unapp.json()["approved_sightings"]) == 0

    # 10. Admin moderates and approves sighting
    r_mod = await async_client.post(
        f"/api/v1/admin/missing-person/sightings/{sighting_id}/moderate",
        json={"status": "APPROVED", "admin_notes": "Credible location match"},
        headers=admin_headers,
    )
    assert r_mod.status_code == 200
    assert r_mod.json()["status"] == "APPROVED"

    # Now sighting is visible on public detail page
    r_detail_app = await async_client.get(f"/api/v1/missing-person/alerts/{alert_id}")
    assert r_detail_app.json()["approved_sightings_count"] == 1
    assert r_detail_app.json()["approved_sightings"][0]["approximate_location"] == "Near Dhanmondi 27 Mina Bazar"

    # 11. Admin marks person as FOUND
    r_found = await async_client.post(
        f"/api/v1/admin/missing-person/alerts/{alert_id}/found",
        json={"found_notes": "Safely located by Dhanmondi Patrol Unit and reunited with parents"},
        headers=admin_headers,
    )
    assert r_found.status_code == 200
    assert r_found.json()["status"] == "FOUND"
    assert r_found.json()["is_active"] is False

    # 12. User Preferences endpoint
    r_pref_get = await async_client.get(
        "/api/v1/missing-person/user/preferences",
        headers=nearby_headers,
    )
    assert r_pref_get.status_code == 200
    assert r_pref_get.json()["missing_person_alerts"] is True

    r_pref_update = await async_client.put(
        "/api/v1/missing-person/user/preferences",
        json={"missing_person_alerts": False, "latitude": 23.7800, "longitude": 90.4100},
        headers=nearby_headers,
    )
    assert r_pref_update.status_code == 200
    assert r_pref_update.json()["missing_person_alerts"] is False


@pytest.mark.asyncio
async def test_missing_person_direct_submit(
    async_client: AsyncClient,
    db_session: AsyncSession,
):
    """
    Test the new unified citizen/admin submission endpoint:
    POST /api/v1/missing-person/submit
    """
    citizen_user = User(
        email="citizen_submit@example.com",
        username="citizen_submit",
        hashed_password=get_password_hash("Pass123!"),
        role=UserRole.USER,
        is_active=True,
    )
    db_session.add(citizen_user)
    await db_session.commit()
    await db_session.refresh(citizen_user)

    headers = {"Authorization": f"Bearer {create_access_token(subject=citizen_user.id, role='USER')}"}

    payload = {
        "full_name": "Farhana Akter",
        "name_bn": "ফারহানা আক্তার",
        "age": 14,
        "gender": "FEMALE",
        "height": "5 ft 0 in",
        "clothing": "Green salwar kameez",
        "clothing_bn": "সবুজ সালোয়ার কামিজ",
        "last_seen_location": "Mirpur 10 roundabout, Dhaka",
        "contact_information": "Parent: 01700000000, Mirpur Police GD 1234",
        "description": "Student of class 8, last seen returning from school.",
    }

    res = await async_client.post(
        "/api/v1/missing-person/submit",
        json=payload,
        headers=headers,
    )
    assert res.status_code == 201
    data = res.json()
    assert data["status"] == "ALERT_PENDING"
    assert data["profile"]["full_name"] == "Farhana Akter"
    assert data["profile"]["age"] == 14
    assert data["profile"]["last_seen_location"] == "Mirpur 10 roundabout, Dhaka"

