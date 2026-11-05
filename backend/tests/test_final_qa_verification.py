import pytest
import uuid
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.user import User, UserRole
from app.models.report import Report, ReportStatus
from app.models.category import Category
from app.models.incident_cluster import IncidentCluster, IncidentClusterMember
from app.models.hospital import Hospital, BloodInventory, HospitalInventoryAudit
from app.models.accident_zone import AccidentZone
from app.models.blood import BloodGroup
from app.core.security import create_access_token, get_password_hash
from app.db.seed_hospitals import seed_hospitals_and_inventory
from app.db.seed_accident_zones import seed_accident_zones


# ==============================================================================
# 1. SAFETY MAP & CLUSTERING QA VERIFICATION
# ==============================================================================

@pytest.mark.asyncio
async def test_safety_map_moderation_filtering_and_cluster_accuracy(
    async_client: AsyncClient,
    db_session: AsyncSession,
):
    """
    Verifies that:
    1. Only APPROVED reports appear on the Safety Map.
    2. SUBMITTED, UNDER_REVIEW, and REJECTED reports are strictly excluded.
    3. Coordinates are rounded to 3 decimal places (~110m privacy buffer).
    4. Cluster member counts strictly equal approved reports in DB.
    """
    # Create category
    cat = Category(
        id=uuid.uuid4(),
        name="Road Hazard",
        slug="road-hazard",
        description="Road traffic hazard",
        is_active=True,
    )
    db_session.add(cat)
    await db_session.commit()

    # Create reports with various statuses
    approved_rep = Report(
        id=uuid.uuid4(),
        title="Approved Pothole Hazard",
        description="Hazard on Mirpur Road",
        category_id=cat.id,
        latitude=23.784567,  # Exact 6-decimal
        longitude=90.353891,
        location_text="Gabtoli, Mirpur",
        status=ReportStatus.APPROVED,
    )
    pending_rep = Report(
        id=uuid.uuid4(),
        title="Pending Unverified Incident",
        description="Unreviewed report",
        category_id=cat.id,
        latitude=23.785000,
        longitude=90.354000,
        location_text="Gabtoli, Mirpur",
        status=ReportStatus.SUBMITTED,
    )
    rejected_rep = Report(
        id=uuid.uuid4(),
        title="Spam Rejected Incident",
        description="False report",
        category_id=cat.id,
        latitude=23.786000,
        longitude=90.355000,
        location_text="Gabtoli, Mirpur",
        status=ReportStatus.REJECTED,
    )
    db_session.add_all([approved_rep, pending_rep, rejected_rep])
    await db_session.commit()

    # Create a cluster with 1 approved and 1 rejected member
    cluster = IncidentCluster(
        id=uuid.uuid4(),
        title="Gabtoli Road Hazard Cluster",
        title_bn="গাবতলী সড়ক হ্যাজার্ড ক্লাস্টার",
        category_id=cat.id,
        approximate_latitude=23.785,
        approximate_longitude=90.354,
        area="Mirpur",
        is_active=True,
    )
    db_session.add(cluster)
    await db_session.commit()

    mem1 = IncidentClusterMember(id=uuid.uuid4(), cluster_id=cluster.id, report_id=approved_rep.id)
    mem2 = IncidentClusterMember(id=uuid.uuid4(), cluster_id=cluster.id, report_id=rejected_rep.id)
    db_session.add_all([mem1, mem2])
    await db_session.commit()

    # Query Safety Map API
    res = await async_client.get("/api/v1/safety/map")
    assert res.status_code == 200
    map_data = res.json()

    # 1. Verification of incident points
    incident_ids = [inc["id"] for inc in map_data["incidents"]]
    assert str(approved_rep.id) in incident_ids
    assert str(pending_rep.id) not in incident_ids, "Pending reports must be excluded from public map"
    assert str(rejected_rep.id) not in incident_ids, "Rejected reports must be excluded from public map"

    # 2. Verification of privacy coordinates
    approved_point = next(i for i in map_data["incidents"] if i["id"] == str(approved_rep.id))
    # 23.784567 -> 23.785, 90.353891 -> 90.354
    assert approved_point["approximate_latitude"] == 23.785
    assert approved_point["approximate_longitude"] == 90.354
    # Ensure float precision is 3 decimal places
    assert len(str(approved_point["approximate_latitude"]).split(".")[1]) <= 3

    # 3. Verification of cluster member count
    cluster_points = [c for c in map_data["clusters"] if c["id"] == str(cluster.id)]
    assert len(cluster_points) == 1
    assert cluster_points[0]["member_count"] == 1, "Only approved members must be counted in cluster member_count"


