import io
import uuid
import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.security import get_password_hash, create_access_token
from app.models.category import Category
from app.models.report import Report, ReportStatus
from app.models.report_media import ReportMedia
from app.models.user import User, UserRole
from app.services.storage import get_storage_service


@pytest_asyncio.fixture
async def regular_user(db_session: AsyncSession) -> User:
    user = User(
        email="evidence_user@example.com",
        username="evidence_user",
        hashed_password=get_password_hash("password123"),
        role=UserRole.USER,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def other_user(db_session: AsyncSession) -> User:
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
        email="storage_admin@example.com",
        username="storage_admin",
        hashed_password=get_password_hash("password123"),
        role=UserRole.ADMIN,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def sample_category(db_session: AsyncSession) -> Category:
    cat = Category(
        name="Pollution",
        slug=f"pollution-{uuid.uuid4().hex[:6]}",
        description="Environmental pollution reports",
        is_active=True,
    )
    db_session.add(cat)
    await db_session.commit()
    await db_session.refresh(cat)
    return cat


@pytest_asyncio.fixture
async def draft_report(
    db_session: AsyncSession, regular_user: User, sample_category: Category
) -> Report:
    report = Report(
        user_id=regular_user.id,
        category_id=sample_category.id,
        title="Chemical Waste in Buriganga River",
        description="Observed industrial effluent discharge near riverbank.",
        location_text="Sadarghat, Dhaka",
        status=ReportStatus.DRAFT,
    )
    db_session.add(report)
    await db_session.commit()
    await db_session.refresh(report)
    return report


@pytest.mark.asyncio
async def test_upload_valid_image(
    async_client: AsyncClient, regular_user: User, draft_report: Report, db_session: AsyncSession
):
    token = create_access_token(subject=regular_user.id, role=regular_user.role.value)
    # Valid PNG header signature
    png_content = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR" + b"A" * 100

    response = await async_client.post(
        f"/api/v1/reports/{draft_report.id}/media",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("evidence_photo.png", png_content, "image/png")},
        data={"caption": "River waste effluent"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["file_name"] == "evidence_photo.png"
    assert data["mime_type"] == "image/png"
    assert data["media_type"] == "image"
    assert data["caption"] == "River waste effluent"
    assert "download_url" in data

    # Verify storage contains file
    storage = get_storage_service()
    content = await storage.get_file_content(data["storage_path"])
    assert content == png_content

    # Clean up
    await storage.delete_file(data["storage_path"])


@pytest.mark.asyncio
async def test_upload_valid_document_pdf(
    async_client: AsyncClient, regular_user: User, draft_report: Report
):
    token = create_access_token(subject=regular_user.id, role=regular_user.role.value)
    # Valid PDF header
    pdf_content = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF"

    response = await async_client.post(
        f"/api/v1/reports/{draft_report.id}/media",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("lab_report.pdf", pdf_content, "application/pdf")},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["media_type"] == "document"
    assert data["file_name"] == "lab_report.pdf"

    storage = get_storage_service()
    await storage.delete_file(data["storage_path"])


@pytest.mark.asyncio
async def test_upload_executable_extension_rejected(
    async_client: AsyncClient, regular_user: User, draft_report: Report
):
    token = create_access_token(subject=regular_user.id, role=regular_user.role.value)
    bad_content = b"#!/bin/bash\necho 'hacked'"

    response = await async_client.post(
        f"/api/v1/reports/{draft_report.id}/media",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("malicious_script.sh", bad_content, "text/plain")},
    )
    assert response.status_code == 400
    assert "Security rejection" in response.json()["detail"]


@pytest.mark.asyncio
async def test_upload_invalid_magic_bytes_rejected(
    async_client: AsyncClient, regular_user: User, draft_report: Report
):
    token = create_access_token(subject=regular_user.id, role=regular_user.role.value)
    # File has .png extension but garbage header
    corrupt_content = b"NOT_A_REAL_PNG_HEADER_1234567890"

    response = await async_client.post(
        f"/api/v1/reports/{draft_report.id}/media",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("fake.png", corrupt_content, "image/png")},
    )
    assert response.status_code == 400
    assert "File header signature does not match" in response.json()["detail"]


@pytest.mark.asyncio
async def test_upload_unauthorized_user_fails(
    async_client: AsyncClient, other_user: User, draft_report: Report
):
    other_token = create_access_token(subject=other_user.id, role=other_user.role.value)
    png_content = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR" + b"A" * 50

    response = await async_client.post(
        f"/api/v1/reports/{draft_report.id}/media",
        headers={"Authorization": f"Bearer {other_token}"},
        files={"file": ("photo.png", png_content, "image/png")},
    )
    assert response.status_code == 403
    assert "do not have permission" in response.json()["detail"]


@pytest.mark.asyncio
async def test_upload_in_submitted_status_rejected_for_user(
    async_client: AsyncClient, regular_user: User, draft_report: Report, db_session: AsyncSession
):
    # Transition report to SUBMITTED
    draft_report.status = ReportStatus.SUBMITTED
    await db_session.commit()

    token = create_access_token(subject=regular_user.id, role=regular_user.role.value)
    png_content = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR" + b"A" * 50

    response = await async_client.post(
        f"/api/v1/reports/{draft_report.id}/media",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("photo.png", png_content, "image/png")},
    )
    assert response.status_code == 400
    assert "Cannot attach new evidence while report is in 'SUBMITTED' status" in response.json()["detail"]


@pytest.mark.asyncio
async def test_stream_and_delete_evidence_lifecycle(
    async_client: AsyncClient,
    regular_user: User,
    other_user: User,
    admin_user: User,
    draft_report: Report,
):
    user_token = create_access_token(subject=regular_user.id, role=regular_user.role.value)
    other_token = create_access_token(subject=other_user.id, role=other_user.role.value)
    admin_token = create_access_token(subject=admin_user.id, role=admin_user.role.value)

    png_content = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR" + b"STREAM_TEST_CONTENT"

    # 1. Upload
    up_res = await async_client.post(
        f"/api/v1/reports/{draft_report.id}/media",
        headers={"Authorization": f"Bearer {user_token}"},
        files={"file": ("stream_photo.png", png_content, "image/png")},
    )
    assert up_res.status_code == 201
    media_id = up_res.json()["id"]

    # 2. Unauthorized user cannot stream -> 403
    unauth_stream = await async_client.get(
        f"/api/v1/reports/{draft_report.id}/media/{media_id}",
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert unauth_stream.status_code == 403

    # 3. Owner can stream -> 200
    owner_stream = await async_client.get(
        f"/api/v1/reports/{draft_report.id}/media/{media_id}",
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert owner_stream.status_code == 200
    assert owner_stream.content == png_content

    # 4. Admin can stream -> 200
    admin_stream = await async_client.get(
        f"/api/v1/reports/{draft_report.id}/media/{media_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert admin_stream.status_code == 200
    assert admin_stream.content == png_content

    # 5. Delete media as owner -> 200
    del_res = await async_client.delete(
        f"/api/v1/reports/{draft_report.id}/media/{media_id}",
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert del_res.status_code == 200
    assert "deleted successfully" in del_res.json()["detail"]

    # 6. Stream after delete -> 404
    after_del_stream = await async_client.get(
        f"/api/v1/reports/{draft_report.id}/media/{media_id}",
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert after_del_stream.status_code == 404
