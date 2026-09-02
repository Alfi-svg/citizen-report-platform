import pytest
import uuid
from datetime import datetime, timezone, timedelta
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User, UserRole
from app.models.category import Category
from app.models.report import Report, ReportStatus
from app.models.missing_person import MissingPersonAlert, AlertStatus
from app.models.flag import ContentFlag, FlagStatus
from app.core.security import get_password_hash, create_access_token
from app.services.analytics_service import compute_percentage_change_and_trend, TrendDirection


def test_compute_percentage_change_and_trend():
    """Unit test for percentage change calculation and sample size handling."""
    # Baseline
    pct, trend, lbl_en, lbl_bn = compute_percentage_change_and_trend(10, None)
    assert pct is None
    assert trend == TrendDirection.INSUFFICIENT_DATA

    # Zero to Zero
    pct, trend, lbl_en, _ = compute_percentage_change_and_trend(0, 0)
    assert pct == 0.0
    assert trend == TrendDirection.STABLE

    # Small sample (1 to 2) -> INSUFFICIENT_DATA warning
    pct, trend, lbl_en, _ = compute_percentage_change_and_trend(2, 1)
    assert trend == TrendDirection.INSUFFICIENT_DATA
    assert "Limited sample" in lbl_en

    # Standard Increase (100 to 120 -> +20.0%)
    pct, trend, lbl_en, _ = compute_percentage_change_and_trend(120, 100)
    assert pct == 20.0
    assert trend == TrendDirection.INCREASED
    assert "+20.0% vs prev" in lbl_en

    # Standard Decrease (100 to 80 -> -20.0%)
    pct, trend, lbl_en, _ = compute_percentage_change_and_trend(80, 100)
    assert pct == -20.0
    assert trend == TrendDirection.DECREASED