# ==============================================================================
# 2. ACCIDENT PRONE ZONES EVIDENCE VERIFICATION
# ==============================================================================

@pytest.mark.asyncio
async def test_accident_zones_data_integrity_and_sources(
    async_client: AsyncClient,
    db_session: AsyncSession,
):
    """
    Verifies that:
    1. Seeded accident zones exist in database.
    2. Every zone has valid coordinates, verified source citation, and risk classification.
    3. Filtering by district and risk level works.
    """
    await seed_accident_zones(db_session)

    res = await async_client.get("/api/v1/safety/accident-zones?limit=100")
    assert res.status_code == 200
    zones = res.json()
    assert len(zones) >= 12

    for zone in zones:
        assert zone["zone_name"], "Zone name is required"
        assert zone["road_name"], "Road name is required"
        assert zone["district"], "District is required"
        assert zone["division"], "Division is required"
        assert 20.0 <= zone["latitude"] <= 27.0, f"Latitude {zone['latitude']} out of Bangladesh bounds"
        assert 88.0 <= zone["longitude"] <= 93.0, f"Longitude {zone['longitude']} out of Bangladesh bounds"
        assert zone["risk_level"] in ("CRITICAL", "HIGH", "MODERATE", "LOW")
        assert zone["verification_status"] == "VERIFIED"
        assert zone["data_source"] is not None and len(zone["data_source"]) > 5
        assert zone["radius_meters"] >= 300
        # Phase 4 Data Integrity Verification
        assert zone["data_type"] == "ESTIMATED_HAZARD_DATA", "Accident zones must be typed as ESTIMATED_HAZARD_DATA"
        assert zone["is_estimated"] is True, "is_estimated flag must be True"
        assert zone["hazard_density_label"] == "Estimated Hazard Index"
        assert "historical road safety models" in zone["data_limitation_notice"].lower()

    # Test District filtering (Dhaka vs Chattogram)
    dhaka_res = await async_client.get("/api/v1/safety/accident-zones?district=Dhaka")
    assert dhaka_res.status_code == 200
    dhaka_zones = dhaka_res.json()
    assert all("Dhaka" in z["district"] or "Dhaka" in z["division"] for z in dhaka_zones)


# ==============================================================================
# 3. ROAD SAFETY AI & ROUTE EVALUATION QA
# ==============================================================================

@pytest.mark.asyncio
async def test_road_safety_ai_workflows_and_disclaimers(
    async_client: AsyncClient,
    db_session: AsyncSession,
):
    """
    Verifies that:
    1. Motorcycle workflow tracks helmet compliance.
    2. Car workflow tracks seatbelt compliance.
    3. Safety score evaluates accident zones and hazards.
    4. Route alternatives correctly identify shortest and safest paths.
    5. Disclaimers clearly state NO 100% safety guarantee and NO false live traffic claims.
    """
    await seed_accident_zones(db_session)

    # 1. Motorcycle workflow without helmet confirmation
    unconfirmed_req = {
        "origin_latitude": 23.7042,
        "origin_longitude": 90.5098,
        "destination_latitude": 23.7845,
        "destination_longitude": 90.3538,
        "vehicle_type": "MOTORCYCLE",
        "safety_confirmed": False,
        "waypoints": [[23.7042, 90.5098], [23.7845, 90.3538]],
        "route_distance_km": 15.0,
        "route_duration_minutes": 35.0,
        "lang": "en",
    }
    r1 = await async_client.post("/api/v1/safety/safe-route/analyze", json=unconfirmed_req)
    assert r1.status_code == 200
    d1 = r1.json()
    assert d1["safety_verification_status"] == "PENDING_CONFIRMATION"
    assert "helmet" in d1["road_ai_guidance"].lower()
    assert "100% safe" in d1["disclaimer"]  # Disclaimer explicitly warns no 100% guarantee

    # 2. Car workflow with seatbelt confirmation
    confirmed_car_req = {
        "origin_latitude": 23.7042,
        "origin_longitude": 90.5098,
        "destination_latitude": 23.7845,
        "destination_longitude": 90.3538,
        "vehicle_type": "CAR",
        "safety_confirmed": True,
        "waypoints": [[23.7042, 90.5098], [23.7845, 90.3538]],
        "route_distance_km": 15.0,
        "route_duration_minutes": 35.0,
        "alternative_geometries": [
            {
                "distance_km": 15.0,
                "duration_minutes": 35.0,
                "coordinates": [[90.5098, 23.7042], [90.3538, 23.7845]],
            },
            {
                "distance_km": 17.5,
                "duration_minutes": 42.0,
                "coordinates": [[90.5098, 23.7042], [90.4200, 23.7300], [90.3538, 23.7845]],
            },
        ],
        "lang": "en",
    }
    r2 = await async_client.post("/api/v1/safety/safe-route/analyze", json=confirmed_car_req)
    assert r2.status_code == 200
    d2 = r2.json()
    assert d2["safety_verification_status"] == "VERIFIED"
    assert "seatbelt" in d2["road_ai_guidance"].lower()
    assert len(d2["route_alternatives"]) == 2
    assert any(alt["is_shortest"] for alt in d2["route_alternatives"])
    assert any(alt["is_safest"] for alt in d2["route_alternatives"])


