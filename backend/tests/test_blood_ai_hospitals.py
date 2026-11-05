import uuid
import pytest
from datetime import datetime, timezone
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.user import User, UserRole
from app.models.hospital import Hospital, BloodInventory, BloodInventoryStatus
from app.models.emergency_service import VerificationStatus
from app.models.blood import BloodGroup
from app.core.security import create_access_token, get_password_hash
from app.db.seed_hospitals import seed_hospitals_and_inventory
from app.schemas.hospital import BloodAIChatRequest
from app.services.blood_ai_assistant import chat_blood_ai


@pytest.fixture
async def seeded_hospitals(db_session: AsyncSession):
    """Fixture that seeds the 14 verified hospitals and inventories across all 8 divisions."""
    result = await seed_hospitals_and_inventory(db_session)
    assert result["total_hospitals_defined"] == 14
    return result


@pytest.fixture
async def admin_user(db_session: AsyncSession) -> User:
    user = User(
        email="admin_hospital_test@nirapotta.gov.bd",
        username="admin_hospital_test",
        hashed_password=get_password_hash("AdminPass123!"),
        full_name="Hospital Platform Admin",
        role=UserRole.ADMIN,
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def regular_user(db_session: AsyncSession) -> User:
    user = User(
        email="citizen_user_test@nirapotta.local",
        username="citizen_user_test",
        hashed_password=get_password_hash("UserPass123!"),
        full_name="Regular Citizen",
        role=UserRole.USER,
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.mark.asyncio
async def test_seed_hospitals_idempotency(db_session: AsyncSession):
    """Test that seeding hospitals and inventory runs cleanly and idempotently."""
    res1 = await seed_hospitals_and_inventory(db_session)
    assert res1["hospitals_created"] == 14

    # Second run should be idempotent and not create duplicate hospitals
    res2 = await seed_hospitals_and_inventory(db_session)
    assert res2["hospitals_created"] == 0

    stmt = select(Hospital)
    hospitals = list((await db_session.execute(stmt)).scalars().all())
    assert len(hospitals) == 14


@pytest.mark.asyncio
async def test_get_nearby_hospitals_endpoint(async_client: AsyncClient, seeded_hospitals):
    """Test searching nearby hospitals with user coordinates."""
    # Near Dhaka Shahbag coordinates (23.7388, 90.3956)
    response = await async_client.get(
        "/api/v1/blood/hospitals/nearby",
        params={"lat": 23.7388, "lng": 90.3956, "radius_km": 15.0},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["total"] > 0
    items = data["items"]
    # BSMMU should be closest (~0 km)
    assert any("Bangabandhu" in h["name"] or "BSMMU" in h["name"] for h in items)
    # Check item schema completeness
    first = items[0]
    assert "emergency_phone" in first
    assert "verification_status" in first
    assert "available_actions" in first
    assert "Call Hospital" in first["available_actions"]


@pytest.mark.asyncio
async def test_nearby_hospitals_blood_group_filter(async_client: AsyncClient, seeded_hospitals):
    """Test filtering hospitals by specific blood group stock."""
    response = await async_client.get(
        "/api/v1/blood/hospitals/nearby",
        params={"blood_group": "B+", "district": "Dhaka"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["total"] > 0
    for h in data["items"]:
        assert h["matching_inventory"] is not None
        assert h["matching_inventory"]["blood_group"] == "B+"


@pytest.mark.asyncio
async def test_search_hospitals_by_name(async_client: AsyncClient, seeded_hospitals):
    """Test textual hospital search by name query."""
    response = await async_client.get(
        "/api/v1/blood/hospitals/search",
        params={"q": "Dhaka Medical"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 1
    assert "Dhaka Medical College Hospital" in data["items"][0]["name"]


@pytest.mark.asyncio
async def test_get_hospital_details_and_inventory(async_client: AsyncClient, seeded_hospitals, db_session: AsyncSession):
    """Test retrieving full 8 blood groups inventory for a hospital."""
    stmt = select(Hospital).where(Hospital.name.like("%Dhaka Medical%"))
    hospital = (await db_session.execute(stmt)).scalars().first()
    assert hospital is not None

    # Get details
    resp = await async_client.get(f"/api/v1/blood/hospitals/{hospital.id}")
    assert resp.status_code == 200
    detail = resp.json()
    assert detail["hospital"]["name"] == hospital.name
    assert len(detail["inventories"]) == 8  # All 8 blood groups

    # Get inventory endpoint
    resp_inv = await async_client.get(f"/api/v1/blood/hospitals/{hospital.id}/inventory")
    assert resp_inv.status_code == 200
    inventories = resp_inv.json()
    assert len(inventories) == 8
    groups = {inv["blood_group"] for inv in inventories}
    assert {"A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"}.issubset(groups)


@pytest.mark.asyncio
async def test_hospital_not_found(async_client: AsyncClient):
    """Test 404 response for non-existent hospital."""
    random_id = uuid.uuid4()
    resp = await async_client.get(f"/api/v1/blood/hospitals/{random_id}")
    assert resp.status_code == 404
    assert "Hospital not found" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_blood_inventory_search(async_client: AsyncClient, seeded_hospitals):
    """Test searching blood inventory across hospitals for rare blood groups."""
    resp = await async_client.get(
        "/api/v1/blood/inventory/search",
        params={"blood_group": "O-", "district": "Dhaka"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] > 0
    # Every returned hospital summary must contain matching inventory for O-
    for h in data["items"]:
        assert h["matching_inventory"] is not None
        assert h["matching_inventory"]["blood_group"] == "O-"


@pytest.mark.asyncio
async def test_admin_update_inventory_authorization(
    async_client: AsyncClient,
    seeded_hospitals,
    admin_user: User,
    regular_user: User,
    db_session: AsyncSession,
):
    """Test that only admins or moderators can update hospital inventory."""
    stmt = select(Hospital).where(Hospital.name.like("%Square Hospital%"))
    hospital = (await db_session.execute(stmt)).scalars().first()
    assert hospital is not None

    admin_token = create_access_token(subject=str(admin_user.id), role="ADMIN")
    citizen_token = create_access_token(subject=str(regular_user.id), role="USER")

    update_payload = {
        "blood_group": "O+",
        "available_units": 20,
        "availability_status": "AVAILABLE",
        "is_verified": True,
        "notes": "Emergency blood drive collection received",
    }

    # Citizen user should be forbidden (403)
    resp_citizen = await async_client.patch(
        f"/api/v1/blood/admin/hospitals/{hospital.id}/inventory",
        json=update_payload,
        headers={"Authorization": f"Bearer {citizen_token}"},
    )
    assert resp_citizen.status_code == 403

    # Admin user should succeed (200)
    resp_admin = await async_client.patch(
        f"/api/v1/blood/admin/hospitals/{hospital.id}/inventory",
        json=update_payload,
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp_admin.status_code == 200
    res_data = resp_admin.json()
    assert res_data["blood_group"] == "O+"
    assert res_data["available_units"] == 20
    assert res_data["availability_status"] == "AVAILABLE"

    # Verify audit history
    resp_history = await async_client.get(
        f"/api/v1/blood/admin/hospitals/{hospital.id}/inventory/history",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp_history.status_code == 200
    history = resp_history.json()
    assert len(history) > 0
    assert history[0]["new_units"] == 20


@pytest.mark.asyncio
async def test_admin_inventory_validation_invalid_blood_group(
    async_client: AsyncClient,
    seeded_hospitals,
    admin_user: User,
    db_session: AsyncSession,
):
    """Test validation rejection for invalid blood groups."""
    stmt = select(Hospital).limit(1)
    hospital = (await db_session.execute(stmt)).scalars().first()

    admin_token = create_access_token(subject=str(admin_user.id), role="ADMIN")

    bad_payload = {
        "blood_group": "XYZ+",
        "available_units": 5,
    }
    resp = await async_client.patch(
        f"/api/v1/blood/admin/hospitals/{hospital.id}/inventory",
        json=bad_payload,
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 400
    assert "Invalid blood group" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_admin_inventory_validation_negative_units(
    async_client: AsyncClient,
    seeded_hospitals,
    admin_user: User,
    db_session: AsyncSession,
):
    """Test validation rejection for negative inventory quantities."""
    stmt = select(Hospital).limit(1)
    hospital = (await db_session.execute(stmt)).scalars().first()

    admin_token = create_access_token(subject=str(admin_user.id), role="ADMIN")

    bad_payload = {
        "blood_group": "A+",
        "available_units": -5,
    }
    resp = await async_client.patch(
        f"/api/v1/blood/admin/hospitals/{hospital.id}/inventory",
        json=bad_payload,
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 422  # Pydantic Field(ge=0) validation error


@pytest.mark.asyncio
async def test_blood_ai_chat_bangla_query(async_client: AsyncClient, seeded_hospitals):
    """Test Blood AI natural language query in Bangla with blood group and hospital."""
    payload = {
        "message": "আমার B+ রক্ত লাগবে, Dhaka Medical এর কাছে কোন হাসপাতাল বা ব্লাড ব্যাংকে পাবো?",
        "lang": "bn",
    }
    response = await async_client.post("/api/v1/blood/ai/chat", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["extracted_params"]["blood_group"] == "B+"
    assert data["total_hospitals_found"] > 0
    assert "search_nearby_hospitals" in data["tools_called"]
    assert "search_blood_inventory" in data["tools_called"]
    assert "জরুরি সতর্কতা" in data["disclaimer"]
    # Check that hospital cards are present
    first_h = data["hospitals"][0]
    assert first_h["emergency_phone"].startswith("+880")


@pytest.mark.asyncio
async def test_blood_ai_chat_english_query(async_client: AsyncClient, seeded_hospitals):
    """Test Blood AI natural language query in English."""
    payload = {
        "message": "Find nearby hospitals with O+ blood availability in Dhaka.",
        "user_district": "Dhaka",
        "lang": "en",
    }
    response = await async_client.post("/api/v1/blood/ai/chat", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["extracted_params"]["blood_group"] == "O+"
    assert data["total_hospitals_found"] > 0
    assert "Emergency Disclaimer" in data["disclaimer"]


@pytest.mark.asyncio
async def test_blood_ai_chat_clarification_when_blood_group_missing(async_client: AsyncClient):
    """Test that Blood AI asks a polite follow-up question when blood group is missing for blood inventory requests."""
    payload = {
        "message": "আমার জরুরি রক্ত লাগবে। হাসপাতালে পাওয়া যাবে?",
        "lang": "bn",
    }
    response = await async_client.post("/api/v1/blood/ai/chat", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["is_clarification_needed"] is True
    assert data["follow_up_question"] is not None
    assert "কোন রক্তের গ্রুপ" in data["follow_up_question"]


@pytest.mark.asyncio
async def test_blood_ai_chat_emergency_phone_no_unnecessary_followup(async_client: AsyncClient, seeded_hospitals):
    """
    Test that Blood AI does NOT ask unnecessary follow-up questions when the user
    just asks for emergency contact numbers or hospital information.
    """
    payload = {
        "message": "Emergency blood bank phone number in Shahbag Dhaka",
        "user_district": "Dhaka",
        "lang": "en",
    }
    response = await async_client.post("/api/v1/blood/ai/chat", json=payload)
    assert response.status_code == 200
    data = response.json()
    # Should not block with clarification since user just wants emergency phone
    assert data["is_clarification_needed"] is False
    assert data["total_hospitals_found"] > 0
    assert any("Phone:" in data["reply"] or "+880" in data["reply"] for _ in [1])


@pytest.mark.asyncio
async def test_ai_features_unified_endpoint_routing(async_client: AsyncClient, seeded_hospitals):
    """Test that the unified /api/v1/blood-ai/chat endpoint works identically."""
    payload = {
        "message": "Looking for A+ blood near Chittagong Medical",
        "lang": "en",
    }
    response = await async_client.post("/api/v1/blood-ai/chat", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["extracted_params"]["blood_group"] == "A+"
    assert data["total_hospitals_found"] > 0
