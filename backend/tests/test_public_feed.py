import uuid
import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_password_hash
from app.models.category import Category
from app.models.report import Report, ReportStatus
from app.models.report_media import ReportMedia
from app.models.user import User, UserRole
from app.services.storage import get_storage_service


@pytest_asyncio.fixture
async def sample_user(db_session: AsyncSession) -> User:
    user = User(
        email="feed_citizen@example.com",
        username="feed_citizen",
        full_name="Fatima Begum",
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
        name="Traffic & Roads",
        slug=f"traffic-roads-{uuid.uuid4().hex[:6]}",
        description="Public traffic infrastructure issues",
        is_active=True,
    )
    db_session.add(cat)
    await db_session.commit()
    await db_session.refresh(cat)
    return cat


@pytest.mark.asyncio
async def test_strict_approved_only_visibility_in_feed(
    async_client: AsyncClient,
    sample_user: User,
    sample_category: Category,
    db_session: AsyncSession,
):
    # Seed 1 report of every possible status
    statuses = [
        ReportStatus.DRAFT,
        ReportStatus.SUBMITTED,
        ReportStatus.UNDER_REVIEW,
        ReportStatus.NEEDS_MORE_INFORMATION,
        ReportStatus.REJECTED,
        ReportStatus.ARCHIVED,
        ReportStatus.APPROVED,
    ]

    created_reports = []
    for st in statuses:
        r = Report(
            user_id=sample_user.id,
            category_id=sample_category.id,
            title=f"Incident in {st.value} Status",
            description=f"Description for report with status {st.value}.",
            location_text="Dhaka North",
            status=st,
            is_anonymous=False,
        )
        db_session.add(r)
        created_reports.append(r)

    await db_session.commit()

    # Query public feed
    resp = await async_client.get("/api/v1/public/reports")
    assert resp.status_code == 200
    data = resp.json()

    # All returned items must strictly have status APPROVED (implicitly verified via response)
    # Furthermore, verify none of the unapproved titles exist in the public feed items
    returned_titles = [item["title"] for item in data["items"]]
    assert "Incident in APPROVED Status" in returned_titles
    assert "Incident in DRAFT Status" not in returned_titles
    assert "Incident in SUBMITTED Status" not in returned_titles
    assert "Incident in UNDER_REVIEW Status" not in returned_titles
    assert "Incident in NEEDS_MORE_INFORMATION Status" not in returned_titles
    assert "Incident in REJECTED Status" not in returned_titles
    assert "Incident in ARCHIVED Status" not in returned_titles


@pytest.mark.asyncio
async def test_direct_access_to_unapproved_reports_returns_404(
    async_client: AsyncClient,
    sample_user: User,
    sample_category: Category,
    db_session: AsyncSession,
):
    draft = Report(
        user_id=sample_user.id,
        category_id=sample_category.id,
        title="Secret Draft Report",
        description="Private draft content.",
        location_text="Sylhet",
        status=ReportStatus.DRAFT,
    )
    submitted = Report(
        user_id=sample_user.id,
        category_id=sample_category.id,
        title="Pending Moderation Report",
        description="Submitted content.",
        location_text="Khulna",
        status=ReportStatus.SUBMITTED,
    )
    approved = Report(
        user_id=sample_user.id,
        category_id=sample_category.id,
        title="Approved Public Report",
        description="Public verified content.",
        location_text="Rajshahi",
        status=ReportStatus.APPROVED,
    )
    db_session.add_all([draft, submitted, approved])
    await db_session.commit()

    # 1. Draft -> 404
    res_draft = await async_client.get(f"/api/v1/public/reports/{draft.id}")
    assert res_draft.status_code == 404

    # 2. Submitted -> 404
    res_sub = await async_client.get(f"/api/v1/public/reports/{submitted.id}")
    assert res_sub.status_code == 404

    # 3. Approved -> 200
    res_app = await async_client.get(f"/api/v1/public/reports/{approved.id}")
    assert res_app.status_code == 200
    assert res_app.json()["title"] == "Approved Public Report"
    assert res_app.json()["review_status"] == "Platform Reviewed"


@pytest.mark.asyncio
async def test_anonymous_reporter_privacy_in_public_endpoints(
    async_client: AsyncClient,
    sample_user: User,
    sample_category: Category,
    db_session: AsyncSession,
):
    anon_report = Report(
        user_id=sample_user.id,
        category_id=sample_category.id,
        title="Anonymous Whistleblower Incident",
        description="Sensitive report submitted anonymously.",
        location_text="Chittagong Port",
        status=ReportStatus.APPROVED,
        is_anonymous=True,
    )
    public_report = Report(
        user_id=sample_user.id,
        category_id=sample_category.id,
        title="Public Attribution Incident",
        description="Open report with citizen name.",
        location_text="Mirpur, Dhaka",
        status=ReportStatus.APPROVED,
        is_anonymous=False,
    )
    db_session.add_all([anon_report, public_report])
    await db_session.commit()

    # 1. Check anonymous report detail
    res_anon = await async_client.get(f"/api/v1/public/reports/{anon_report.id}")
    assert res_anon.status_code == 200
    anon_data = res_anon.json()
    assert anon_data["is_anonymous"] is True
    assert anon_data["reporter_display_name"] == "Anonymous Citizen"
    assert "feed_citizen" not in str(anon_data)
    assert "Fatima Begum" not in str(anon_data)
    assert "feed_citizen@example.com" not in str(anon_data)

    # 2. Check public attribution report
    res_pub = await async_client.get(f"/api/v1/public/reports/{public_report.id}")
    assert res_pub.status_code == 200
    pub_data = res_pub.json()
    assert pub_data["is_anonymous"] is False
    assert pub_data["reporter_display_name"] == "Fatima Begum"
    assert "feed_citizen@example.com" not in str(pub_data)


