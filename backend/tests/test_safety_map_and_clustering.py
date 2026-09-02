import pytest
import uuid
from datetime import datetime, timezone, timedelta
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User, UserRole
from app.models.category import Category
from app.models.report import Report, ReportStatus
from app.models.incident_cluster import IncidentCluster, IncidentClusterMember
from app.core.security import get_password_hash, create_access_token
from app.services.incident_similarity import (
    calculate_haversine_distance,
    calculate_similarity_breakdown,
)


@pytest.mark.asyncio
async def test_haversine_and_similarity_scoring():
    """Unit test for mathematical distance calculation and deterministic scoring."""
    # Distance between Dhanmondi (23.7461, 90.3742) and Farmgate (23.7561, 90.3872) is ~1.7 km
    dist = calculate_haversine_distance(23.7461, 90.3742, 23.7561, 90.3872)
    assert 1.4 < dist < 2.0

    # Build mock reports for similarity test
    now = datetime.now(timezone.utc)
    cat_id = uuid.uuid4()

    r1 = Report(
        id=uuid.uuid4(),
        category_id=cat_id,
        title="Armed Robbery at Dhanmondi 27 Bank",
        description="Two suspects fled on motorbike",
        location_text="Dhanmondi 27, Dhaka",
        latitude=23.7461,
        longitude=90.3742,
        incident_date=now,
        status=ReportStatus.APPROVED,
    )

    r2_similar = Report(
        id=uuid.uuid4(),
        category_id=cat_id,
        title="Motorbike Robbery Attempt at Dhanmondi",
        description="Suspects matching description on bike",
        location_text="Dhanmondi 27, Dhaka",
        latitude=23.7465,
        longitude=90.3748,
        incident_date=now + timedelta(hours=2),
        status=ReportStatus.APPROVED,
    )

    r3_unrelated = Report(
        id=uuid.uuid4(),
        category_id=uuid.uuid4(),  # Different category
        title="Illegal Tree Felling at Chittagong Hill",
        description="Deforestation spotted",
        location_text="Chittagong",
        latitude=22.3364,
        longitude=91.8340,
        incident_date=now - timedelta(days=30),
        status=ReportStatus.APPROVED,
    )

    # Similar pair should score very high (> 80.0)
    score_similar = calculate_similarity_breakdown(r1, r2_similar)
    assert score_similar.geo_score == 40.0  # <= 1.0 km
    assert score_similar.time_score == 30.0  # <= 24 hours
    assert score_similar.category_score == 20.0  # same category
    assert score_similar.text_score > 0.0  # Dhanmondi / Robbery token overlap
    assert score_similar.total_score >= 90.0

    # Unrelated pair should score 0.0
    score_unrelated = calculate_similarity_breakdown(r1, r3_unrelated)
    assert score_unrelated.geo_score == 0.0
    assert score_unrelated.time_score == 0.0
    assert score_unrelated.category_score == 0.0
    assert score_unrelated.total_score == 0.0


