import uuid
import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_password_hash, create_access_token
from app.models.category import Category
from app.models.moderation import ModerationAction
from app.models.report import Report, ReportStatus
from app.models.user import User, UserRole


@pytest_asyncio.fixture
async def admin_user(db_session: AsyncSession) -> User:
    user = User(
        email="moderator_lead@example.com",
        username="moderator_lead",
        hashed_password=get_password_hash("password123"),
        role=UserRole.ADMIN,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def regular_user(db_session: AsyncSession) -> User:
    user = User(
        email="citizen_tester@example.com",
        username="citizen_tester",
        hashed_password=get_password_hash("password123"),
        role=UserRole.USER,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def sample_category(db_session: AsyncSession) -> Category:
    cat = Category(
        name="Infrastructure",
        slug=f"infrastructure-{uuid.uuid4().hex[:6]}",
        description="Public infrastructure issues",
        is_active=True,
    )
    db_session.add(cat)
    await db_session.commit()
    await db_session.refresh(cat)
    return cat


@pytest.mark.asyncio
async def test_admin_rbac_protection(
    async_client: AsyncClient, admin_user: User, regular_user: User
):
    admin_token = create_access_token(subject=admin_user.id, role=admin_user.role.value)
    user_token = create_access_token(subject=regular_user.id, role=regular_user.role.value)

    # 1. Unauthenticated -> 401
    resp_unauth = await async_client.get("/api/v1/admin/dashboard")
    assert resp_unauth.status_code == 401

    # 2. Regular user -> 403 Forbidden
    resp_user = await async_client.get(
        "/api/v1/admin/dashboard",
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert resp_user.status_code == 403

    # 3. Admin user -> 200 OK
    resp_admin = await async_client.get(
        "/api/v1/admin/dashboard",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp_admin.status_code == 200


@pytest.mark.asyncio
async def test_admin_dashboard_metrics(
    async_client: AsyncClient,
    admin_user: User,
    regular_user: User,
    sample_category: Category,
    db_session: AsyncSession,
):
    # Seed reports with different statuses
    r_sub = Report(
        user_id=regular_user.id,
        category_id=sample_category.id,
        title="Pending submission report",
        description="Detailed description for pending report.",
        location_text="Dhaka",
        status=ReportStatus.SUBMITTED,
        is_anonymous=False,
    )
    r_rev = Report(
        user_id=regular_user.id,
        category_id=sample_category.id,
        title="Under review incident",
        description="Detailed description for under review report.",
        location_text="Chittagong",
        status=ReportStatus.UNDER_REVIEW,
        is_anonymous=True,
    )
    r_app = Report(
        user_id=regular_user.id,
        category_id=sample_category.id,
        title="Approved incident report",
        description="Detailed description for approved report.",
        location_text="Sylhet",
        status=ReportStatus.APPROVED,
        is_anonymous=True,
    )
    db_session.add_all([r_sub, r_rev, r_app])
    await db_session.commit()

    admin_token = create_access_token(subject=admin_user.id, role=admin_user.role.value)
    resp = await async_client.get(
        "/api/v1/admin/dashboard",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_reports"] >= 3
    assert data["pending_reports"] >= 1
    assert data["under_review_reports"] >= 1
    assert data["approved_reports"] >= 1
    assert data["anonymous_reports_count"] >= 2
    assert data["total_users"] >= 2


@pytest.mark.asyncio
async def test_admin_report_queue_filtering_and_pagination(
    async_client: AsyncClient,
    admin_user: User,
    regular_user: User,
    sample_category: Category,
    db_session: AsyncSession,
):
    # Create 5 reports
    for i in range(5):
        r = Report(
            user_id=regular_user.id,
            category_id=sample_category.id,
            title=f"Unique Filter Test Incident {i}",
            description="Detailed report description.",
            location_text=f"Location {i}",
            status=ReportStatus.SUBMITTED if i % 2 == 0 else ReportStatus.UNDER_REVIEW,
            is_anonymous=bool(i % 2 == 0),
        )
        db_session.add(r)
    await db_session.commit()

    admin_token = create_access_token(subject=admin_user.id, role=admin_user.role.value)
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Pagination: limit 2
    res_page = await async_client.get("/api/v1/admin/reports?limit=2&offset=0", headers=headers)
    assert res_page.status_code == 200
    page_data = res_page.json()
    assert len(page_data["items"]) == 2
    assert page_data["limit"] == 2
    assert page_data["total"] >= 5

    # 2. Status filter: SUBMITTED
    res_sub = await async_client.get("/api/v1/admin/reports?status=SUBMITTED", headers=headers)
    assert res_sub.status_code == 200
    assert all(item["status"] == "SUBMITTED" for item in res_sub.json()["items"])

    # 3. Search filter by title
    res_search = await async_client.get(
        "/api/v1/admin/reports?search=Unique%20Filter%20Test%20Incident%203",
        headers=headers,
    )
    assert res_search.status_code == 200
    assert len(res_search.json()["items"]) >= 1
    assert "Incident 3" in res_search.json()["items"][0]["title"]


@pytest.mark.asyncio
async def test_moderation_lifecycle_workflow(
    async_client: AsyncClient,
    admin_user: User,
    regular_user: User,
    sample_category: Category,
    db_session: AsyncSession,
):
    report = Report(
        user_id=regular_user.id,
        category_id=sample_category.id,
        title="Incident for full moderation lifecycle",
        description="Detailed description for moderation testing.",
        location_text="Gazipur",
        status=ReportStatus.SUBMITTED,
    )
    db_session.add(report)
    await db_session.commit()
    await db_session.refresh(report)

    admin_token = create_access_token(subject=admin_user.id, role=admin_user.role.value)
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Start review -> status = UNDER_REVIEW
    res_review = await async_client.post(
        f"/api/v1/admin/reports/{report.id}/review",
        json={"internal_notes": "Assigned to field verification team."},
        headers=headers,
    )
    assert res_review.status_code == 200
    assert res_review.json()["status"] == "UNDER_REVIEW"
    assert len(res_review.json()["moderation_records"]) == 1
    assert res_review.json()["moderation_records"][0]["action"] == "STARTED_REVIEW"
    assert res_review.json()["moderation_records"][0]["internal_notes"] == "Assigned to field verification team."

    # 2. Request More Information -> status = NEEDS_MORE_INFORMATION
    res_req_info = await async_client.post(
        f"/api/v1/admin/reports/{report.id}/request-information",
        json={
            "user_message": "Please attach specific street landmark near the intersection.",
            "internal_notes": "Awaiting reporter response.",
        },
        headers=headers,
    )
    assert res_req_info.status_code == 200
    assert res_req_info.json()["status"] == "NEEDS_MORE_INFORMATION"
    assert len(res_req_info.json()["moderation_records"]) == 2

    # 3. Approve Report -> status = APPROVED
    res_approve = await async_client.post(
        f"/api/v1/admin/reports/{report.id}/approve",
        json={
            "user_message": "Report verified and platform reviewed.",
            "internal_notes": "Verified against municipal notice.",
        },
        headers=headers,
    )
    assert res_approve.status_code == 200
    assert res_approve.json()["status"] == "APPROVED"
    assert len(res_approve.json()["moderation_records"]) == 3


@pytest.mark.asyncio
async def test_admin_reject_workflow(
    async_client: AsyncClient,
    admin_user: User,
    regular_user: User,
    sample_category: Category,
    db_session: AsyncSession,
):
    report = Report(
        user_id=regular_user.id,
        category_id=sample_category.id,
        title="Spam or Unverifiable Incident",
        description="Unsubstantiated text submitted.",
        location_text="Unknown",
        status=ReportStatus.SUBMITTED,
    )
    db_session.add(report)
    await db_session.commit()
    await db_session.refresh(report)

    admin_token = create_access_token(subject=admin_user.id, role=admin_user.role.value)
    headers = {"Authorization": f"Bearer {admin_token}"}

    res_reject = await async_client.post(
        f"/api/v1/admin/reports/{report.id}/reject",
        json={
            "user_message": "Report does not meet verification guidelines.",
            "internal_notes": "Spam pattern detected.",
        },
        headers=headers,
    )
    assert res_reject.status_code == 200
    assert res_reject.json()["status"] == "REJECTED"


@pytest.mark.asyncio
async def test_internal_notes_privacy_from_normal_users(
    async_client: AsyncClient,
    admin_user: User,
    regular_user: User,
    sample_category: Category,
    db_session: AsyncSession,
):
    # 1. Create and moderate report with sensitive internal notes
    report = Report(
        user_id=regular_user.id,
        category_id=sample_category.id,
        title="Privacy Verification Report",
        description="Testing internal notes shielding.",
        location_text="Comilla",
        status=ReportStatus.SUBMITTED,
    )
    db_session.add(report)
    await db_session.commit()
    await db_session.refresh(report)

    admin_token = create_access_token(subject=admin_user.id, role=admin_user.role.value)
    user_token = create_access_token(subject=regular_user.id, role=regular_user.role.value)

    # Admin requests information with both user message and secret internal notes
    await async_client.post(
        f"/api/v1/admin/reports/{report.id}/request-information",
        json={
            "user_message": "Please clarify your location.",
            "internal_notes": "TOP_SECRET_MODERATOR_INTERNAL_INVESTIGATION_NOTE_12345",
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    # 2. Normal user reads their own report via user endpoint
    user_resp = await async_client.get(
        f"/api/v1/reports/{report.id}",
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert user_resp.status_code == 200
    user_data = user_resp.json()

    # Verify user message is visible but internal note is NEVER present in user payload
    assert user_data["status"] == "NEEDS_MORE_INFORMATION"
    assert "moderation_records" in user_data
    assert len(user_data["moderation_records"]) >= 1
    assert user_data["moderation_records"][0]["user_message"] == "Please clarify your location."
    assert "internal_notes" not in user_data["moderation_records"][0]
    assert "TOP_SECRET_MODERATOR_INTERNAL_INVESTIGATION_NOTE_12345" not in str(user_data)


@pytest.mark.asyncio
async def test_admin_user_management_and_safeguards(
    async_client: AsyncClient,
    admin_user: User,
    regular_user: User,
    db_session: AsyncSession,
):
    admin_token = create_access_token(subject=admin_user.id, role=admin_user.role.value)
    user_token = create_access_token(subject=regular_user.id, role=regular_user.role.value)

    # 1. Normal user blocked from listing users
    res_block = await async_client.get(
        "/api/v1/admin/users",
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert res_block.status_code == 403

    # 2. Admin lists users with search & filters
    res_list = await async_client.get(
        "/api/v1/admin/users?search=citizen_tester",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res_list.status_code == 200
    data = res_list.json()
    assert data["total"] == 1
    assert data["items"][0]["username"] == "citizen_tester"

    # 3. Admin cannot change their own role (self-demotion protection)
    res_self = await async_client.patch(
        f"/api/v1/admin/users/{admin_user.id}/role",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"role": "USER"},
    )
    assert res_self.status_code == 400
    assert "cannot modify their own role" in res_self.json()["detail"]

    # 4. Admin promotes regular user to ADMIN
    res_promote = await async_client.patch(
        f"/api/v1/admin/users/{regular_user.id}/role",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"role": "ADMIN"},
    )
    assert res_promote.status_code == 200
    assert res_promote.json()["role"] == "ADMIN"

    # 5. Admin deactivates and reactivates user
    res_deact = await async_client.patch(
        f"/api/v1/admin/users/{regular_user.id}/status",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"is_active": False},
    )
    assert res_deact.status_code == 200
    assert res_deact.json()["is_active"] is False

    res_act = await async_client.patch(
        f"/api/v1/admin/users/{regular_user.id}/status",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"is_active": True},
    )
    assert res_act.status_code == 200
    assert res_act.json()["is_active"] is True


@pytest.mark.asyncio
async def test_admin_category_management_lifecycle(
    async_client: AsyncClient,
    admin_user: User,
    regular_user: User,
    sample_category: Category,
    db_session: AsyncSession,
):
    admin_token = create_access_token(subject=admin_user.id, role=admin_user.role.value)
    user_token = create_access_token(subject=regular_user.id, role=regular_user.role.value)

    # 1. Normal user cannot create category
    res_c_block = await async_client.post(
        "/api/v1/admin/categories",
        headers={"Authorization": f"Bearer {user_token}"},
        json={"name": "Illegal Logging", "slug": "illegal-logging"},
    )
    assert res_c_block.status_code == 403

    # 2. Admin creates category
    res_create = await async_client.post(
        "/api/v1/admin/categories",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "name": "Illegal Logging",
            "slug": f"illegal-logging-{uuid.uuid4().hex[:6]}",
            "description": "Deforestation and illegal timber harvesting.",
            "is_active": True,
        },
    )
    assert res_create.status_code == 201
    cat_id = res_create.json()["id"]

    # 3. Admin lists all categories
    res_list = await async_client.get(
        "/api/v1/admin/categories",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res_list.status_code == 200
    assert any(c["id"] == cat_id for c in res_list.json())

    # 4. Admin updates category
    res_update = await async_client.patch(
        f"/api/v1/admin/categories/{cat_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"name": "Forestry & Logging Violations"},
    )
    assert res_update.status_code == 200
    assert res_update.json()["name"] == "Forestry & Logging Violations"

    # 5. Delete category with 0 reports -> deleted cleanly
    res_del = await async_client.delete(
        f"/api/v1/admin/categories/{cat_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res_del.status_code == 200

    # 6. Delete category referenced by reports -> soft-deactivated safely
    report = Report(
        user_id=regular_user.id,
        category_id=sample_category.id,
        title="Active Report in Category",
        description="Testing safe soft deactivation.",
        location_text="Sylhet",
        status=ReportStatus.APPROVED,
    )
    db_session.add(report)
    await db_session.commit()

    res_soft_del = await async_client.delete(
        f"/api/v1/admin/categories/{sample_category.id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res_soft_del.status_code == 200
    assert "safely deactivated" in res_soft_del.json()["message"]

    # Verify category still exists in database but has is_active = False
    await db_session.refresh(sample_category)
    assert sample_category.is_active is False


@pytest.mark.asyncio
async def test_admin_report_archive_and_history(
    async_client: AsyncClient,
    admin_user: User,
    regular_user: User,
    sample_category: Category,
    db_session: AsyncSession,
):
    admin_token = create_access_token(subject=admin_user.id, role=admin_user.role.value)
    user_token = create_access_token(subject=regular_user.id, role=regular_user.role.value)

    report = Report(
        user_id=regular_user.id,
        category_id=sample_category.id,
        title="Resolved Bridge Defect",
        description="Bridge repairs completed.",
        location_text="Khulna",
        status=ReportStatus.APPROVED,
    )
    db_session.add(report)
    await db_session.commit()
    await db_session.refresh(report)

    # 1. Admin archives report
    res_arch = await async_client.post(
        f"/api/v1/admin/reports/{report.id}/archive",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"user_message": "Incident resolution verified on-site."},
    )
    assert res_arch.status_code == 200
    assert res_arch.json()["status"] == "ARCHIVED"

    # 2. Admin retrieves moderation history
    res_hist = await async_client.get(
        f"/api/v1/admin/reports/{report.id}/history",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res_hist.status_code == 200
    records = res_hist.json()
    assert len(records) >= 1
    assert records[0]["action"] == "ARCHIVED"
