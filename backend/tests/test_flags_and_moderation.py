import uuid
import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, get_password_hash
from app.models.category import Category
from app.models.comment import Comment, CommentStatus
from app.models.flag import ContentFlag, FlagTargetType, FlagStatus
from app.models.report import Report, ReportStatus
from app.models.user import User, UserRole


@pytest_asyncio.fixture
async def citizen_user(db_session: AsyncSession) -> User:
    user = User(
        email="citizen_flag@example.com",
        username="citizen_flag",
        full_name="Tareq Hasan",
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
        email="other_flag_user@example.com",
        username="other_flag_user",
        full_name="Nusrat Jahan",
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
        email="admin_safety@example.com",
        username="admin_safety",
        full_name="Safety Lead Admin",
        hashed_password=get_password_hash("password123"),
        role=UserRole.ADMIN,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def safety_category(db_session: AsyncSession) -> Category:
    cat = Category(
        name="Public Health",
        slug=f"public-health-{uuid.uuid4().hex[:6]}",
        description="Public health hazards",
        is_active=True,
    )
    db_session.add(cat)
    await db_session.commit()
    await db_session.refresh(cat)
    return cat


@pytest_asyncio.fixture
async def approved_report(
    db_session: AsyncSession,
    citizen_user: User,
    safety_category: Category,
) -> Report:
    report = Report(
        user_id=citizen_user.id,
        category_id=safety_category.id,
        title="Illegal Waste Dumping in Buriganga Embankment",
        description="Hazardous industrial dye dumped near residential embankment.",
        location_text="Kamrangirchar, Dhaka",
        status=ReportStatus.APPROVED,
        is_anonymous=False,
    )
    db_session.add(report)
    await db_session.commit()
    await db_session.refresh(report)
    return report


@pytest_asyncio.fixture
async def visible_comment(
    db_session: AsyncSession,
    other_citizen: User,
    approved_report: Report,
) -> Comment:
    comment = Comment(
        report_id=approved_report.id,
        user_id=other_citizen.id,
        body="Allegedly the dumping happens every Friday night.",
        status=CommentStatus.VISIBLE,
    )
    db_session.add(comment)
    await db_session.commit()
    await db_session.refresh(comment)
    return comment


@pytest.mark.asyncio
async def test_unauthenticated_cannot_create_flags(
    async_client: AsyncClient,
    approved_report: Report,
    visible_comment: Comment,
):
    # Unauthenticated report flag -> 401
    res1 = await async_client.post(
        f"/api/v1/reports/{approved_report.id}/flags",
        json={"reason": "FALSE_OR_MISLEADING", "details": "Unverified claim."},
    )
    assert res1.status_code == 401

    # Unauthenticated comment flag -> 401
    res2 = await async_client.post(
        f"/api/v1/comments/{visible_comment.id}/flags",
        json={"reason": "SPAM", "details": "Promotional comment."},
    )
    assert res2.status_code == 401


@pytest.mark.asyncio
async def test_authenticated_can_flag_approved_report_and_comment(
    async_client: AsyncClient,
    citizen_user: User,
    approved_report: Report,
    visible_comment: Comment,
):
    token = create_access_token(subject=str(citizen_user.id))
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Flag Approved Report
    res_rep = await async_client.post(
        f"/api/v1/reports/{approved_report.id}/flags",
        headers=headers,
        json={
            "reason": "PRIVACY_CONCERN",
            "details": "A license plate is visible in description.",
        },
    )
    assert res_rep.status_code == 201
    rep_data = res_rep.json()
    assert rep_data["target_type"] == "REPORT"
    assert rep_data["report_id"] == str(approved_report.id)
    assert rep_data["reason"] == "PRIVACY_CONCERN"
    assert rep_data["status"] == "PENDING"

    # 2. Flag Public Comment
    res_com = await async_client.post(
        f"/api/v1/comments/{visible_comment.id}/flags",
        headers=headers,
        json={
            "reason": "HARASSMENT_OR_ABUSE",
            "details": "Comment contains abusive language.",
        },
    )
    assert res_com.status_code == 201
    com_data = res_com.json()
    assert com_data["target_type"] == "COMMENT"
    assert com_data["comment_id"] == str(visible_comment.id)
    assert com_data["reason"] == "HARASSMENT_OR_ABUSE"
    assert com_data["status"] == "PENDING"


@pytest.mark.asyncio
async def test_cannot_flag_unapproved_reports(
    async_client: AsyncClient,
    citizen_user: User,
    safety_category: Category,
    db_session: AsyncSession,
):
    token = create_access_token(subject=str(citizen_user.id))
    headers = {"Authorization": f"Bearer {token}"}

    unapproved_statuses = [
        ReportStatus.DRAFT,
        ReportStatus.SUBMITTED,
        ReportStatus.UNDER_REVIEW,
        ReportStatus.REJECTED,
        ReportStatus.NEEDS_MORE_INFORMATION,
        ReportStatus.ARCHIVED,
    ]

    for st in unapproved_statuses:
        r = Report(
            user_id=citizen_user.id,
            category_id=safety_category.id,
            title=f"Incident {st.value}",
            description="Testing safety flag rejection on unapproved report.",
            location_text="Dhaka",
            status=st,
        )
        db_session.add(r)
        await db_session.commit()
        await db_session.refresh(r)

        res = await async_client.post(
            f"/api/v1/reports/{r.id}/flags",
            headers=headers,
            json={"reason": "SPAM"},
        )
        assert res.status_code == 400


@pytest.mark.asyncio
async def test_duplicate_flag_idempotent_behavior(
    async_client: AsyncClient,
    citizen_user: User,
    approved_report: Report,
):
    token = create_access_token(subject=str(citizen_user.id))
    headers = {"Authorization": f"Bearer {token}"}

    # First flag
    res1 = await async_client.post(
        f"/api/v1/reports/{approved_report.id}/flags",
        headers=headers,
        json={"reason": "SPAM", "details": "Commercial advertisement."},
    )
    assert res1.status_code == 201
    flag_id = res1.json()["id"]

    # Second flag with identical user, report, and reason
    res2 = await async_client.post(
        f"/api/v1/reports/{approved_report.id}/flags",
        headers=headers,
        json={"reason": "SPAM", "details": "Commercial advertisement."},
    )
    assert res2.status_code == 201
    assert res2.json()["id"] == flag_id
    assert "already been recorded" in res2.json()["message"]


@pytest.mark.asyncio
async def test_admin_flag_queue_and_review_lifecycle(
    async_client: AsyncClient,
    citizen_user: User,
    admin_user: User,
    approved_report: Report,
):
    user_token = create_access_token(subject=str(citizen_user.id))
    admin_token = create_access_token(subject=str(admin_user.id))

    # 1. Citizen flags report
    res_flag = await async_client.post(
        f"/api/v1/reports/{approved_report.id}/flags",
        headers={"Authorization": f"Bearer {user_token}"},
        json={"reason": "INAPPROPRIATE_CONTENT", "details": "Offensive imagery noted."},
    )
    flag_id = res_flag.json()["id"]

    # 2. Normal user tries to access admin flag queue -> 403 Forbidden
    res_user_queue = await async_client.get(
        "/api/v1/admin/flags",
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert res_user_queue.status_code == 403

    # 3. Admin lists flags in queue -> 200 OK
    res_admin_queue = await async_client.get(
        "/api/v1/admin/flags?flag_status=PENDING",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res_admin_queue.status_code == 200
    queue_data = res_admin_queue.json()
    assert queue_data["total"] >= 1
    flag_ids = [f["id"] for f in queue_data["items"]]
    assert flag_id in flag_ids

    # 4. Admin reviews and takes action on flag
    res_review = await async_client.patch(
        f"/api/v1/admin/flags/{flag_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "status": "ACTION_TAKEN",
            "admin_notes": "Moderator investigated and masked inappropriate element.",
        },
    )
    assert res_review.status_code == 200
    assert res_review.json()["status"] == "ACTION_TAKEN"
    assert res_review.json()["admin_notes"] == "Moderator investigated and masked inappropriate element."
    assert res_review.json()["reviewed_by"] == str(admin_user.id)


@pytest.mark.asyncio
async def test_privacy_guarantee_flags_never_exposed_publicly(
    async_client: AsyncClient,
    citizen_user: User,
    approved_report: Report,
):
    token = create_access_token(subject=str(citizen_user.id))
    headers = {"Authorization": f"Bearer {token}"}

    # Submit flag
    await async_client.post(
        f"/api/v1/reports/{approved_report.id}/flags",
        headers=headers,
        json={"reason": "FALSE_OR_MISLEADING", "details": "Confidential flag details."},
    )

    # Public report response
    res_pub = await async_client.get(f"/api/v1/public/reports/{approved_report.id}")
    assert res_pub.status_code == 200
    pub_str = str(res_pub.json())
    assert "Confidential flag details" not in pub_str
    assert "flags" not in res_pub.json()
    assert "flag_count" not in res_pub.json()
