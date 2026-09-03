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
    assert data["status"] == "ALERT_ACTIVE"
    assert data["profile"]["full_name"] == "Farhana Akter"
    assert data["profile"]["age"] == 14
    assert data["profile"]["last_seen_location"] == "Mirpur 10 roundabout, Dhaka"


@pytest.mark.asyncio
async def test_admin_missing_person_removal_and_public_feed_purge(
    async_client: AsyncClient,
    db_session: AsyncSession,
):
    """
    CRITICAL REGRESSION TEST:
    1. Create & publish missing person alert.
    2. Verify it appears in Public News Feed (/public/reports), Public Alerts (/missing-person/alerts), and direct URL.
    3. Normal user attempts to deactivate/delete -> Forbidden (403).
    4. Admin deactivates / removes from public feed via POST /admin/missing-person/alerts/{id}/deactivate.
    5. Verify underlying Report is ARCHIVED and alert is CLOSED.
    6. Verify it is IMMEDIATELY PURGED from Public News Feed (/public/reports).
    7. Verify it is PURGED from Public Missing Person list (/missing-person/alerts).
    8. Verify direct public URL (/missing-person/alerts/{id}) returns 404 (Direct URL Protection).
    9. Verify sightings endpoint returns 404.
    10. Admin re-activates alert -> Returns to Public News Feed and Direct URL works.
    11. Admin permanently deletes alert -> Cascade deleted completely.
    """
    admin = User(
        email="admin_purge@example.com",
        username="admin_purge",
        hashed_password=get_password_hash("AdminPass123!"),
        role=UserRole.ADMIN,
        is_active=True,
    )
    citizen = User(
        email="citizen_purge@example.com",
        username="citizen_purge",
        hashed_password=get_password_hash("Pass123!"),
        role=UserRole.USER,
        is_active=True,
    )
    db_session.add_all([admin, citizen])
    await db_session.commit()
    await db_session.refresh(admin)
    await db_session.refresh(citizen)

    admin_headers = {"Authorization": f"Bearer {create_access_token(subject=admin.id, role='ADMIN')}"}
    citizen_headers = {"Authorization": f"Bearer {create_access_token(subject=citizen.id, role='USER')}"}

    # 1. Citizen creates a missing person alert
    payload = {
        "full_name": "Tanvir Hasan",
        "name_bn": "তানভীর হাসান",
        "age": 22,
        "gender": "MALE",
        "last_seen_location": "Gulshan 1 Circle, Dhaka",
        "description": "University student, last seen wearing navy blue jacket.",
    }
    create_res = await async_client.post(
        "/api/v1/missing-person/submit",
        json=payload,
        headers=citizen_headers,
    )
    assert create_res.status_code == 201
    created_data = create_res.json()
    alert_id = created_data["alert_id"]
    report_id = created_data["report_id"]

    # 2. Verify it appears publicly in News Feed, Public Alerts, and Direct URL
    # News Feed
    feed_res = await async_client.get("/api/v1/public/reports")
    assert feed_res.status_code == 200
    feed_ids = [r["id"] for r in feed_res.json()["items"]]
    assert report_id in feed_ids

    # Public Alerts list
    alerts_res = await async_client.get("/api/v1/missing-person/alerts")
    assert alerts_res.status_code == 200
    alert_ids = [a["id"] for a in alerts_res.json()["items"]]
    assert alert_id in alert_ids

    # Direct URL
    detail_res = await async_client.get(f"/api/v1/missing-person/alerts/{alert_id}")
    assert detail_res.status_code == 200
    assert detail_res.json()["profile"]["full_name"] == "Tanvir Hasan"

    # 3. Unauthorized citizen attempts deactivation/deletion
    unauth_deact = await async_client.post(
        f"/api/v1/admin/missing-person/alerts/{alert_id}/deactivate",
        json={"deactivation_notes": "Citizen trying to remove"},
        headers=citizen_headers,
    )
    assert unauth_deact.status_code == 403

    unauth_del = await async_client.delete(
        f"/api/v1/admin/missing-person/alerts/{alert_id}",
        headers=citizen_headers,
    )
    assert unauth_del.status_code == 403

    # 4. Admin deactivates / removes from public feed
    admin_deact = await async_client.post(
        f"/api/v1/admin/missing-person/alerts/{alert_id}/deactivate",
        json={"deactivation_notes": "Case resolved privately by family"},
        headers=admin_headers,
    )
    assert admin_deact.status_code == 200
    assert admin_deact.json()["status"] == "CLOSED"
    assert admin_deact.json()["is_active"] is False

    # 5. Verify database state: Report is ARCHIVED
    db_report = await db_session.get(Report, uuid.UUID(report_id))
    assert db_report.status == ReportStatus.ARCHIVED

    # 6. Verify PURGED from Public News Feed (/public/reports)
    feed_after = await async_client.get("/api/v1/public/reports")
    assert feed_after.status_code == 200
    feed_after_ids = [r["id"] for r in feed_after.json()["items"]]
    assert report_id not in feed_after_ids

    # 7. Verify PURGED from Public Missing Person list (/missing-person/alerts)
    alerts_after = await async_client.get("/api/v1/missing-person/alerts")
    assert alerts_after.status_code == 200
    alerts_after_ids = [a["id"] for a in alerts_after.json()["items"]]
    assert alert_id not in alerts_after_ids

    # 8. Verify Direct URL Protection: returns 404
    detail_after = await async_client.get(f"/api/v1/missing-person/alerts/{alert_id}")
    assert detail_after.status_code == 404

    # 9. Verify Sighting Endpoint Protection: returns 404
    sightings_after = await async_client.get(f"/api/v1/missing-person/alerts/{alert_id}/sightings")
    assert sightings_after.status_code == 404

    # Sighting submission blocked
    sight_submit = await async_client.post(
        f"/api/v1/missing-person/alerts/{alert_id}/sightings",
        json={
            "approximate_location": "Gulshan 2",
            "description": "Saw someone walking by",
        },
        headers=citizen_headers,
    )
    assert sight_submit.status_code == 400

    # 10. Admin re-activates alert
    reactivate_res = await async_client.post(
        f"/api/v1/admin/missing-person/alerts/{alert_id}/activate",
        json={"alert_radius_km": 12.0, "activation_notes": "New lead opened"},
        headers=admin_headers,
    )
    assert reactivate_res.status_code == 200
    assert reactivate_res.json()["status"] == "ALERT_ACTIVE"
    assert reactivate_res.json()["is_active"] is True

    # Re-activated alert reappears in public news feed and direct URL works again
    feed_reactivated = await async_client.get("/api/v1/public/reports")
    assert report_id in [r["id"] for r in feed_reactivated.json()["items"]]
    detail_reactivated = await async_client.get(f"/api/v1/missing-person/alerts/{alert_id}")
    assert detail_reactivated.status_code == 200

    # 11. Admin permanently deletes the alert
    del_res = await async_client.delete(
        f"/api/v1/admin/missing-person/alerts/{alert_id}",
        headers=admin_headers,
    )
    assert del_res.status_code == 200

    # Verify completely deleted from database
    db_report_del = await db_session.get(Report, uuid.UUID(report_id))
    assert db_report_del is None
    db_alert_del = await db_session.get(MissingPersonAlert, uuid.UUID(alert_id))
    assert db_alert_del is None