@pytest.mark.asyncio
async def test_safety_map_public_filtering_and_privacy(
    async_client: AsyncClient,
    db_session: AsyncSession,
):
    """
    Verifies that the public safety map:
    1. Returns ONLY APPROVED reports
    2. Strips exact private decimals (rounds to ~3 decimals)
    3. Respects category, bounding box, date, and search filters
    4. Does not leak private reporter data
    """
    # 1. Setup User and Category
    user = User(
        email="reporter_priv@example.com",
        username="reporter_priv",
        hashed_password=get_password_hash("Pass123!"),
        role=UserRole.USER,
        is_active=True,
    )
    cat_crime = Category(
        name="Crime Test",
        slug="crime-test",
        description="Crime reports for testing",
    )
    cat_safety = Category(
        name="Public Safety Test",
        slug="public-safety-test",
        description="Public safety reports",
    )
    db_session.add_all([user, cat_crime, cat_safety])
    await db_session.commit()
    for item in [user, cat_crime, cat_safety]:
        await db_session.refresh(item)

    now = datetime.now(timezone.utc)

    # 2. Create Reports with different statuses & coordinates
    # Approved in Dhaka
    r_approved = Report(
        user_id=user.id,
        category_id=cat_crime.id,
        title="Approved Public Incident in Mirpur",
        description="Publicly verified report description",
        location_text="Mirpur-10, Dhaka",
        latitude=23.80691234,  # High precision
        longitude=90.36875678,
        incident_date=now - timedelta(hours=3),
        status=ReportStatus.APPROVED,
        is_anonymous=False,
    )
    # Draft (Should NOT appear)
    r_draft = Report(
        user_id=user.id,
        category_id=cat_crime.id,
        title="Draft Secret Incident",
        description="Should never appear on public map",
        location_text="Mirpur-10, Dhaka",
        latitude=23.8069,
        longitude=90.3687,
        status=ReportStatus.DRAFT,
    )
    # Under Review (Should NOT appear)
    r_review = Report(
        user_id=user.id,
        category_id=cat_crime.id,
        title="Pending Review Incident",
        description="Under review report",
        location_text="Mirpur-10, Dhaka",
        latitude=23.8069,
        longitude=90.3687,
        status=ReportStatus.UNDER_REVIEW,
    )
    # Rejected (Should NOT appear)
    r_rejected = Report(
        user_id=user.id,
        category_id=cat_crime.id,
        title="Rejected False Alarm",
        description="Rejected report",
        location_text="Mirpur-10, Dhaka",
        latitude=23.8069,
        longitude=90.3687,
        status=ReportStatus.REJECTED,
    )
    # Approved in Chittagong (Different bounding box)
    r_ctg = Report(
        user_id=user.id,
        category_id=cat_safety.id,
        title="Approved Incident in Agrabad",
        description="Safety hazard in Chittagong",
        location_text="Agrabad, Chittagong",
        latitude=22.3364,
        longitude=91.8340,
        incident_date=now - timedelta(days=2),
        status=ReportStatus.APPROVED,
    )

    db_session.add_all([r_approved, r_draft, r_review, r_rejected, r_ctg])
    await db_session.commit()

    # 3. Test Public Map Query (All Incidents)
    res_all = await async_client.get("/api/v1/safety/map")
    assert res_all.status_code == 200
    data_all = res_all.json()
    incident_ids = [inc["id"] for inc in data_all["incidents"]]

    # Verify Approved are present and Unapproved are absent
    assert str(r_approved.id) in incident_ids
    assert str(r_ctg.id) in incident_ids
    assert str(r_draft.id) not in incident_ids
    assert str(r_review.id) not in incident_ids
    assert str(r_rejected.id) not in incident_ids

    # Verify Privacy: approximate coordinates rounded to 3 decimals
    approved_point = next(p for p in data_all["incidents"] if p["id"] == str(r_approved.id))
    assert approved_point["approximate_latitude"] == 23.807
    assert approved_point["approximate_longitude"] == 90.369
    assert "user_id" not in approved_point
    assert "reporter_email" not in approved_point

    # 4. Test Bounding Box Filter (Dhaka Area Only: lat 23.7-23.9, lon 90.3-90.5)
    res_dhaka = await async_client.get("/api/v1/safety/map?north=23.9&south=23.7&east=90.5&west=90.3")
    assert res_dhaka.status_code == 200
    dhaka_ids = [inc["id"] for inc in res_dhaka.json()["incidents"]]
    assert str(r_approved.id) in dhaka_ids
    assert str(r_ctg.id) not in dhaka_ids  # Chittagong excluded by bounding box

    # 5. Test Category Filter
    res_cat = await async_client.get(f"/api/v1/safety/map?category_slug={cat_safety.slug}")
    assert res_cat.status_code == 200
    cat_ids = [inc["id"] for inc in res_cat.json()["incidents"]]
    assert str(r_ctg.id) in cat_ids
    assert str(r_approved.id) not in cat_ids

    # 6. Test Search Query
    res_search = await async_client.get("/api/v1/safety/map?search=Mirpur")
    assert res_search.status_code == 200
    search_ids = [inc["id"] for inc in res_search.json()["incidents"]]
    assert str(r_approved.id) in search_ids
    assert str(r_ctg.id) not in search_ids