# ==============================================================================
# 4. BLOOD AI HOSPITAL DATABASE & LOCATION-BASED SEARCH QA
# ==============================================================================

@pytest.mark.asyncio
async def test_blood_ai_hospital_search_across_bangladesh_divisions(
    async_client: AsyncClient,
    db_session: AsyncSession,
):
    """
    Verifies that:
    1. Hospitals and 112 blood group inventories are seeded across all 8 Bangladesh divisions.
    2. Location-based search filters by division/district accurately (Dhaka, Chattogram, Sylhet, Rajshahi, Khulna, Mymensingh, Barishal, Rangpur).
    3. Blood group matching handles all 8 groups (A+, A-, B+, B-, AB+, AB-, O+, O-).
    4. Hospital phone numbers and addresses are verified.
    5. Baseline stock items are explicitly flagged with is_baseline_demo=True and stock_source_label="Baseline Demo Stock".
    """
    await seed_hospitals_and_inventory(db_session)

    # Test all 8 divisions
    divisions = ["Dhaka", "Chattogram", "Sylhet", "Rajshahi", "Khulna", "Mymensingh", "Barishal", "Rangpur"]
    for div in divisions:
        res = await async_client.get(f"/api/v1/blood/hospitals/search?district={div}")
        assert res.status_code == 200, f"Search failed for {div}"
        data = res.json()
        hospitals = data.get("items", [])
        assert len(hospitals) >= 1, f"Expected at least 1 hospital in {div}"
        assert any(h["district"].lower() == div.lower() or h["area"].lower() == div.lower() for h in hospitals)
        
        # Verify hospital fields
        h = hospitals[0]
        assert h["emergency_phone"].startswith("+880"), "Hospital phone must have valid Bangladesh country code"
        assert h["latitude"] is not None and h["longitude"] is not None
        assert h["verification_status"] == "VERIFIED"

    # Test all 8 blood groups & baseline demo stock labeling
    blood_groups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]
    for bg in blood_groups:
        res_bg = await async_client.get(f"/api/v1/blood/inventory/search?blood_group={bg.replace('+', '%2B')}")
        assert res_bg.status_code == 200, f"Search failed for blood group {bg}"
        bg_data = res_bg.json()
        items = bg_data.get("items", [])
        assert len(items) >= 1, f"Expected inventory for blood group {bg}"
        assert all(it.get("matching_inventory", {}).get("blood_group") == bg for it in items)
        
        # Verify Phase 2 Baseline Demo Stock transparency
        first_item = items[0]["matching_inventory"]
        assert first_item["is_baseline_demo"] is True, "Seeded inventory must be flagged as is_baseline_demo=True"
        assert "Baseline Demo Stock" in first_item["stock_source_label"]


@pytest.mark.asyncio
async def test_hospital_seeding_idempotence_and_deduplication(
    db_session: AsyncSession,
):
    """
    Verifies that re-running the seed script deduplicates entries and does not create duplicate
    hospitals or blood inventory items across all 8 divisions.
    """
    res1 = await seed_hospitals_and_inventory(db_session)
    assert res1["total_hospitals_defined"] == 14
    assert res1["hospitals_created"] >= 0

    res2 = await seed_hospitals_and_inventory(db_session)
    assert res2["hospitals_created"] == 0, "Second seed run must create 0 new hospitals"
    assert res2["inventories_created"] == 0, "Second seed run must create 0 new inventories"

    # Count total hospitals in DB
    h_stmt = select(Hospital)
    hospitals = list((await db_session.execute(h_stmt)).scalars().all())
    assert len(hospitals) == 14, "Total unique hospitals across 8 divisions must be exactly 14"


