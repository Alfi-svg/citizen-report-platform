import io
import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_password_hash
from app.models.category import Category
from app.models.user import User, UserRole


@pytest.mark.asyncio
async def test_full_system_end_to_end_journey(
    async_client: AsyncClient,
    db_session: AsyncSession,
):
    # --------------------------------------------------------------------------
    # 0. System Setup: Pre-seed Category and Admin
    # --------------------------------------------------------------------------
    cat = Category(
        name="Public Sanitation",
        slug=f"public-sanitation-{uuid.uuid4().hex[:6]}",
        description="Waste management and sanitation hazards",
        is_active=True,
    )
    admin = User(
        email="lead_admin_e2e@example.com",
        username="lead_admin_e2e",
        full_name="Lead System Administrator",
        hashed_password=get_password_hash("AdminPass123!"),
        role=UserRole.ADMIN,
    )
    db_session.add_all([cat, admin])
    await db_session.commit()
    await db_session.refresh(cat)
    await db_session.refresh(admin)

    # --------------------------------------------------------------------------
    # 1. Citizen Registration & Login
    # --------------------------------------------------------------------------
    reg_res = await async_client.post(
        "/api/v1/auth/register",
        json={
            "username": "citizen_whistleblower",
            "email": "citizen_whistleblower@example.com",
            "password": "SecurePassword123!",
            "full_name": "Rahim Whistleblower",
        },
    )
    assert reg_res.status_code == 201
    citizen_user_data = reg_res.json()
    assert citizen_user_data["role"] == "USER"

    login_res = await async_client.post(
        "/api/v1/auth/login",
        json={
            "email_or_username": "citizen_whistleblower@example.com",
            "password": "SecurePassword123!",
        },
    )
    assert login_res.status_code == 200
    citizen_token = login_res.json()["access_token"]
    citizen_headers = {"Authorization": f"Bearer {citizen_token}"}

    # --------------------------------------------------------------------------
    # 2. Citizen Creates Draft Report & Uploads Evidence
    # --------------------------------------------------------------------------
    create_rep_res = await async_client.post(
        "/api/v1/reports",
        headers=citizen_headers,
        json={
            "title": "Severe Toxic Effluent Leak in Hazaribagh Canal",
            "description": "Chemical runoffs overflowing into residential drainage system.",
            "category_id": str(cat.id),
            "location_text": "Hazaribagh Tannery Area, Dhaka",
            "is_anonymous": True,
            "status": "DRAFT",
        },
    )
    assert create_rep_res.status_code == 201
    report = create_rep_res.json()
    report_id = report["id"]
    assert report["status"] == "DRAFT"
    assert report["is_anonymous"] is True

    # Upload Evidence (Valid PNG file)
    png_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
    upload_res = await async_client.post(
        f"/api/v1/reports/{report_id}/media",
        headers=citizen_headers,
        files={"file": ("canal_effluent.png", io.BytesIO(png_bytes), "image/png")},
        data={"caption": "On-site canal chemical runoff"},
    )
    assert upload_res.status_code == 201
    media_item = upload_res.json()
    media_id = media_item["id"]

    # --------------------------------------------------------------------------
    # 3. Citizen Submits Report for Moderation
    # --------------------------------------------------------------------------
    submit_res = await async_client.post(
        f"/api/v1/reports/{report_id}/submit",
        headers=citizen_headers,
    )
    assert submit_res.status_code == 200
    assert submit_res.json()["status"] == "SUBMITTED"

    # Verify citizen received in-app notification
    notifs_res = await async_client.get(
        "/api/v1/notifications",
        headers=citizen_headers,
    )
    assert notifs_res.status_code == 200
    assert notifs_res.json()["total"] == 1
    assert notifs_res.json()["items"][0]["type"] == "REPORT_SUBMITTED"

    # --------------------------------------------------------------------------
    # 4. Strict Public APPROVED-Only Security Checks (While in SUBMITTED status)
    # --------------------------------------------------------------------------
    # Public Feed must NOT show this report
    feed_res = await async_client.get("/api/v1/public/reports")
    assert feed_res.status_code == 200
    feed_ids = [r["id"] for r in feed_res.json()["items"]]
    assert report_id not in feed_ids

    # Direct access to unapproved report must return 404
    direct_pub = await async_client.get(f"/api/v1/public/reports/{report_id}")
    assert direct_pub.status_code == 404

    # Public media streaming must return 404 for unapproved report
    media_pub = await async_client.get(f"/api/v1/public/reports/{report_id}/media/{media_id}")
    assert media_pub.status_code == 404

    # --------------------------------------------------------------------------
    # 5. Administrator Login & Moderation Review Lifecycle
    # --------------------------------------------------------------------------
    admin_login = await async_client.post(
        "/api/v1/auth/login",
        json={
            "email_or_username": "lead_admin_e2e@example.com",
            "password": "AdminPass123!",
        },
    )
    assert admin_login.status_code == 200
    admin_token = admin_login.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Admin inspects queue
    queue_res = await async_client.get(
        "/api/v1/admin/reports?report_status=SUBMITTED",
        headers=admin_headers,
    )
    assert queue_res.status_code == 200
    assert any(r["id"] == report_id for r in queue_res.json()["items"])

    # Admin moves to UNDER_REVIEW
    review_res = await async_client.post(
        f"/api/v1/admin/reports/{report_id}/review",
        headers=admin_headers,
        json={"internal_notes": "Assigned to environmental inspector."},
    )
    assert review_res.status_code == 200
    assert review_res.json()["status"] == "UNDER_REVIEW"

    # Admin approves report
    approve_res = await async_client.post(
        f"/api/v1/admin/reports/{report_id}/approve",
        headers=admin_headers,
        json={"user_message": "Report verified with Department of Environment."},
    )
    assert approve_res.status_code == 200
    assert approve_res.json()["status"] == "APPROVED"

    # --------------------------------------------------------------------------
    # 6. Public Release & Anonymous Privacy Verification
    # --------------------------------------------------------------------------
    pub_detail = await async_client.get(f"/api/v1/public/reports/{report_id}")
    assert pub_detail.status_code == 200
    pub_data = pub_detail.json()
    assert pub_data["title"] == "Severe Toxic Effluent Leak in Hazaribagh Canal"
    assert pub_data["is_anonymous"] is True
    assert pub_data["reporter_display_name"] == "Anonymous Citizen"
    # Ensure no email or user_id leaked in public payload
    assert "user_id" not in pub_data
    assert "email" not in pub_data
    assert "Rahim Whistleblower" not in str(pub_data)

    # Public media streams correctly
    pub_media_res = await async_client.get(f"/api/v1/public/reports/{report_id}/media/{media_id}")
    assert pub_media_res.status_code == 200
    assert pub_media_res.headers["content-type"] == "image/png"

    # --------------------------------------------------------------------------
    # 7. Community Interaction: Reactions, Comments, and Flags
    # --------------------------------------------------------------------------
    # Register 2nd citizen
    await async_client.post(
        "/api/v1/auth/register",
        json={
            "username": "local_resident_salma",
            "email": "salma_resident@example.com",
            "password": "SecurePassword123!",
            "full_name": "Salma Begum",
        },
    )
    salma_login = await async_client.post(
        "/api/v1/auth/login",
        json={
            "email_or_username": "salma_resident@example.com",
            "password": "SecurePassword123!",
        },
    )
    salma_headers = {"Authorization": f"Bearer {salma_login.json()['access_token']}"}

    # Salma reacts with SUPPORT
    react_res = await async_client.post(
        f"/api/v1/reports/{report_id}/reactions",
        headers=salma_headers,
        json={"reaction_type": "SUPPORT"},
    )
    assert react_res.status_code == 200
    assert react_res.json()["action"] == "added"
    assert react_res.json()["summary"]["support_count"] == 1

    # Salma posts comment
    comm_res = await async_client.post(
        f"/api/v1/reports/{report_id}/comments",
        headers=salma_headers,
        json={"body": "Can confirm this issue. WASA inspection team visited Road 3."},
    )
    assert comm_res.status_code == 201
    comment_id = comm_res.json()["id"]

    # Salma flags report as duplicate (to test safety flag)
    flag_res = await async_client.post(
        f"/api/v1/reports/{report_id}/flags",
        headers=salma_headers,
        json={"reason": "OTHER", "details": "Inspection already underway."},
    )
    assert flag_res.status_code == 201
    flag_id = flag_res.json()["id"]

    # --------------------------------------------------------------------------
    # 8. Admin Reviews Flag & Closes Safety Loop
    # --------------------------------------------------------------------------
    flag_review_res = await async_client.patch(
        f"/api/v1/admin/flags/{flag_id}",
        headers=admin_headers,
        json={"status": "REVIEWED", "admin_notes": "Inspection noted."},
    )
    assert flag_review_res.status_code == 200
    assert flag_review_res.json()["status"] == "REVIEWED"

    # Salma checks notifications -> received FLAG_REVIEWED
    salma_notifs = await async_client.get(
        "/api/v1/notifications",
        headers=salma_headers,
    )
    assert salma_notifs.status_code == 200
    salma_notif_types = [n["type"] for n in salma_notifs.json()["items"]]
    assert "FLAG_REVIEWED" in salma_notif_types

    # --------------------------------------------------------------------------
    # 9. Original Reporter Reads All In-App Notifications
    # --------------------------------------------------------------------------
    orig_notifs = await async_client.get(
        "/api/v1/notifications",
        headers=citizen_headers,
    )
    assert orig_notifs.status_code == 200
    # Expected: REPORT_SUBMITTED, REPORT_UNDER_REVIEW, REPORT_APPROVED
    assert orig_notifs.json()["total"] == 3

    # Mark all read
    mark_all = await async_client.patch(
        "/api/v1/notifications/read-all",
        headers=citizen_headers,
    )
    assert mark_all.status_code == 200

    unread_cnt = await async_client.get(
        "/api/v1/notifications/unread-count",
        headers=citizen_headers,
    )
    assert unread_cnt.json()["unread_count"] == 0