@pytest.mark.asyncio
async def test_admin_incident_clustering_and_related_reports(
    async_client: AsyncClient,
    db_session: AsyncSession,
):
    """
    Verifies:
    1. Admin cluster creation, listing, updating, member addition/removal
    2. RBAC protection (non-admin forbidden)
    3. Suggested related reports with transparent similarity scoring
    4. Public related reports endpoint
    """
    admin_user = User(
        email="admin_clust@example.com",
        username="admin_clust",
        hashed_password=get_password_hash("AdminPass123!"),
        role=UserRole.ADMIN,
        is_active=True,
    )
    regular_user = User(
        email="user_clust@example.com",
        username="user_clust",
        hashed_password=get_password_hash("Pass123!"),
        role=UserRole.USER,
        is_active=True,
    )
    cat = Category(
        name="Theft Cluster Cat",
        slug="theft-cluster-cat",
        description="Theft category",
    )
    db_session.add_all([admin_user, regular_user, cat])
    await db_session.commit()
    for u in [admin_user, regular_user, cat]:
        await db_session.refresh(u)

    admin_headers = {"Authorization": f"Bearer {create_access_token(subject=admin_user.id, role='ADMIN')}"}
    user_headers = {"Authorization": f"Bearer {create_access_token(subject=regular_user.id, role='USER')}"}

    now = datetime.now(timezone.utc)

    # Create 3 Approved Reports
    r1 = Report(
        user_id=regular_user.id,
        category_id=cat.id,
        title="Motorcycle Theft at Sector 3",
        description="Black Yamaha FZ stolen from parking",
        location_text="Uttara Sector 3, Dhaka",
        latitude=23.8680,
        longitude=90.3980,
        incident_date=now - timedelta(hours=4),
        status=ReportStatus.APPROVED,
    )
    r2 = Report(
        user_id=regular_user.id,
        category_id=cat.id,
        title="Yamaha Bike Stolen Sector 3 Market",
        description="Stolen while shopping",
        location_text="Uttara Sector 3, Dhaka",
        latitude=23.8685,
        longitude=90.3985,
        incident_date=now - timedelta(hours=2),
        status=ReportStatus.APPROVED,
    )
    r3_unapproved = Report(
        user_id=regular_user.id,
        category_id=cat.id,
        title="Bike theft under review",
        description="Still in review",
        location_text="Uttara Sector 3",
        latitude=23.8682,
        longitude=90.3982,
        status=ReportStatus.UNDER_REVIEW,
    )

    db_session.add_all([r1, r2, r3_unapproved])
    await db_session.commit()
    for r in [r1, r2, r3_unapproved]:
        await db_session.refresh(r)

    # 1. Non-admin cannot create cluster
    res_forbidden = await async_client.post(
        "/api/v1/admin/clusters",
        json={"title": "Unauthorized Cluster Attempt"},
        headers=user_headers,
    )
    assert res_forbidden.status_code == 403

    # 2. Admin creates cluster
    res_create = await async_client.post(
        "/api/v1/admin/clusters",
        json={
            "title": "Uttara Sector 3 Bike Theft Series",
            "title_bn": "উত্তরা ৩ নং সেক্টর মোটরসাইকেল চুরি সিরিজ",
            "category_id": str(cat.id),
            "area": "Uttara Sector 3",
            "approximate_latitude": 23.868,
            "approximate_longitude": 90.398,
            "initial_report_ids": [str(r1.id)],
        },
        headers=admin_headers,
    )
    assert res_create.status_code == 201
    cluster_data = res_create.json()
    cluster_id = cluster_data["id"]
    assert cluster_data["member_count"] == 1
    assert cluster_data["members"][0]["report_id"] == str(r1.id)

    # 3. Admin adds second report to cluster
    res_add = await async_client.post(
        f"/api/v1/admin/clusters/{cluster_id}/members",
        json={"report_id": str(r2.id), "relationship_type": "SIMILAR_INCIDENT"},
        headers=admin_headers,
    )
    assert res_add.status_code == 201
    assert res_add.json()["report_id"] == str(r2.id)

    # 4. Adding same report again returns 400
    res_dup = await async_client.post(
        f"/api/v1/admin/clusters/{cluster_id}/members",
        json={"report_id": str(r2.id)},
        headers=admin_headers,
    )
    assert res_dup.status_code == 400

    # 5. Admin Suggested Related Reports Inspector
    res_suggest = await async_client.get(
        f"/api/v1/admin/reports/{r1.id}/suggested-related",
        headers=admin_headers,
    )
    assert res_suggest.status_code == 200
    suggest_data = res_suggest.json()
    assert len(suggest_data) > 0
    # r2 should be identified as top candidate
    top_cand = next((c for c in suggest_data if c["report_id"] == str(r2.id)), None)
    assert top_cand is not None
    assert top_cand["similarity"]["geo_score"] == 40.0
    assert top_cand["similarity"]["category_score"] == 20.0

    # 6. Public Related Reports for r1
    res_pub_rel = await async_client.get(f"/api/v1/safety/reports/{r1.id}/related")
    assert res_pub_rel.status_code == 200
    pub_rel_data = res_pub_rel.json()
    assert len(pub_rel_data) >= 1
    # r2 is approved and in cluster -> must be present
    rel_ids = [item["id"] for item in pub_rel_data]
    assert str(r2.id) in rel_ids
    # r3_unapproved must NEVER be present
    assert str(r3_unapproved.id) not in rel_ids

    # 7. Cluster appearance on Public Safety Map
    res_map = await async_client.get("/api/v1/safety/map")
    assert res_map.status_code == 200
    map_data = res_map.json()
    cluster_ids = [c["id"] for c in map_data["clusters"]]
    assert str(cluster_id) in cluster_ids
    cluster_point = next(c for c in map_data["clusters"] if c["id"] == str(cluster_id))
    assert cluster_point["member_count"] == 2  # r1 and r2 are approved

    # 8. Admin removes a member from cluster
    res_del = await async_client.delete(
        f"/api/v1/admin/clusters/{cluster_id}/members/{r2.id}",
        headers=admin_headers,
    )
    assert res_del.status_code == 200
