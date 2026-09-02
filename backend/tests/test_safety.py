import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.security import create_access_token, get_password_hash
from app.models.user import User, UserRole
from app.models.emergency_service import EmergencyService, ServiceType, VerificationStatus


@pytest.mark.asyncio
async def test_get_preconfigured_areas(async_client: AsyncClient):
    """Test retrieving preconfigured manual fallback areas across Bangladesh."""
    response = await async_client.get("/api/v1/safety/services/areas")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 10
    
    # Verify Dhanmondi, Gulshan, and Chittagong exist
    names = [area["name"] for area in data]
    assert "Dhanmondi" in names
    assert "Gulshan" in names
    assert any("Chittagong" in n for n in names)


@pytest.mark.asyncio
async def test_get_nearby_emergency_services_dhanmondi(async_client: AsyncClient, db_session: AsyncSession):
    """Test finding nearest police station, police box, and 999 from Dhanmondi coordinates."""
    # Seed emergency services into test database
    from app.db.seed_emergency_services import seed_emergency_services
    await seed_emergency_services(db_session)

    # Dhanmondi coordinates: 23.7461, 90.3742
    response = await async_client.get("/api/v1/safety/services/nearby?latitude=23.7461&longitude=90.3742&radius_km=15.0")
    assert response.status_code == 200
    data = response.json()

    # 1. 999 National Emergency Service
    assert data["national_emergency"]["number"] == "999"
    assert data["national_emergency"]["call_action"] == "tel:999"
    assert "জাতীয় জরুরি সেবা" in data["national_emergency"]["name_bn"]

    # 2. Nearest Police Station
    assert data["nearest_police_station"] is not None
    assert data["nearest_police_station"]["name"] == "Dhanmondi Police Station"
    assert data["nearest_police_station"]["phone"] == "+8802223362144"
    assert "google.com/maps/dir" in data["nearest_police_station"]["directions_url"]

    # 3. Nearest Police Box
    assert data["nearest_police_box"] is not None
    assert "Dhanmondi 27" in data["nearest_police_box"]["name"]
    assert data["nearest_police_box"]["distance_km"] < 2.0

    # 4. Nearby list
    assert len(data["nearby_services"]) > 0
    # Verify sorting ascending by distance
    distances = [s["distance_km"] for s in data["nearby_services"]]
    assert distances == sorted(distances)


@pytest.mark.asyncio
async def test_nearby_validation_errors(async_client: AsyncClient):
    """Test validation errors for invalid latitude, longitude, or radius."""
    # Invalid latitude
    r1 = await async_client.get("/api/v1/safety/services/nearby?latitude=95.0&longitude=90.0")
    assert r1.status_code == 422

    # Invalid longitude
    r2 = await async_client.get("/api/v1/safety/services/nearby?latitude=23.0&longitude=200.0")
    assert r2.status_code == 422

    # Invalid radius (negative or over 100)
    r3 = await async_client.get("/api/v1/safety/services/nearby?latitude=23.0&longitude=90.0&radius_km=-5.0")
    assert r3.status_code == 422


@pytest.mark.asyncio
async def test_admin_emergency_services_crud_and_rbac(
    async_client: AsyncClient,
    db_session: AsyncSession,
):
    """Test complete Admin CRUD operations and RBAC protection for emergency services directory."""
    # Create test admin and citizen users
    admin_user = User(
        email="admin_safety_test@example.com",
        username="admin_safety_test",
        hashed_password=get_password_hash("AdminPass123!"),
        role=UserRole.ADMIN,
        is_active=True,
    )
    citizen_user = User(
        email="citizen_safety_test@example.com",
        username="citizen_safety_test",
        hashed_password=get_password_hash("CitizenPass123!"),
        role=UserRole.USER,
        is_active=True,
    )
    db_session.add_all([admin_user, citizen_user])
    await db_session.commit()
    await db_session.refresh(admin_user)
    await db_session.refresh(citizen_user)

    admin_token = create_access_token(subject=admin_user.id, role=UserRole.ADMIN.value)
    citizen_token = create_access_token(subject=citizen_user.id, role=UserRole.USER.value)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    citizen_headers = {"Authorization": f"Bearer {citizen_token}"}

    # 1. Unauthenticated request rejected
    r_unauth = await async_client.get("/api/v1/admin/emergency-services")
    assert r_unauth.status_code == 401

    # 2. Citizen user rejected (Forbidden)
    r_forbidden = await async_client.get("/api/v1/admin/emergency-services", headers=citizen_headers)
    assert r_forbidden.status_code == 403

    # 3. Admin creates new emergency service
    new_service_payload = {
        "name": "Test Rampura Police Box",
        "name_bn": "রামপুরা পুলিশ বক্স",
        "service_type": "POLICE_BOX",
        "district": "Dhaka",
        "area": "Rampura",
        "address": "Rampura Bridge Intersection, Dhaka",
        "address_bn": "রামপুরা ব্রিজ মোড়, ঢাকা",
        "phone": "+8801320039999",
        "alternate_phone": "999",
        "latitude": 23.7620,
        "longitude": 90.4230,
        "source": "DMP Traffic East",
        "verification_status": "VERIFIED",
        "is_active": True,
    }
    r_create = await async_client.post(
        "/api/v1/admin/emergency-services",
        json=new_service_payload,
        headers=admin_headers,
    )
    assert r_create.status_code == 201
    created_service = r_create.json()
    service_id = created_service["id"]
    assert created_service["name"] == "Test Rampura Police Box"

    # 4. Admin lists and searches
    r_list = await async_client.get(
        f"/api/v1/admin/emergency-services?search=Rampura",
        headers=admin_headers,
    )
    assert r_list.status_code == 200
    assert r_list.json()["total"] >= 1

    # 5. Admin updates service
    r_update = await async_client.put(
        f"/api/v1/admin/emergency-services/{service_id}",
        json={"phone": "+8801320038888", "verification_status": "VERIFIED"},
        headers=admin_headers,
    )
    assert r_update.status_code == 200
    assert r_update.json()["phone"] == "+8801320038888"

    # 6. Admin soft-deletes / deactivates service
    r_delete = await async_client.delete(
        f"/api/v1/admin/emergency-services/{service_id}",
        headers=admin_headers,
    )
    assert r_delete.status_code == 200
    assert r_delete.json()["is_active"] is False
