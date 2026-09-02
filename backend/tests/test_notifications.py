import uuid
import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, get_password_hash
from app.models.category import Category
from app.models.comment import Comment, CommentStatus
from app.models.flag import ContentFlag, FlagTargetType, FlagStatus
from app.models.notification import Notification, NotificationType
from app.models.report import Report, ReportStatus
from app.models.user import User, UserRole


@pytest_asyncio.fixture
async def citizen_alice(db_session: AsyncSession) -> User:
    user = User(
        email="alice_notif@example.com",
        username="alice_notif",
        full_name="Alice Citizen",
        hashed_password=get_password_hash("password123"),
        role=UserRole.USER,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def citizen_bob(db_session: AsyncSession) -> User:
    user = User(
        email="bob_notif@example.com",
        username="bob_notif",
        full_name="Bob Citizen",
        hashed_password=get_password_hash("password123"),
        role=UserRole.USER,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def admin_moderator(db_session: AsyncSession) -> User:
    user = User(
        email="admin_notif@example.com",
        username="admin_notif",
        full_name="Moderator Admin",
        hashed_password=get_password_hash("password123"),
        role=UserRole.ADMIN,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def notif_category(db_session: AsyncSession) -> Category:
    cat = Category(
        name="Infrastructure",
        slug=f"infrastructure-{uuid.uuid4().hex[:6]}",
        description="Public infrastructure incidents",
        is_active=True,
    )
    db_session.add(cat)
    await db_session.commit()
    await db_session.refresh(cat)
    return cat


@pytest.mark.asyncio
async def test_unauthenticated_cannot_access_notifications(
    async_client: AsyncClient,
):
    res1 = await async_client.get("/api/v1/notifications")
    assert res1.status_code == 401

    res2 = await async_client.get("/api/v1/notifications/unread-count")
    assert res2.status_code == 401

    res3 = await async_client.patch(f"/api/v1/notifications/{uuid.uuid4()}/read")
    assert res3.status_code == 401


@pytest.mark.asyncio
async def test_user_notification_listing_and_isolation(
    async_client: AsyncClient,
    citizen_alice: User,
    citizen_bob: User,
    db_session: AsyncSession,
):
    token_a = create_access_token(subject=str(citizen_alice.id))
    token_b = create_access_token(subject=str(citizen_bob.id))

    # Add notification for Alice
    notif_a = Notification(
        user_id=citizen_alice.id,
        type=NotificationType.REPORT_SUBMITTED,
        title="Report Submitted",
        message="Alice, your report was submitted.",
    )
    # Add notification for Bob
    notif_b = Notification(
        user_id=citizen_bob.id,
        type=NotificationType.REPORT_APPROVED,
        title="Report Approved",
        message="Bob, your report was approved.",
    )
    db_session.add_all([notif_a, notif_b])
    await db_session.commit()

    # Alice views notifications -> only sees her own
    res_a = await async_client.get(
        "/api/v1/notifications",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert res_a.status_code == 200
    data_a = res_a.json()
    assert data_a["total"] == 1
    assert data_a["items"][0]["id"] == str(notif_a.id)
    assert "Alice" in data_a["items"][0]["message"]

    # Bob views notifications -> only sees his own
    res_b = await async_client.get(
        "/api/v1/notifications",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert res_b.status_code == 200
    data_b = res_b.json()
    assert data_b["total"] == 1
    assert data_b["items"][0]["id"] == str(notif_b.id)
    assert "Bob" in data_b["items"][0]["message"]


@pytest.mark.asyncio
async def test_unread_count_and_mark_read_flow(
    async_client: AsyncClient,
    citizen_alice: User,
    citizen_bob: User,
    db_session: AsyncSession,
):
    token_a = create_access_token(subject=str(citizen_alice.id))
    token_b = create_access_token(subject=str(citizen_bob.id))

    notif1 = Notification(
        user_id=citizen_alice.id,
        type=NotificationType.REPORT_SUBMITTED,
        title="Submitted 1",
        message="Msg 1",
    )
    notif2 = Notification(
        user_id=citizen_alice.id,
        type=NotificationType.REPORT_UNDER_REVIEW,
        title="Under Review",
        message="Msg 2",
    )
    db_session.add_all([notif1, notif2])
    await db_session.commit()

    # 1. Check unread count -> 2
    res_count = await async_client.get(
        "/api/v1/notifications/unread-count",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert res_count.status_code == 200
    assert res_count.json()["unread_count"] == 2

    # 2. Bob tries to mark Alice's notification as read -> 404 (IDOR safe)
    res_idor = await async_client.patch(
        f"/api/v1/notifications/{notif1.id}/read",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert res_idor.status_code == 404

    # 3. Alice marks notif1 as read -> 200
    res_read = await async_client.patch(
        f"/api/v1/notifications/{notif1.id}/read",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert res_read.status_code == 200
    assert res_read.json()["read_at"] is not None

    # 4. Check unread count -> 1
    res_count2 = await async_client.get(
        "/api/v1/notifications/unread-count",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert res_count2.json()["unread_count"] == 1

    # 5. Mark all as read
    res_all = await async_client.patch(
        "/api/v1/notifications/read-all",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert res_all.status_code == 200

    # 6. Check unread count -> 0
    res_count3 = await async_client.get(
        "/api/v1/notifications/unread-count",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert res_count3.json()["unread_count"] == 0


@pytest.mark.asyncio
async def test_report_lifecycle_generates_notifications(
    async_client: AsyncClient,
    citizen_alice: User,
    admin_moderator: User,
    notif_category: Category,
):
    token_user = create_access_token(subject=str(citizen_alice.id))
    token_admin = create_access_token(subject=str(admin_moderator.id))

    # 1. Citizen creates and submits report
    res_create = await async_client.post(
        "/api/v1/reports",
        headers={"Authorization": f"Bearer {token_user}"},
        json={
            "title": "Broken Drainage on Road 12",
            "description": "Severe drainage blockage creating health risk.",
            "category_id": str(notif_category.id),
            "location_text": "Road 12, Banani",
            "is_anonymous": False,
            "status": "SUBMITTED",
        },
    )
    assert res_create.status_code == 201
    report_id = res_create.json()["id"]

    # Verify notification for SUBMITTED
    res_notif1 = await async_client.get(
        "/api/v1/notifications",
        headers={"Authorization": f"Bearer {token_user}"},
    )
    assert res_notif1.status_code == 200
    assert res_notif1.json()["total"] == 1
    assert res_notif1.json()["items"][0]["type"] == "REPORT_SUBMITTED"

    # 2. Admin moves to UNDER_REVIEW
    res_rev = await async_client.post(
        f"/api/v1/admin/reports/{report_id}/review",
        headers={"Authorization": f"Bearer {token_admin}"},
        json={"internal_notes": "Assigned to civic inspector."},
    )
    assert res_rev.status_code == 200

    # Verify notification for UNDER_REVIEW
    res_notif2 = await async_client.get(
        "/api/v1/notifications",
        headers={"Authorization": f"Bearer {token_user}"},
    )
    assert res_notif2.json()["total"] == 2
    assert res_notif2.json()["items"][0]["type"] == "REPORT_UNDER_REVIEW"

    # 3. Admin APPROVES report
    res_app = await async_client.post(
        f"/api/v1/admin/reports/{report_id}/approve",
        headers={"Authorization": f"Bearer {token_admin}"},
        json={"user_message": "Incident verified with municipal team."},
    )
    assert res_app.status_code == 200

    # Verify notification for APPROVED
    res_notif3 = await async_client.get(
        "/api/v1/notifications",
        headers={"Authorization": f"Bearer {token_user}"},
    )
    assert res_notif3.json()["total"] == 3
    assert res_notif3.json()["items"][0]["type"] == "REPORT_APPROVED"


@pytest.mark.asyncio
async def test_comment_and_flag_moderation_notifications(
    async_client: AsyncClient,
    citizen_alice: User,
    admin_moderator: User,
    notif_category: Category,
    db_session: AsyncSession,
):
    token_user = create_access_token(subject=str(citizen_alice.id))
    token_admin = create_access_token(subject=str(admin_moderator.id))

    # Setup approved report
    rep = Report(
        user_id=citizen_alice.id,
        category_id=notif_category.id,
        title="Live Traffic Gridlock",
        description="Major bridge blockade.",
        location_text="Mohakhali Flyover",
        status=ReportStatus.APPROVED,
    )
    db_session.add(rep)
    await db_session.commit()
    await db_session.refresh(rep)

    # 1. Citizen posts comment
    res_c = await async_client.post(
        f"/api/v1/reports/{rep.id}/comments",
        headers={"Authorization": f"Bearer {token_user}"},
        json={"body": "Inappropriate or heated argument comment."},
    )
    comment_id = res_c.json()["id"]

    # 2. Admin hides comment -> triggers COMMENT_MODERATED notification
    res_hide = await async_client.patch(
        f"/api/v1/admin/comments/{comment_id}/status",
        headers={"Authorization": f"Bearer {token_admin}"},
        json={"status": "HIDDEN"},
    )
    assert res_hide.status_code == 200

    # 3. Citizen flags report
    res_flag = await async_client.post(
        f"/api/v1/reports/{rep.id}/flags",
        headers={"Authorization": f"Bearer {token_user}"},
        json={"reason": "OTHER", "details": "Traffic cleared now."},
    )
    flag_id = res_flag.json()["id"]

    # 4. Admin reviews flag -> triggers FLAG_REVIEWED notification
    res_f_rev = await async_client.patch(
        f"/api/v1/admin/flags/{flag_id}",
        headers={"Authorization": f"Bearer {token_admin}"},
        json={"status": "REVIEWED", "admin_notes": "Acknowledged."},
    )
    assert res_f_rev.status_code == 200

    # 5. Alice checks notifications -> has COMMENT_MODERATED and FLAG_REVIEWED
    res_notifs = await async_client.get(
        "/api/v1/notifications",
        headers={"Authorization": f"Bearer {token_user}"},
    )
    types = [n["type"] for n in res_notifs.json()["items"]]
    assert "COMMENT_MODERATED" in types
    assert "FLAG_REVIEWED" in types
