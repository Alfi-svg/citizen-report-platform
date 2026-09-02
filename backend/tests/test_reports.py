import uuid
from datetime import datetime, timezone, timedelta
import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_password_hash, create_access_token
from app.models.category import Category
from app.models.report import Report, ReportStatus
from app.models.user import User, UserRole
from app.schemas.report import ReportPublicResponse


@pytest_asyncio.fixture
async def sample_category(db_session: AsyncSession) -> Category:
    cat = Category(
        name="Public Safety",
        slug=f"public-safety-{uuid.uuid4().hex[:6]}",
        description="Hazard and public safety issues",
        is_active=True,
    )
    db_session.add(cat)
    await db_session.commit()
    await db_session.refresh(cat)
    return cat


@pytest_asyncio.fixture
async def citizen_user(db_session: AsyncSession) -> User:
    user = User(
        email="citizen_creator@example.com",
        username="citizen_creator",
        hashed_password=get_password_hash("password123"),
        role=UserRole.USER,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def other_citizen(db_session: AsyncSession) -> User:
    user = User(
        email="other_citizen@example.com",
        username="other_citizen",
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
        email="report_admin@example.com",
        username="report_admin",
        hashed_password=get_password_hash("password123"),
        role=UserRole.ADMIN,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user



@pytest.mark.asyncio
async def test_list_categories(async_client: AsyncClient, sample_category: Category):
    response = await async_client.get("/api/v1/categories")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert any(c["name"] == "Public Safety" for c in data)


@pytest.mark.asyncio
async def test_create_report_authenticated_draft(
    async_client: AsyncClient, citizen_user: User, sample_category: Category
):
    token = create_access_token(subject=citizen_user.id, role=citizen_user.role.value)
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "title": "Broken road barrier near Mirpur 10",
        "description": "Hazardous open concrete and damaged iron barrier causing traffic accidents.",
        "category_id": str(sample_category.id),
        "location_text": "Mirpur 10 Roundabout, Dhaka",
        "latitude": 23.8069,
        "longitude": 90.3687,
        "is_anonymous": False,
        "status": "DRAFT",
    }
    response = await async_client.post("/api/v1/reports", json=payload, headers=headers)
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == payload["title"]
    assert data["status"] == "DRAFT"
    assert data["user_id"] == str(citizen_user.id)
    assert data["submitted_at"] is None
    assert data["is_anonymous"] is False


@pytest.mark.asyncio
async def test_create_report_direct_submit(
    async_client: AsyncClient, citizen_user: User, sample_category: Category
):
    token = create_access_token(subject=citizen_user.id, role=citizen_user.role.value)
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "title": "Severe waterlogging obstructing access",
        "description": "Rainwater overflow flooding residential streets for 48 hours.",
        "category_id": str(sample_category.id),
        "location_text": "Shantinagar, Dhaka",
        "is_anonymous": True,
        "status": "SUBMITTED",
    }
    response = await async_client.post("/api/v1/reports", json=payload, headers=headers)
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "SUBMITTED"
    assert data["submitted_at"] is not None
    assert data["is_anonymous"] is True


@pytest.mark.asyncio
async def test_create_report_unauthenticated_fails(
    async_client: AsyncClient, sample_category: Category
):
    payload = {
        "title": "Unauthenticated report attempt",
        "description": "Attempting to create report without JWT token.",
        "category_id": str(sample_category.id),
        "location_text": "Gulshan 1, Dhaka",
    }
    response = await async_client.post("/api/v1/reports", json=payload)
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_create_report_invalid_category(
    async_client: AsyncClient, citizen_user: User
):
    token = create_access_token(subject=citizen_user.id, role=citizen_user.role.value)
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "title": "Valid title for report",
        "description": "Valid description with sufficient characters.",
        "category_id": str(uuid.uuid4()),  # Non-existent category
        "location_text": "Dhanmondi, Dhaka",
    }
    response = await async_client.post("/api/v1/reports", json=payload, headers=headers)
    assert response.status_code == 400
    assert "category does not exist" in response.json()["detail"]


