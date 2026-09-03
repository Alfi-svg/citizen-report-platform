import uuid
import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, get_password_hash
from app.models.category import Category
from app.models.comment import Comment, CommentStatus
from app.models.reaction import Reaction, ReactionType
from app.models.report import Report, ReportStatus
from app.models.user import User, UserRole


@pytest_asyncio.fixture
async def citizen_user(db_session: AsyncSession) -> User:
    user = User(
        email="citizen_interaction@example.com",
        username="citizen_interaction",
        full_name="Abdur Rahim",
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
        full_name="Salma Khatun",
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
        email="admin_moderator@example.com",
        username="admin_moderator",
        full_name="Admin Moderator",
        hashed_password=get_password_hash("password123"),
        role=UserRole.ADMIN,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def interaction_category(db_session: AsyncSession) -> Category:
    cat = Category(
        name="Civic Hazard",
        slug=f"civic-hazard-{uuid.uuid4().hex[:6]}",
        description="Hazardous conditions",
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
    interaction_category: Category,
) -> Report:
    report = Report(
        user_id=citizen_user.id,
        category_id=interaction_category.id,
        title="Verified Broken Water Main in Dhanmondi",
        description="Water is flooding Road 27 causing severe damage.",
        location_text="Dhanmondi 27, Dhaka",
        status=ReportStatus.APPROVED,
        is_anonymous=False,
    )
    db_session.add(report)
    await db_session.commit()
    await db_session.refresh(report)
    return report


@pytest.mark.asyncio
async def test_unauthenticated_cannot_create_comment_or_reaction(
    async_client: AsyncClient,
    approved_report: Report,
):
    # Unauthenticated comment -> 401
    res_c = await async_client.post(
        f"/api/v1/reports/{approved_report.id}/comments",
        json={"body": "This needs immediate repair!"},
    )
    assert res_c.status_code == 401

    # Unauthenticated reaction -> 401
    res_r = await async_client.post(
        f"/api/v1/reports/{approved_report.id}/reactions",
        json={"reaction_type": "SUPPORT"},
    )
    assert res_r.status_code == 401


@pytest.mark.asyncio
async def test_authenticated_can_comment_on_approved_report(
    async_client: AsyncClient,
    citizen_user: User,
    approved_report: Report,
):
    token = create_access_token(subject=str(citizen_user.id))
    headers = {"Authorization": f"Bearer {token}"}

    res = await async_client.post(
        f"/api/v1/reports/{approved_report.id}/comments",
        headers=headers,
        json={"body": "I visited the site today and WASA is already deploying a team."},
    )
    assert res.status_code == 201
    data = res.json()
    assert data["body"] == "I visited the site today and WASA is already deploying a team."
    assert data["user_display_name"] == "Abdur Rahim"
    assert data["is_own_comment"] is True
    assert data["status"] == "VISIBLE"

    # Test GET via /reports/{id}/comments
    res_get = await async_client.get(f"/api/v1/reports/{approved_report.id}/comments")
    assert res_get.status_code == 200
    assert len(res_get.json()["items"]) >= 1

    # Test POST via /public/reports/{id}/comments
    res_pub = await async_client.post(
        f"/api/v1/public/reports/{approved_report.id}/comments",
        headers=headers,
        json={"body": "Second witness comment via public prefix."},
    )
    assert res_pub.status_code == 201
    assert res_pub.json()["body"] == "Second witness comment via public prefix."


@pytest.mark.asyncio
async def test_cannot_comment_on_unapproved_reports(
    async_client: AsyncClient,
    citizen_user: User,
    interaction_category: Category,
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
            category_id=interaction_category.id,
            title=f"Incident in {st.value}",
            description="Testing unapproved report comment rejection.",
            location_text="Gulshan",
            status=st,
        )
        db_session.add(r)
        await db_session.commit()
        await db_session.refresh(r)

        res = await async_client.post(
            f"/api/v1/reports/{r.id}/comments",
            headers=headers,
            json={"body": "Should fail on unapproved report."},
        )
        assert res.status_code == 400


@pytest.mark.asyncio
async def test_comment_deletion_permissions(
    async_client: AsyncClient,
    citizen_user: User,
    other_user: User,
    admin_user: User,
    approved_report: Report,
):
    user_token = create_access_token(subject=str(citizen_user.id))
    other_token = create_access_token(subject=str(other_user.id))
    admin_token = create_access_token(subject=str(admin_user.id))

    # 1. Citizen creates comment
    res = await async_client.post(
        f"/api/v1/reports/{approved_report.id}/comments",
        headers={"Authorization": f"Bearer {user_token}"},
        json={"body": "First comment to test delete permissions."},
    )
    assert res.status_code == 201
    comment_id = res.json()["id"]

    # 2. Other user tries to delete -> 403 Forbidden
    res_other = await async_client.delete(
        f"/api/v1/comments/{comment_id}",
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert res_other.status_code == 403

    # 3. Admin can delete -> 200 OK
    res_admin = await async_client.delete(
        f"/api/v1/comments/{comment_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res_admin.status_code == 200

    # 4. Author can delete their own next comment
    res2 = await async_client.post(
        f"/api/v1/reports/{approved_report.id}/comments",
        headers={"Authorization": f"Bearer {user_token}"},
        json={"body": "Second comment by author to delete own."},
    )
    assert res2.status_code == 201
    comment2_id = res2.json()["id"]

    res_own_del = await async_client.delete(
        f"/api/v1/comments/{comment2_id}",
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert res_own_del.status_code == 200


@pytest.mark.asyncio
async def test_comment_validation_and_spam_prevention(
    async_client: AsyncClient,
    citizen_user: User,
    approved_report: Report,
):
    token = create_access_token(subject=str(citizen_user.id))
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Empty body -> 422
    res_empty = await async_client.post(
        f"/api/v1/reports/{approved_report.id}/comments",
        headers=headers,
        json={"body": "   "},
    )
    assert res_empty.status_code == 422

    # 2. Oversized body (> 1000 chars) -> 422
    res_large = await async_client.post(
        f"/api/v1/reports/{approved_report.id}/comments",
        headers=headers,
        json={"body": "A" * 1001},
    )
    assert res_large.status_code == 422

    # 3. Valid comment
    res_valid = await async_client.post(
        f"/api/v1/reports/{approved_report.id}/comments",
        headers=headers,
        json={"body": "Testing spam check message."},
    )
    assert res_valid.status_code == 201

    # 4. Rapid duplicate submission within 10s -> 429
    res_dup = await async_client.post(
        f"/api/v1/reports/{approved_report.id}/comments",
        headers=headers,
        json={"body": "Testing spam check message."},
    )
    assert res_dup.status_code == 429


@pytest.mark.asyncio
async def test_admin_comment_moderation(
    async_client: AsyncClient,
    citizen_user: User,
    admin_user: User,
    approved_report: Report,
):
    user_token = create_access_token(subject=str(citizen_user.id))
    admin_token = create_access_token(subject=str(admin_user.id))

    # Citizen posts comment
    res_c = await async_client.post(
        f"/api/v1/reports/{approved_report.id}/comments",
        headers={"Authorization": f"Bearer {user_token}"},
        json={"body": "Inappropriate or abusive content."},
    )
    comment_id = res_c.json()["id"]

    # Admin lists comments
    res_list = await async_client.get(
        f"/api/v1/admin/comments?report_id={approved_report.id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res_list.status_code == 200
    assert len(res_list.json()) >= 1

    # Admin hides comment
    res_hide = await async_client.patch(
        f"/api/v1/admin/comments/{comment_id}/status",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"status": "HIDDEN"},
    )
    assert res_hide.status_code == 200
    assert res_hide.json()["status"] == "HIDDEN"

    # Public comments list -> Hidden comment is not returned
    res_pub = await async_client.get(f"/api/v1/public/reports/{approved_report.id}/comments")
    assert res_pub.status_code == 200
    comment_ids = [c["id"] for c in res_pub.json()["items"]]
    assert comment_id not in comment_ids


@pytest.mark.asyncio
async def test_reaction_toggle_and_summary_lifecycle(
    async_client: AsyncClient,
    citizen_user: User,
    other_user: User,
    approved_report: Report,
):
    token1 = create_access_token(subject=str(citizen_user.id))
    token2 = create_access_token(subject=str(other_user.id))

    # 1. Citizen 1 adds SUPPORT reaction
    res1 = await async_client.post(
        f"/api/v1/reports/{approved_report.id}/reactions",
        headers={"Authorization": f"Bearer {token1}"},
        json={"reaction_type": "SUPPORT"},
    )
    assert res1.status_code == 200
    assert res1.json()["action"] == "added"
    assert res1.json()["summary"]["support_count"] == 1
    assert "SUPPORT" in res1.json()["summary"]["user_reactions"]

    # 2. Citizen 2 adds IMPORTANT reaction
    res2 = await async_client.post(
        f"/api/v1/reports/{approved_report.id}/reactions",
        headers={"Authorization": f"Bearer {token2}"},
        json={"reaction_type": "IMPORTANT"},
    )
    assert res2.status_code == 200
    assert res2.json()["action"] == "added"
    assert res2.json()["summary"]["important_count"] == 1

    # 3. Citizen 1 toggles SUPPORT reaction OFF
    res3 = await async_client.post(
        f"/api/v1/reports/{approved_report.id}/reactions",
        headers={"Authorization": f"Bearer {token1}"},
        json={"reaction_type": "SUPPORT"},
    )
    assert res3.status_code == 200
    assert res3.json()["action"] == "removed"
    assert res3.json()["summary"]["support_count"] == 0

    # 4. Public summary endpoint
    res_pub = await async_client.get(f"/api/v1/public/reports/{approved_report.id}/reactions")
    assert res_pub.status_code == 200
    assert res_pub.json()["support_count"] == 0
    assert res_pub.json()["important_count"] == 1