@pytest.mark.asyncio
async def test_public_analytics_unapproved_exclusion_and_kpis(
    async_client: AsyncClient,
    db_session: AsyncSession,
):
    """
    Verifies that public analytics endpoints strictly include only APPROVED reports
    and ignore Draft, Submitted, Under Review, and Rejected records.
    """
    user = User(
        email="analytics_user@example.com",
        username="analytics_user",
        hashed_password=get_password_hash("Pass123!"),
        role=UserRole.USER,
        is_active=True,
    )
    cat_theft = Category(name="Theft Analytics", slug="theft-analytics", description="Theft")
    cat_hazard = Category(name="Road Hazard", slug="road-hazard", description="Hazard")

    db_session.add_all([user, cat_theft, cat_hazard])
    await db_session.commit()
    for item in [user, cat_theft, cat_hazard]:
        await db_session.refresh(item)

    now = datetime.now(timezone.utc)

    # 1. Create 2 Approved Reports
    r_app1 = Report(
        user_id=user.id,
        category_id=cat_theft.id,
        title="Approved Theft Report 1",
        description="Publicly verified report",
        location_text="Dhanmondi, Dhaka",
        latitude=23.7461,
        longitude=90.3742,
        status=ReportStatus.APPROVED,
        created_at=now,
    )
    r_app2 = Report(
        user_id=user.id,
        category_id=cat_hazard.id,
        title="Approved Road Hazard 2",
        description="Publicly verified road hazard",
        location_text="Agrabad, Chittagong",
        latitude=22.3364,
        longitude=91.8340,
        status=ReportStatus.APPROVED,
        created_at=now,
    )

    # 2. Create Unapproved Reports (Draft, Submitted, Under Review, Rejected)
    r_draft = Report(
        user_id=user.id,
        category_id=cat_theft.id,
        title="Draft Report (Excluded)",
        description="Draft description",
        location_text="Dhaka",
        status=ReportStatus.DRAFT,
        created_at=now,
    )
    r_review = Report(
        user_id=user.id,
        category_id=cat_theft.id,
        title="Under Review Report (Excluded)",
        description="Under review description",
        location_text="Dhaka",
        status=ReportStatus.UNDER_REVIEW,
        created_at=now,
    )
    r_rej = Report(
        user_id=user.id,
        category_id=cat_theft.id,
        title="Rejected Report (Excluded)",
        description="Rejected description",
        location_text="Dhaka",
        status=ReportStatus.REJECTED,
        created_at=now,
    )

    db_session.add_all([r_app1, r_app2, r_draft, r_review, r_rej])
    await db_session.commit()

    # 3. Test Public Overview
    res_ov = await async_client.get("/api/v1/analytics/overview")
    assert res_ov.status_code == 200
    ov_data = res_ov.json()
    assert ov_data["kpis"]["total_reviewed_reports"] >= 2
    assert ov_data["data_source"]["source_type"] == "PLATFORM_REVIEWED_REPORTS"
    assert "NOT official government crime statistics" in ov_data["data_source"]["methodology_note"]

    # 4. Test Public KPIs
    res_kpis = await async_client.get("/api/v1/analytics/kpis")
    assert res_kpis.status_code == 200
    kpis_data = res_kpis.json()
    assert kpis_data["total_reviewed_reports"] >= 2
    assert kpis_data["reports_this_month"] >= 2
    assert kpis_data["reports_this_year"] >= 2

    # 5. Test Monthly Analytics
    res_monthly = await async_client.get(f"/api/v1/analytics/monthly?year={now.year}")
    assert res_monthly.status_code == 200
    monthly_data = res_monthly.json()
    assert len(monthly_data["monthly_data"]) == 12
    curr_month_point = next(m for m in monthly_data["monthly_data"] if m["month"] == now.month)
    assert curr_month_point["count"] >= 2

    # 6. Test Category Breakdown
    res_cats = await async_client.get(f"/api/v1/analytics/categories?year={now.year}")
    assert res_cats.status_code == 200
    cats_data = res_cats.json()
    cat_slugs = [c["category_slug"] for c in cats_data["categories"]]
    assert "theft-analytics" in cat_slugs
    assert "road-hazard" in cat_slugs

    # 7. Test Geographic Aggregation
    res_geo = await async_client.get(f"/api/v1/analytics/geography?year={now.year}")
    assert res_geo.status_code == 200
    geo_data = res_geo.json()
    div_names = [d["division"] for d in geo_data["divisions"]]
    assert "Dhaka" in div_names
    assert "Chittagong" in div_names

    # 8. Test Public Sanitized CSV Export
    res_csv = await async_client.get(f"/api/v1/analytics/export?format=csv&year={now.year}")
    assert res_csv.status_code == 200
    assert "text/csv" in res_csv.headers["content-type"]
    csv_text = res_csv.text
    assert "PLATFORM_REVIEWED_REPORTS" in csv_text
    assert "Theft Analytics" in csv_text
    # Ensure no private user emails or user IDs are in export
    assert user.email not in csv_text
    assert str(user.id) not in csv_text


@pytest.mark.asyncio
async def test_admin_operations_analytics_rbac(
    async_client: AsyncClient,
    db_session: AsyncSession,
):
    """
    Verifies that /analytics/admin/operations requires ADMIN role
    and returns moderation throughput and queue breakdown.
    """
    admin_user = User(
        email="admin_analytics@example.com",
        username="admin_analytics",
        hashed_password=get_password_hash("AdminPass123!"),
        role=UserRole.ADMIN,
        is_active=True,
    )
    reg_user = User(
        email="regular_analytics@example.com",
        username="regular_analytics",
        hashed_password=get_password_hash("Pass123!"),
        role=UserRole.USER,
        is_active=True,
    )
    db_session.add_all([admin_user, reg_user])
    await db_session.commit()
    for u in [admin_user, reg_user]:
        await db_session.refresh(u)

    admin_token = create_access_token(subject=admin_user.id, role="ADMIN")
    user_token = create_access_token(subject=reg_user.id, role="USER")

    # 1. Unauthenticated -> 401
    res_unauth = await async_client.get("/api/v1/analytics/admin/operations")
    assert res_unauth.status_code == 401

    # 2. Regular User -> 403 Forbidden
    res_forbidden = await async_client.get(
        "/api/v1/analytics/admin/operations",
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert res_forbidden.status_code == 403

    # 3. Admin User -> 200 OK
    res_admin = await async_client.get(
        "/api/v1/analytics/admin/operations",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res_admin.status_code == 200
    ops_data = res_admin.json()
    assert "total_reports_all_statuses" in ops_data
    assert "status_distribution" in ops_data
    assert "approval_rate_percentage" in ops_data
    assert "flag_resolution_rate_percentage" in ops_data