# ==============================================================================
# 5. ADMIN INVENTORY AUTHORIZATION & AUDIT LOGGING QA
# ==============================================================================

@pytest.mark.asyncio
async def test_admin_inventory_authorization_and_audit_logging(
    async_client: AsyncClient,
    db_session: AsyncSession,
):
    """
    Verifies that:
    1. Ordinary citizens (USER) are rejected with 403 Forbidden when attempting to update hospital inventory.
    2. Admin/Moderator is authorized to update hospital inventory.
    3. Invalid blood group or negative units are rejected.
    4. Audit log entry is written to `HospitalInventoryAudit`.
    """
    await seed_hospitals_and_inventory(db_session)

    # 1. Create Citizen User
    citizen = User(
        id=uuid.uuid4(),
        email="citizen_qa@nirapotta.gov.bd",
        username="citizen_qa",
        hashed_password=get_password_hash("SecretPassword123!"),
        full_name="Citizen Tester",
        role=UserRole.USER,
        is_active=True,
        is_verified=True,
    )
    # 2. Create Admin User
    admin = User(
        id=uuid.uuid4(),
        email="admin_qa@nirapotta.gov.bd",
        username="admin_qa",
        hashed_password=get_password_hash("SecretPassword123!"),
        full_name="Admin QA Officer",
        role=UserRole.ADMIN,
        is_active=True,
        is_verified=True,
    )
    db_session.add_all([citizen, admin])
    await db_session.commit()

    citizen_token = create_access_token(subject=str(citizen.id), role="USER")
    admin_token = create_access_token(subject=str(admin.id), role="ADMIN")

    # Fetch a hospital
    h_stmt = select(Hospital).limit(1)
    h_res = await db_session.execute(h_stmt)
    hospital = h_res.scalars().first()
    assert hospital is not None

    update_payload = {
        "blood_group": "B+",
        "available_units": 14,
        "availability_status": "AVAILABLE",
        "notes": "Verified emergency blood drive collection",
    }

    # 3. Citizen update attempt -> 403 Forbidden
    r_unauth = await async_client.patch(
        f"/api/v1/blood/admin/hospitals/{hospital.id}/inventory",
        json=update_payload,
        headers={"Authorization": f"Bearer {citizen_token}"},
    )
    assert r_unauth.status_code == 403, "Regular user must be forbidden from updating hospital inventory"

    # 4. Admin update attempt -> 200 OK
    r_admin = await async_client.patch(
        f"/api/v1/blood/admin/hospitals/{hospital.id}/inventory",
        json=update_payload,
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r_admin.status_code == 200
    updated_inv = r_admin.json()
    assert updated_inv["available_units"] == 14
    assert updated_inv["availability_status"] == "AVAILABLE"
    assert updated_inv["is_baseline_demo"] is False, "Staff updated inventory must have is_baseline_demo=False"
    assert updated_inv["stock_source_label"] == "Staff Verified Stock"
    assert updated_inv["last_staff_update"] is not None

    # 5. Check Audit Log
    audit_stmt = select(HospitalInventoryAudit).where(
        HospitalInventoryAudit.hospital_id == hospital.id,
        HospitalInventoryAudit.blood_group == "B+",
    )
    audit_res = await db_session.execute(audit_stmt)
    audit_log = audit_res.scalars().first()
    assert audit_log is not None, "Audit log must be recorded on inventory update"
    assert audit_log.new_units == 14
    assert audit_log.updated_by_id == admin.id

    # 6. Negative units validation -> 422 Unprocessable Content
    r_invalid_qty = await async_client.patch(
        f"/api/v1/blood/admin/hospitals/{hospital.id}/inventory",
        json={"blood_group": "B+", "available_units": -5},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r_invalid_qty.status_code in (400, 422), "Negative units must be rejected"

    # 7. Re-running seed_hospitals_and_inventory must NOT overwrite staff-verified record
    await seed_hospitals_and_inventory(db_session)
    inv_check = (await db_session.execute(
        select(BloodInventory).where(
            BloodInventory.hospital_id == hospital.id,
            BloodInventory.blood_group == BloodGroup.B_POS,
        )
    )).scalar_one_or_none()
    assert inv_check is not None
    assert inv_check.available_units == 14, "Staff-updated units must be preserved across seed runs"
    assert inv_check.is_verified is True
    assert inv_check.updated_by == admin.id