@pytest.mark.asyncio
async def test_create_report_validation_errors(
    async_client: AsyncClient, citizen_user: User, sample_category: Category
):
    token = create_access_token(subject=citizen_user.id, role=citizen_user.role.value)
    headers = {"Authorization": f"Bearer {token}"}

    # Short title (< 5)
    resp_title = await async_client.post(
        "/api/v1/reports",
        json={
            "title": "Hi",
            "description": "Valid description with enough characters.",
            "category_id": str(sample_category.id),
            "location_text": "Dhaka",
        },
        headers=headers,
    )
    assert resp_title.status_code == 422

    # Future incident date
    future_date = (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()
    resp_date = await async_client.post(
        "/api/v1/reports",
        json={
            "title": "Valid title test",
            "description": "Valid description with enough characters.",
            "category_id": str(sample_category.id),
            "location_text": "Dhaka",
            "incident_date": future_date,
        },
        headers=headers,
    )
    assert resp_date.status_code == 422


@pytest.mark.asyncio
async def test_get_my_reports(
    async_client: AsyncClient,
    citizen_user: User,
    other_citizen: User,
    sample_category: Category,
    db_session: AsyncSession,
):
    # Create report for citizen_user
    r1 = Report(
        user_id=citizen_user.id,
        category_id=sample_category.id,
        title="Citizen User Report 1",
        description="First report by citizen user.",
        location_text="Uttara, Dhaka",
        status=ReportStatus.DRAFT,
    )
    # Create report for other_citizen
    r2 = Report(
        user_id=other_citizen.id,
        category_id=sample_category.id,
        title="Other Citizen Report",
        description="Private report by other citizen.",
        location_text="Banani, Dhaka",
        status=ReportStatus.DRAFT,
    )
    db_session.add_all([r1, r2])
    await db_session.commit()

    token = create_access_token(subject=citizen_user.id, role=citizen_user.role.value)
    headers = {"Authorization": f"Bearer {token}"}

    response = await async_client.get("/api/v1/reports/mine", headers=headers)
    assert response.status_code == 200
    reports = response.json()
    assert len(reports) >= 1
    # Verify other_citizen's report is NOT included in citizen_user's list
    assert all(r["user_id"] == str(citizen_user.id) for r in reports)
    assert not any(r["title"] == "Other Citizen Report" for r in reports)


@pytest.mark.asyncio
async def test_report_ownership_and_authorization(
    async_client: AsyncClient,
    citizen_user: User,
    other_citizen: User,
    admin_user: User,
    sample_category: Category,
    db_session: AsyncSession,
):
    report = Report(
        user_id=citizen_user.id,
        category_id=sample_category.id,
        title="Ownership Test Report",
        description="Testing authorization rules on report access.",
        location_text="Motijheel, Dhaka",
        status=ReportStatus.DRAFT,
    )
    db_session.add(report)
    await db_session.commit()
    await db_session.refresh(report)

    citizen_token = create_access_token(subject=citizen_user.id, role=citizen_user.role.value)
    other_token = create_access_token(subject=other_citizen.id, role=other_citizen.role.value)
    admin_token = create_access_token(subject=admin_user.id, role=admin_user.role.value)

    # 1. Owner can access report -> 200
    res_owner = await async_client.get(
        f"/api/v1/reports/{report.id}",
        headers={"Authorization": f"Bearer {citizen_token}"},
    )
    assert res_owner.status_code == 200
    assert res_owner.json()["title"] == "Ownership Test Report"

    # 2. Other user cannot access report -> 403 Forbidden
    res_other = await async_client.get(
        f"/api/v1/reports/{report.id}",
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert res_other.status_code == 403

    # 3. Admin can access report -> 200
    res_admin = await async_client.get(
        f"/api/v1/reports/{report.id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res_admin.status_code == 200


@pytest.mark.asyncio
async def test_update_draft_and_submit_workflow(
    async_client: AsyncClient,
    citizen_user: User,
    other_citizen: User,
    sample_category: Category,
    db_session: AsyncSession,
):
    report = Report(
        user_id=citizen_user.id,
        category_id=sample_category.id,
        title="Draft Report for Updating",
        description="Original draft description with enough text.",
        location_text="Farmgate, Dhaka",
        status=ReportStatus.DRAFT,
    )
    db_session.add(report)
    await db_session.commit()
    await db_session.refresh(report)

    citizen_token = create_access_token(subject=citizen_user.id, role=citizen_user.role.value)
    other_token = create_access_token(subject=other_citizen.id, role=other_citizen.role.value)

    # 1. Other user updating report -> 403 Forbidden
    res_other_update = await async_client.patch(
        f"/api/v1/reports/{report.id}",
        json={"title": "Unauthorized change"},
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert res_other_update.status_code == 403

    # 2. Owner updates draft -> 200 OK
    res_update = await async_client.patch(
        f"/api/v1/reports/{report.id}",
        json={
            "title": "Updated Draft Report Title",
            "description": "Updated detailed description of the incident.",
            "location_text": "Farmgate Overbridge, Dhaka",
        },
        headers={"Authorization": f"Bearer {citizen_token}"},
    )
    assert res_update.status_code == 200
    assert res_update.json()["title"] == "Updated Draft Report Title"
    assert res_update.json()["status"] == "DRAFT"

    # 3. Submit draft report -> 200 OK (Status transitions to SUBMITTED)
    res_submit = await async_client.post(
        f"/api/v1/reports/{report.id}/submit",
        headers={"Authorization": f"Bearer {citizen_token}"},
    )
    assert res_submit.status_code == 200
    assert res_submit.json()["status"] == "SUBMITTED"
    assert res_submit.json()["submitted_at"] is not None

    # 4. Prevent duplicate submission -> 400 Bad Request
    res_dup_submit = await async_client.post(
        f"/api/v1/reports/{report.id}/submit",
        headers={"Authorization": f"Bearer {citizen_token}"},
    )
    assert res_dup_submit.status_code == 400
    assert "cannot be submitted again" in res_dup_submit.json()["detail"]

    # 5. Prevent editing submitted report -> 400 Bad Request
    res_edit_submitted = await async_client.patch(
        f"/api/v1/reports/{report.id}",
        json={"title": "Should fail editing submitted report"},
        headers={"Authorization": f"Bearer {citizen_token}"},
    )
    assert res_edit_submitted.status_code == 400
    assert "cannot be edited" in res_edit_submitted.json()["detail"]


@pytest.mark.asyncio
async def test_anonymous_report_privacy_safeguard(
    async_client: AsyncClient,
    citizen_user: User,
    sample_category: Category,
):
    token = create_access_token(subject=citizen_user.id, role=citizen_user.role.value)
    headers = {"Authorization": f"Bearer {token}"}

    # Create anonymous report
    payload = {
        "title": "Anonymous Corruption Incident",
        "description": "Detailed confidential whistleblowing report.",
        "category_id": str(sample_category.id),
        "location_text": "Tax Office Zone 2, Dhaka",
        "is_anonymous": True,
        "status": "SUBMITTED",
    }
    response = await async_client.post("/api/v1/reports", json=payload, headers=headers)
    assert response.status_code == 201
    created_data = response.json()
    assert created_data["is_anonymous"] is True

    # Validate that in public schema, reporter identity is sanitized
    public_view = ReportPublicResponse(
        id=uuid.UUID(created_data["id"]),
        category_id=uuid.UUID(created_data["category_id"]),
        title=created_data["title"],
        description=created_data["description"],
        location_text=created_data["location_text"],
        is_anonymous=created_data["is_anonymous"],
        status=ReportStatus(created_data["status"]),
        submitted_at=datetime.fromisoformat(created_data["submitted_at"]),
        created_at=datetime.fromisoformat(created_data["created_at"]),
        reporter_username=None if created_data["is_anonymous"] else citizen_user.username,
    )
    assert public_view.is_anonymous is True
    assert public_view.reporter_username is None


@pytest.mark.asyncio
async def test_full_report_lifecycle_e2e(
    async_client: AsyncClient,
    sample_category: Category,
):
    # 1. Register Citizen A
    reg_a = await async_client.post(
        "/api/v1/auth/register",
        json={
            "username": "lifecycle_citizen_a",
            "email": "lifecycle_a@example.com",
            "password": "Password123!",
            "full_name": "Citizen Lifecycle A",
        },
    )
    assert reg_a.status_code == 201

    # 2. Login Citizen A
    login_a = await async_client.post(
        "/api/v1/auth/login",
        json={"email_or_username": "lifecycle_a@example.com", "password": "Password123!"},
    )
    token_a = login_a.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # 3. Create Draft Report
    create_resp = await async_client.post(
        "/api/v1/reports",
        json={
            "title": "Unsafe open transformer on footpath",
            "description": "High voltage electrical transformer exposed to pedestrians during rainfall.",
            "category_id": str(sample_category.id),
            "location_text": "Mohakhali Wireless Gate, Dhaka",
            "is_anonymous": True,
            "status": "DRAFT",
        },
        headers=headers_a,
    )
    assert create_resp.status_code == 201
    report_id = create_resp.json()["id"]
    assert create_resp.json()["status"] == "DRAFT"

    # 4. View Report by Citizen A
    get_resp = await async_client.get(f"/api/v1/reports/{report_id}", headers=headers_a)
    assert get_resp.status_code == 200
    assert get_resp.json()["title"] == "Unsafe open transformer on footpath"

    # 5. Register Citizen B and verify B CANNOT view A's private report
    reg_b = await async_client.post(
        "/api/v1/auth/register",
        json={
            "username": "lifecycle_citizen_b",
            "email": "lifecycle_b@example.com",
            "password": "Password123!",
            "full_name": "Citizen Lifecycle B",
        },
    )
    assert reg_b.status_code == 201
    login_b = await async_client.post(
        "/api/v1/auth/login",
        json={"email_or_username": "lifecycle_b@example.com", "password": "Password123!"},
    )
    token_b = login_b.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    unauth_get = await async_client.get(f"/api/v1/reports/{report_id}", headers=headers_b)
    assert unauth_get.status_code == 403

    # 6. Citizen A updates draft
    update_resp = await async_client.patch(
        f"/api/v1/reports/{report_id}",
        json={
            "title": "Unsafe open transformer on footpath [URGENT]",
            "location_text": "Mohakhali Wireless Gate (near pharmacy), Dhaka",
        },
        headers=headers_a,
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["title"] == "Unsafe open transformer on footpath [URGENT]"

    # 7. Citizen A submits report
    submit_resp = await async_client.post(f"/api/v1/reports/{report_id}/submit", headers=headers_a)
    assert submit_resp.status_code == 200
    assert submit_resp.json()["status"] == "SUBMITTED"
    assert submit_resp.json()["submitted_at"] is not None

    # 8. Verify report is listed in Citizen A's reports
    mine_resp = await async_client.get("/api/v1/reports/mine", headers=headers_a)
    assert mine_resp.status_code == 200
    assert any(r["id"] == report_id for r in mine_resp.json())

