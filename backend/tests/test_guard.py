import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User, UserRole
from app.core.security import get_password_hash, create_access_token



class TestGuardSystem:
    @pytest.fixture
    async def user_a(self, db_session: AsyncSession):
        user = User(
            email="citizen_a@example.com",
            username="citizen_a",
            full_name="Citizen A",
            hashed_password=get_password_hash("password123"),
            role=UserRole.USER,
            is_active=True,
            is_verified=True,
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)
        token = create_access_token(subject=str(user.id))
        return user, token

    @pytest.fixture
    async def user_b(self, db_session: AsyncSession):
        user = User(
            email="citizen_b@example.com",
            username="01712345678",
            full_name="Citizen B",
            hashed_password=get_password_hash("password123"),
            role=UserRole.USER,
            is_active=True,
            is_verified=True,
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)
        token = create_access_token(subject=str(user.id))
        return user, token

    @pytest.mark.asyncio
    async def test_trusted_contacts_crud_and_limits(self, async_client: AsyncClient, user_a):
        user, token = user_a
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Initially empty
        res = await async_client.get("/api/v1/guard/contacts", headers=headers)
        assert res.status_code == 200
        assert res.json() == []

        # 2. Add 5 contacts
        contact_ids = []
        for i in range(1, 6):
            payload = {
                "name": f"Contact {i}",
                "phone": f"+880170000000{i}",
                "relationship": "Family",
                "is_confirmed": True,
                "display_order": i - 1,
            }
            res = await async_client.post("/api/v1/guard/contacts", json=payload, headers=headers)
            assert res.status_code == 201, res.text
            data = res.json()
            assert data["name"] == f"Contact {i}"
            assert data["phone"] == f"+880170000000{i}"
            contact_ids.append(data["id"])

        # 3. Try to add 6th contact -> Must fail with 400
        sixth_payload = {
            "name": "Contact 6",
            "phone": "+8801700000006",
            "relationship": "Friend",
            "is_confirmed": True,
        }
        res6 = await async_client.post("/api/v1/guard/contacts", json=sixth_payload, headers=headers)
        assert res6.status_code == 400
        assert "Maximum of 5" in res6.json()["detail"]

        # 4. Update contact 1
        update_payload = {"name": "Mother (Updated)", "relationship": "Mother"}
        res_up = await async_client.put(
            f"/api/v1/guard/contacts/{contact_ids[0]}",
            json=update_payload,
            headers=headers,
        )
        assert res_up.status_code == 200
        assert res_up.json()["name"] == "Mother (Updated)"
        assert res_up.json()["relationship"] == "Mother"

        # 5. Delete contact 5
        res_del = await async_client.delete(
            f"/api/v1/guard/contacts/{contact_ids[4]}",
            headers=headers,
        )
        assert res_del.status_code == 204

        # Verify now 4 contacts remain
        res_list = await async_client.get("/api/v1/guard/contacts", headers=headers)
        assert len(res_list.json()) == 4

    @pytest.mark.asyncio
    async def test_guard_settings(self, async_client: AsyncClient, user_a):
        user, token = user_a
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Get default settings
        res = await async_client.get("/api/v1/guard/settings", headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert data["alerts_enabled"] is True
        assert data["share_location"] is False

        # 2. Update settings
        up_res = await async_client.put(
            "/api/v1/guard/settings",
            json={
                "share_location": True,
                "custom_message": "Immediate danger alert! Please respond!",
            },
            headers=headers,
        )
        assert up_res.status_code == 200
        up_data = up_res.json()
        assert up_data["share_location"] is True
        assert up_data["custom_message"] == "Immediate danger alert! Please respond!"

    @pytest.mark.asyncio
    async def test_emergency_lifecycle_and_safe_resolution(self, async_client: AsyncClient, user_a):
        user, token = user_a
        headers = {"Authorization": f"Bearer {token}"}

        # Add a confirmed trusted contact
        await async_client.post(
            "/api/v1/guard/contacts",
            json={
                "name": "Father",
                "phone": "+8801811111111",
                "relationship": "Father",
                "is_confirmed": True,
            },
            headers=headers,
        )

        # 1. Start emergency alert with location
        start_res = await async_client.post(
            "/api/v1/guard/session/start",
            json={
                "message": "Need urgent help near Dhanmondi 27",
                "latitude": 23.746194,
                "longitude": 90.374281,
                "share_location": True,
                "is_test": False,
            },
            headers=headers,
        )
        assert start_res.status_code == 201, start_res.text
        session_data = start_res.json()
        assert session_data["status"] == "ACTIVE"
        assert session_data["location_shared"] is True
        # Privacy 3-decimal verification
        assert session_data["latitude"] == 23.746
        assert session_data["longitude"] == 90.374
        assert len(session_data["recipients"]) == 1
        assert session_data["recipients"][0]["recipient_name"] == "Father"

        session_id = session_data["id"]

        # 2. Check active session endpoint
        active_res = await async_client.get("/api/v1/guard/session/active", headers=headers)
        assert active_res.status_code == 200
        assert active_res.json() is not None
        assert active_res.json()["id"] == session_id

        # 3. Mark safe ("I'm Safe")
        resolve_res = await async_client.post(
            f"/api/v1/guard/session/{session_id}/resolve",
            headers=headers,
        )
        assert resolve_res.status_code == 200
        assert resolve_res.json()["status"] == "RESOLVED"
        assert resolve_res.json()["resolved_at"] is not None

        # 4. Check active session is now None
        active_after = await async_client.get("/api/v1/guard/session/active", headers=headers)
        assert active_after.status_code == 200
        assert active_after.json() is None

        # 5. Check history contains the resolved session
        hist_res = await async_client.get("/api/v1/guard/history", headers=headers)
        assert hist_res.status_code == 200
        assert hist_res.json()["total"] >= 1
        assert hist_res.json()["items"][0]["status"] == "RESOLVED"

    @pytest.mark.asyncio
    async def test_test_alert_mode(self, async_client: AsyncClient, user_a):
        user, token = user_a
        headers = {"Authorization": f"Bearer {token}"}

        # Start a test alert
        res = await async_client.post(
            "/api/v1/guard/session/start",
            json={
                "message": "Testing Nirapotta Guard alert configuration",
                "is_test": True,
            },
            headers=headers,
        )
        assert res.status_code == 201
        data = res.json()
        assert data["is_test"] is True
        assert "[TEST ALERT]" in data["message"]

        # Cancel test alert
        cancel_res = await async_client.post(
            f"/api/v1/guard/session/{data['id']}/cancel",
            headers=headers,
        )
        assert cancel_res.status_code == 200
        assert cancel_res.json()["status"] == "CANCELLED"

    @pytest.mark.asyncio
    async def test_idor_and_unauthorized_access(
        self, async_client: AsyncClient, user_a, user_b
    ):
        user1, token1 = user_a
        user2, token2 = user_b
        headers1 = {"Authorization": f"Bearer {token1}"}
        headers2 = {"Authorization": f"Bearer {token2}"}

        # User 1 creates contact
        c_res = await async_client.post(
            "/api/v1/guard/contacts",
            json={"name": "User 1 Sister", "phone": "+8801999999999", "relationship": "Sister"},
            headers=headers1,
        )
        contact_id = c_res.json()["id"]

        # User 2 tries to update User 1's contact -> Must 404 (IDOR protection)
        hack_up = await async_client.put(
            f"/api/v1/guard/contacts/{contact_id}",
            json={"name": "Hacked Name"},
            headers=headers2,
        )
        assert hack_up.status_code == 404

        # User 2 tries to delete User 1's contact -> Must 404
        hack_del = await async_client.delete(
            f"/api/v1/guard/contacts/{contact_id}",
            headers=headers2,
        )
        assert hack_del.status_code == 404

        # Unauthenticated request -> Must 401
        anon_res = await async_client.get("/api/v1/guard/contacts")
        assert anon_res.status_code == 401

    @pytest.mark.asyncio
    async def test_guard_registered_contact_notification_dispatch(
        self, async_client: AsyncClient, user_a, user_b
    ):
        user_sender, token_sender = user_a
        user_recipient, token_recipient = user_b
        headers_sender = {"Authorization": f"Bearer {token_sender}"}
        headers_recipient = {"Authorization": f"Bearer {token_recipient}"}

        # Sender adds Recipient's username as contact phone
        c_res = await async_client.post(
            "/api/v1/guard/contacts",
            json={
                "name": "Friend Recipient",
                "phone": user_recipient.username,
                "relationship": "Friend",
                "is_confirmed": True,
            },
            headers=headers_sender,
        )
        assert c_res.status_code == 201

        # Sender triggers emergency alert
        start_res = await async_client.post(
            "/api/v1/guard/session/start",
            json={
                "message": "Friend in danger! Need immediate response.",
                "share_location": False,
            },
            headers=headers_sender,
        )
        assert start_res.status_code == 201
        session_id = start_res.json()["id"]
        # Verify delivery status is DELIVERED because recipient is a registered Nirapotta user
        recipients = start_res.json()["recipients"]
        assert len(recipients) == 1
        assert recipients[0]["delivery_status"] == "DELIVERED"

        # Check Recipient's notification feed
        n_res = await async_client.get("/api/v1/notifications", headers=headers_recipient)
        assert n_res.status_code == 200
        n_data = n_res.json()
        assert len(n_data["items"]) >= 1
        assert n_data["items"][0]["type"] == "EMERGENCY_ALERT"

        # Sender marks "I'm Safe"
        resolve_res = await async_client.post(
            f"/api/v1/guard/session/{session_id}/resolve",
            headers=headers_sender,
        )
        assert resolve_res.status_code == 200

        # Recipient receives safe resolution notification
        n_res2 = await async_client.get("/api/v1/notifications", headers=headers_recipient)
        assert n_res2.status_code == 200
        assert any(n["type"] == "EMERGENCY_SAFE" for n in n_res2.json()["items"])

        # Check Reputation of sender -> strictly ZERO impact points
        rep_res = await async_client.get("/api/v1/reputation/me", headers=headers_sender)
        assert rep_res.status_code == 200
        assert rep_res.json()["impact_points"] == 0

    @pytest.mark.asyncio
    async def test_cooldown_does_not_crash_with_naive_datetime(
        self, async_client: AsyncClient, db_session: AsyncSession, user_a
    ):
        """Regression test: cooldown check must not raise TypeError when
        EmergencySession.created_at is timezone-naive (e.g. SQLite legacy rows)."""
        from datetime import datetime, timezone
        from sqlalchemy import select
        from app.models.guard import EmergencySession

        user, token = user_a
        headers = {"Authorization": f"Bearer {token}"}

        # First session
        res1 = await async_client.post(
            "/api/v1/guard/session/start",
            json={"message": "First alert", "is_test": True},
            headers=headers,
        )
        assert res1.status_code == 201
        session_id = res1.json()["id"]

        # Cancel it
        await async_client.post(
            f"/api/v1/guard/session/{session_id}/cancel",
            headers=headers,
        )

        # Manually backdating created_at to a timezone-naive value (simulates SQLite)
        stmt = select(EmergencySession).where(EmergencySession.id == session_id)
        result = await db_session.execute(stmt)
        session_obj = result.scalar_one_or_none()
        if session_obj:
            session_obj.created_at = datetime(2000, 1, 1, 0, 0, 0)  # naive, far past
            await db_session.commit()

        # Second session must succeed (cooldown expired long ago)
        res2 = await async_client.post(
            "/api/v1/guard/session/start",
            json={"message": "Second alert after naive datetime", "is_test": True},
            headers=headers,
        )
        assert res2.status_code == 201, f"Expected 201 but got {res2.status_code}: {res2.text}"