@pytest.mark.asyncio
async def test_public_feed_search_and_filters(
    async_client: AsyncClient,
    sample_user: User,
    sample_category: Category,
    db_session: AsyncSession,
):
    cat2 = Category(
        name="Sanitation",
        slug=f"sanitation-{uuid.uuid4().hex[:6]}",
        description="Public sanitation",
        is_active=True,
    )
    db_session.add(cat2)
    await db_session.commit()

    r1 = Report(
        user_id=sample_user.id,
        category_id=sample_category.id,
        title="Unpaved Road in Uttara Sector 4",
        description="Road full of potholes causing severe bottlenecks.",
        location_text="Uttara, Dhaka",
        status=ReportStatus.APPROVED,
    )
    r2 = Report(
        user_id=sample_user.id,
        category_id=cat2.id,
        title="Open Drainage Hazard in Barisal",
        description="Uncovered sewer near school zone.",
        location_text="Barisal City",
        status=ReportStatus.APPROVED,
    )
    db_session.add_all([r1, r2])
    await db_session.commit()

    # 1. Category filter
    res_cat = await async_client.get(f"/api/v1/public/reports?category_id={cat2.id}")
    assert res_cat.status_code == 200
    assert len(res_cat.json()["items"]) == 1
    assert "Barisal" in res_cat.json()["items"][0]["title"]

    # 2. Location filter
    res_loc = await async_client.get("/api/v1/public/reports?location=Uttara")
    assert res_loc.status_code == 200
    assert len(res_loc.json()["items"]) >= 1
    assert "Uttara" in res_loc.json()["items"][0]["location_text"]

    # 3. Keyword Search
    res_search = await async_client.get("/api/v1/public/reports?q=potholes")
    assert res_search.status_code == 200
    assert len(res_search.json()["items"]) >= 1
    assert "Uttara" in res_search.json()["items"][0]["title"]


@pytest.mark.asyncio
async def test_public_media_streaming_security(
    async_client: AsyncClient,
    sample_user: User,
    sample_category: Category,
    db_session: AsyncSession,
):
    storage = get_storage_service()
    png_content = b"\x89PNG\r\n\x1a\n" + b"PUBLIC_APPROVED_MEDIA_BYTES"

    # 1. Approved Report with Media
    approved_report = Report(
        user_id=sample_user.id,
        category_id=sample_category.id,
        title="Approved Report with Photo Evidence",
        description="Description with proof.",
        location_text="Gazipur",
        status=ReportStatus.APPROVED,
    )
    db_session.add(approved_report)
    await db_session.commit()
    await db_session.refresh(approved_report)

    media_path = f"reports/{approved_report.id}/evidence_photo.png"
    await storage.upload_file(png_content, media_path, "image/png")

    media_rec = ReportMedia(
        report_id=approved_report.id,
        file_name="evidence_photo.png",
        mime_type="image/png",
        file_size=len(png_content),
        storage_path=media_path,
    )
    db_session.add(media_rec)

    # 2. Unapproved Draft Report with Media
    draft_report = Report(
        user_id=sample_user.id,
        category_id=sample_category.id,
        title="Draft Report with Media",
        description="Private media attached.",
        location_text="Gazipur",
        status=ReportStatus.DRAFT,
    )
    db_session.add(draft_report)
    await db_session.commit()
    await db_session.refresh(draft_report)

    draft_media_path = f"reports/{draft_report.id}/draft_photo.png"
    await storage.upload_file(png_content, draft_media_path, "image/png")

    draft_media_rec = ReportMedia(
        report_id=draft_report.id,
        file_name="draft_photo.png",
        mime_type="image/png",
        file_size=len(png_content),
        storage_path=draft_media_path,
    )
    db_session.add(draft_media_rec)
    await db_session.commit()

    # Public stream on Approved report -> 200 OK
    res_app_media = await async_client.get(
        f"/api/v1/public/reports/{approved_report.id}/media/{media_rec.id}"
    )
    assert res_app_media.status_code == 200
    assert res_app_media.content == png_content

    # Public stream on Draft report -> 404 Not Found
    res_draft_media = await async_client.get(
        f"/api/v1/public/reports/{draft_report.id}/media/{draft_media_rec.id}"
    )
    assert res_draft_media.status_code == 404

    # Cleanup storage
    await storage.delete_file(media_path)
    await storage.delete_file(draft_media_path)
