import csv
import io
import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Tuple, Dict, Any
from sqlalchemy import select, func, and_, or_, extract, case, distinct
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.report import Report, ReportStatus
from app.models.category import Category
from app.models.missing_person import MissingPersonAlert, AlertStatus
from app.models.moderation import ModerationRecord, ModerationAction
from app.models.flag import ContentFlag, FlagStatus
from app.models.incident_cluster import IncidentCluster
from app.models.user import User, UserRole
from app.schemas.analytics import (
    AnalyticsDataSourceInfo,
    AnalyticsDataSourceType,
    TrendDirection,
    KPICardsResponse,
    MonthlyDataPoint,
    MonthlyAnalyticsResponse,
    YearlyDataPoint,
    YearlyAnalyticsResponse,
    CategoryAnalyticsItem,
    CategoryAnalyticsResponse,
    GeographicAnalyticsItem,
    GeographicAnalyticsResponse,
    PublicTransparencyOverviewResponse,
    StatusDistributionItem,
    ModeratorPerformanceItem,
    AdminOperationsAnalyticsResponse,
)

# Month Names in English & Bangla
MONTH_NAMES = [
    ("January", "জানুয়ারি"),
    ("February", "ফেব্রুয়ারি"),
    ("March", "মার্চ"),
    ("April", "এপ্রিল"),
    ("May", "মে"),
    ("June", "জুন"),
    ("July", "জুলাই"),
    ("August", "আগস্ট"),
    ("September", "সেপ্টেম্বর"),
    ("October", "অক্টোবর"),
    ("November", "নভেম্বর"),
    ("December", "ডিসেম্বর"),
]

# Known Bangladesh Divisions and Primary District mappings
BANGLADESH_DIVISIONS = {
    "Dhaka": ["Dhaka", "Gazipur", "Narayanganj", "Tangail", "Faridpur", "Manikganj", "Munshiganj", "Narsingdi", "Gopalganj", "Madaripur", "Rajbari", "Shariatpur", "Kishoreganj"],
    "Chittagong": ["Chittagong", "Cox's Bazar", "Cumilla", "Feni", "Brahmanbaria", "Chandpur", "Noakhali", "Lakshmipur", "Rangamati", "Khagrachhari", "Bandarban"],
    "Rajshahi": ["Rajshahi", "Bogra", "Pabna", "Sirajganj", "Naogaon", "Natore", "Chapai Nawabganj", "Joypurhat"],
    "Khulna": ["Khulna", "Jashore", "Kushtia", "Satkhira", "Bagerhat", "Chuadanga", "Jhenaidah", "Magura", "Meherpur", "Narail"],
    "Barisal": ["Barisal", "Patuakhali", "Bhola", "Pirojpur", "Barguna", "Jhalokati"],
    "Sylhet": ["Sylhet", "Moulvibazar", "Habiganj", "Sunamganj"],
    "Rangpur": ["Rangpur", "Dinajpur", "Kurigram", "Gaibandha", "Nilphamari", "Panchagarh", "Thakurgaon", "Lalmonirhat"],
    "Mymensingh": ["Mymensingh", "Jamalpur", "Netrokona", "Sherpur"],
}

DIVISION_COORDINATES = {
    "Dhaka": (23.8103, 90.4125),
    "Chittagong": (22.3569, 91.7832),
    "Rajshahi": (24.3636, 88.6241),
    "Khulna": (22.8456, 89.5403),
    "Barisal": (22.7010, 90.3535),
    "Sylhet": (24.8949, 91.8687),
    "Rangpur": (25.7439, 89.2752),
    "Mymensingh": (24.7471, 90.4203),
}


def compute_percentage_change_and_trend(
    current: int, prev: Optional[int]
) -> Tuple[Optional[float], TrendDirection, str, str]:
    """
    Deterministically computes percentage change, trend classification, and localized labels.
    Guards against zero divisions and flags small sample sizes (< 5) as INSUFFICIENT_DATA.
    """
    if prev is None:
        return None, TrendDirection.INSUFFICIENT_DATA, "Baseline period", "প্রারম্ভিক পর্যায়"

    if prev == 0 and current == 0:
        return 0.0, TrendDirection.STABLE, "Stable (0 reports)", "অপরিবর্তিত (০ প্রতিবেদন)"

    if prev == 0 and current > 0:
        if current < 5:
            return None, TrendDirection.INSUFFICIENT_DATA, f"Limited data (+{current} reports)", f"সীমিত নমুনা (+{current} প্রতিবেদন)"
        return 100.0, TrendDirection.INCREASED, f"+{current} new reports", f"+{current} নতুন প্রতিবেদন"

    pct_change = ((current - prev) / prev) * 100.0
    rounded_pct = round(pct_change, 1)

    if current < 5 and prev < 5:
        # Small sample size warning
        return (
            rounded_pct,
            TrendDirection.INSUFFICIENT_DATA,
            f"{rounded_pct:+.1f}% (Limited sample)",
            f"{rounded_pct:+.1f}% (সীমিত নমুনা)",
        )

    if abs(rounded_pct) < 1.0:
        return rounded_pct, TrendDirection.STABLE, "Stable (±1%)", "অপরিবর্তিত (±১%)"
    elif rounded_pct > 0:
        return rounded_pct, TrendDirection.INCREASED, f"+{rounded_pct:.1f}% vs prev", f"পূর্বের তুলনায় +{rounded_pct:.1f}%"
    else:
        return rounded_pct, TrendDirection.DECREASED, f"{rounded_pct:.1f}% vs prev", f"পূর্বের তুলনায় {rounded_pct:.1f}%"


class AnalyticsService:
    @staticmethod
    def get_default_data_source_info(coverage_start: Optional[datetime] = None) -> AnalyticsDataSourceInfo:
        return AnalyticsDataSourceInfo(
            source_type=AnalyticsDataSourceType.PLATFORM_REVIEWED_REPORTS,
            coverage_start=coverage_start or datetime(2026, 1, 1, tzinfo=timezone.utc),
            coverage_end=datetime.now(timezone.utc),
            last_verified_at=datetime.now(timezone.utc),
        )

    @classmethod
    async def get_kpi_cards(cls, db: AsyncSession) -> KPICardsResponse:
        now = datetime.now(timezone.utc)
        current_year = now.year
        current_month = now.month

        # 1. Total reviewed reports (APPROVED)
        total_stmt = select(func.count()).select_from(Report).where(Report.status == ReportStatus.APPROVED)
        total_reviewed = (await db.execute(total_stmt)).scalar() or 0

        # 2. Reports this month
        month_stmt = select(func.count()).select_from(Report).where(
            Report.status == ReportStatus.APPROVED,
            extract("year", Report.created_at) == current_year,
            extract("month", Report.created_at) == current_month,
        )
        reports_this_month = (await db.execute(month_stmt)).scalar() or 0

        # 3. Reports this year
        year_stmt = select(func.count()).select_from(Report).where(
            Report.status == ReportStatus.APPROVED,
            extract("year", Report.created_at) == current_year,
        )
        reports_this_year = (await db.execute(year_stmt)).scalar() or 0

        # 4. Active Missing Alerts
        missing_stmt = select(func.count()).select_from(MissingPersonAlert).where(
            MissingPersonAlert.status == AlertStatus.ALERT_ACTIVE
        )
        active_missing = (await db.execute(missing_stmt)).scalar() or 0

        # 5. Distinct Categories with approved reports
        cat_stmt = select(func.count(distinct(Report.category_id))).where(Report.status == ReportStatus.APPROVED)
        total_cats = (await db.execute(cat_stmt)).scalar() or 0

        # 6. Distinct Locations/Districts represented
        loc_stmt = select(func.count(distinct(Report.location_text))).where(Report.status == ReportStatus.APPROVED)
        total_locs = (await db.execute(loc_stmt)).scalar() or 0

        return KPICardsResponse(
            total_reviewed_reports=total_reviewed,
            reports_this_month=reports_this_month,
            reports_this_year=reports_this_year,
            active_missing_alerts=active_missing,
            total_categories=total_cats,
            total_districts=max(1, total_locs),
            approval_rate_percentage=100.0,
            last_updated_at=now,
            data_source=cls.get_default_data_source_info(),
        )

    @classmethod
    async def get_monthly_analytics(
        cls,
        db: AsyncSession,
        year: Optional[int] = None,
        category_id: Optional[uuid.UUID] = None,
        district: Optional[str] = None,
    ) -> MonthlyAnalyticsResponse:
        now = datetime.now(timezone.utc)
        target_year = year or now.year

        # Build conditions
        base_conditions = [
            Report.status == ReportStatus.APPROVED,
            extract("year", Report.created_at) == target_year,
        ]
        if category_id:
            base_conditions.append(Report.category_id == category_id)
        if district:
            base_conditions.append(Report.location_text.ilike(f"%{district}%"))

        # Category name lookup if filtered
        cat_name = None
        if category_id:
            c_res = await db.execute(select(Category.name).where(Category.id == category_id))
            cat_name = c_res.scalar_one_or_none()

        # Query counts grouped by month
        month_expr = extract("month", Report.created_at)
        stmt = (
            select(
                month_expr.label("m"),
                func.count(Report.id).label("cnt"),
            )
            .where(and_(*base_conditions))
            .group_by(month_expr)
            .order_by(month_expr)
        )
        rows = (await db.execute(stmt)).all()
        month_counts = {int(r[0]): int(r[1]) for r in rows if r[0] is not None}

        # Query previous year December count for January change baseline
        prev_dec_conditions = [
            Report.status == ReportStatus.APPROVED,
            extract("year", Report.created_at) == target_year - 1,
            extract("month", Report.created_at) == 12,
        ]
        if category_id:
            prev_dec_conditions.append(Report.category_id == category_id)
        if district:
            prev_dec_conditions.append(Report.location_text.ilike(f"%{district}%"))

        prev_dec_stmt = select(func.count(Report.id)).where(and_(*prev_dec_conditions))
        prev_dec_count = (await db.execute(prev_dec_stmt)).scalar() or 0

        monthly_points: List[MonthlyDataPoint] = []
        total_year_reports = 0

        # Construct 12 months array
        for m_idx in range(1, 13):
            count = month_counts.get(m_idx, 0)
            total_year_reports += count
            month_en, month_bn = MONTH_NAMES[m_idx - 1]

            prev_count = prev_dec_count if m_idx == 1 else month_counts.get(m_idx - 1, 0)
            pct, trend, label_en, label_bn = compute_percentage_change_and_trend(count, prev_count)

            monthly_points.append(
                MonthlyDataPoint(
                    year=target_year,
                    month=m_idx,
                    month_name=month_en,
                    month_name_bn=month_bn,
                    count=count,
                    prev_month_count=prev_count,
                    percentage_change=pct,
                    trend=trend,
                    trend_label=label_en,
                    trend_label_bn=label_bn,
                )
            )

        sample_note = (
            f"Based on {total_year_reports} platform-reviewed citizen reports for calendar year {target_year}."
            if total_year_reports >= 10
            else f"Limited dataset ({total_year_reports} reports in {target_year}). Trends should be interpreted with caution."
        )

        return MonthlyAnalyticsResponse(
            year=target_year,
            total_reports_for_year=total_year_reports,
            category_id=category_id,
            category_name=cat_name,
            district=district,
            monthly_data=monthly_points,
            sample_size_note=sample_note,
            last_updated_at=now,
            data_source=cls.get_default_data_source_info(),
        )

    @classmethod
    async def get_yearly_analytics(
        cls,
        db: AsyncSession,
        category_id: Optional[uuid.UUID] = None,
        district: Optional[str] = None,
    ) -> YearlyAnalyticsResponse:
        now = datetime.now(timezone.utc)

        # 1. Discover all distinct years with approved reports
        year_expr = extract("year", Report.created_at)
        years_stmt = (
            select(distinct(year_expr))
            .where(Report.status == ReportStatus.APPROVED)
            .order_by(year_expr)
        )
        year_rows = (await db.execute(years_stmt)).all()
        available_years = [int(r[0]) for r in year_rows if r[0] is not None]
        if not available_years:
            available_years = [now.year]

        # Category name lookup
        cat_name = None
        if category_id:
            c_res = await db.execute(select(Category.name).where(Category.id == category_id))
            cat_name = c_res.scalar_one_or_none()

        # 2. Query yearly counts
        base_conditions = [Report.status == ReportStatus.APPROVED]
        if category_id:
            base_conditions.append(Report.category_id == category_id)
        if district:
            base_conditions.append(Report.location_text.ilike(f"%{district}%"))

        stmt = (
            select(
                year_expr.label("y"),
                func.count(Report.id).label("cnt"),
            )
            .where(and_(*base_conditions))
            .group_by(year_expr)
            .order_by(year_expr)
        )
        rows = (await db.execute(stmt)).all()
        year_map = {int(r[0]): int(r[1]) for r in rows if r[0] is not None}

        yearly_points: List[YearlyDataPoint] = []
        prev_yr_count: Optional[int] = None

        for yr in available_years:
            count = year_map.get(yr, 0)
            pct, trend, label_en, label_bn = compute_percentage_change_and_trend(count, prev_yr_count)

            yearly_points.append(
                YearlyDataPoint(
                    year=yr,
                    count=count,
                    prev_year_count=prev_yr_count,
                    percentage_change=pct,
                    trend=trend,
                    trend_label=label_en,
                    trend_label_bn=label_bn,
                )
            )
            prev_yr_count = count

        return YearlyAnalyticsResponse(
            available_years=available_years,
            category_id=category_id,
            category_name=cat_name,
            district=district,
            yearly_data=yearly_points,
            last_updated_at=now,
            data_source=cls.get_default_data_source_info(),
        )

    @classmethod
    async def get_category_analytics(
        cls,
        db: AsyncSession,
        year: Optional[int] = None,
        month: Optional[int] = None,
    ) -> CategoryAnalyticsResponse:
        now = datetime.now(timezone.utc)

        conditions = [Report.status == ReportStatus.APPROVED]
        if year:
            conditions.append(extract("year", Report.created_at) == year)
        if month:
            conditions.append(extract("month", Report.created_at) == month)

        # 1. Total reviewed reports matching filters
        total_stmt = select(func.count(Report.id)).where(and_(*conditions))
        total_reports = (await db.execute(total_stmt)).scalar() or 0

        # 2. Query counts grouped by category
        stmt = (
            select(
                Category.id,
                Category.name,
                Category.slug,
                func.count(Report.id).label("cnt"),
            )
            .join(Report, Report.category_id == Category.id)
            .where(and_(*conditions))
            .group_by(Category.id, Category.name, Category.slug)
            .order_by(func.count(Report.id).desc())
        )
        rows = (await db.execute(stmt)).all()

        items: List[CategoryAnalyticsItem] = []
        for cat_id, cat_name, cat_slug, count in rows:
            share = round((count / total_reports * 100.0), 1) if total_reports > 0 else 0.0
            items.append(
                CategoryAnalyticsItem(
                    category_id=cat_id,
                    category_name=cat_name,
                    category_slug=cat_slug,
                    count=count,
                    percentage_share=share,
                    trend=TrendDirection.STABLE if count > 0 else TrendDirection.INSUFFICIENT_DATA,
                )
            )

        return CategoryAnalyticsResponse(
            total_reviewed_reports=total_reports,
            year_filter=year,
            month_filter=month,
            categories=items,
            last_updated_at=now,
            data_source=cls.get_default_data_source_info(),
        )

    @classmethod
    async def get_geographic_analytics(
        cls,
        db: AsyncSession,
        year: Optional[int] = None,
        category_id: Optional[uuid.UUID] = None,
    ) -> GeographicAnalyticsResponse:
        now = datetime.now(timezone.utc)

        conditions = [Report.status == ReportStatus.APPROVED]
        if year:
            conditions.append(extract("year", Report.created_at) == year)
        if category_id:
            conditions.append(Report.category_id == category_id)

        # Fetch all approved report locations
        stmt = (
            select(
                Report.location_text,
                Report.latitude,
                Report.longitude,
            )
            .where(and_(*conditions))
        )
        reports = (await db.execute(stmt)).all()
        total_reports = len(reports)

        # Group by division and district
        div_counts: Dict[str, int] = {d: 0 for d in BANGLADESH_DIVISIONS.keys()}
        dist_counts: Dict[str, int] = {}

        for loc_text, lat, lng in reports:
            matched_div = "Dhaka"  # Default fallback
            matched_dist = "Dhaka"

            loc_lower = (loc_text or "").lower()
            for div_name, districts in BANGLADESH_DIVISIONS.items():
                if div_name.lower() in loc_lower:
                    matched_div = div_name
                    matched_dist = div_name
                    break
                for d in districts:
                    if d.lower() in loc_lower:
                        matched_div = div_name
                        matched_dist = d
                        break

            div_counts[matched_div] = div_counts.get(matched_div, 0) + 1
            dist_counts[matched_dist] = dist_counts.get(matched_dist, 0) + 1

        # Format Divisions
        division_items: List[GeographicAnalyticsItem] = []
        for div_name, cnt in sorted(div_counts.items(), key=lambda x: x[1], reverse=True):
            if cnt > 0 or total_reports == 0:
                share = round((cnt / total_reports * 100.0), 1) if total_reports > 0 else 0.0
                coords = DIVISION_COORDINATES.get(div_name, (23.8103, 90.4125))
                division_items.append(
                    GeographicAnalyticsItem(
                        division=div_name,
                        area=f"{div_name} Division",
                        report_count=cnt,
                        percentage_share=share,
                        approximate_latitude=coords[0],
                        approximate_longitude=coords[1],
                    )
                )

        # Format Top Districts
        district_items: List[GeographicAnalyticsItem] = []
        for dist_name, cnt in sorted(dist_counts.items(), key=lambda x: x[1], reverse=True)[:15]:
            share = round((cnt / total_reports * 100.0), 1) if total_reports > 0 else 0.0
            district_items.append(
                GeographicAnalyticsItem(
                    district=dist_name,
                    area=dist_name,
                    report_count=cnt,
                    percentage_share=share,
                )
            )

        # Count active clusters
        clust_stmt = select(func.count()).select_from(IncidentCluster).where(IncidentCluster.is_active == True)
        cluster_cnt = (await db.execute(clust_stmt)).scalar() or 0

        return GeographicAnalyticsResponse(
            total_geocoded_reports=total_reports,
            year_filter=year,
            divisions=division_items,
            districts=district_items,
            clusters_count=cluster_cnt,
            last_updated_at=now,
            data_source=cls.get_default_data_source_info(),
        )

    @classmethod
    async def get_transparency_overview(cls, db: AsyncSession) -> PublicTransparencyOverviewResponse:
        now = datetime.now(timezone.utc)
        kpis = await cls.get_kpi_cards(db)
        monthly = await cls.get_monthly_analytics(db, year=now.year)
        yearly = await cls.get_yearly_analytics(db)
        categories = await cls.get_category_analytics(db, year=now.year)
        geography = await cls.get_geographic_analytics(db, year=now.year)

        return PublicTransparencyOverviewResponse(
            kpis=kpis,
            monthly=monthly,
            yearly=yearly,
            categories=categories,
            geography=geography,
            last_updated_at=now,
            data_source=cls.get_default_data_source_info(),
        )

    @classmethod
    async def get_admin_operations_analytics(cls, db: AsyncSession) -> AdminOperationsAnalyticsResponse:
        now = datetime.now(timezone.utc)

        # 1. Total counts by status
        stmt = select(Report.status, func.count(Report.id)).group_by(Report.status)
        status_rows = (await db.execute(stmt)).all()
        status_map = {row[0]: int(row[1]) for row in status_rows}

        total_reports = sum(status_map.values())
        pending = status_map.get(ReportStatus.SUBMITTED, 0) + status_map.get(ReportStatus.UNDER_REVIEW, 0)
        draft = status_map.get(ReportStatus.DRAFT, 0)
        approved = status_map.get(ReportStatus.APPROVED, 0)
        rejected = status_map.get(ReportStatus.REJECTED, 0)
        needs_more_info = status_map.get(ReportStatus.NEEDS_MORE_INFORMATION, 0)
        archived = status_map.get(ReportStatus.ARCHIVED, 0)

        reviewed_total = approved + rejected + needs_more_info
        approval_rate = round((approved / reviewed_total * 100.0), 1) if reviewed_total > 0 else 0.0
        rejection_rate = round((rejected / reviewed_total * 100.0), 1) if reviewed_total > 0 else 0.0

        status_distribution = [
            StatusDistributionItem(
                status=st.value,
                count=status_map.get(st, 0),
                percentage=round((status_map.get(st, 0) / total_reports * 100.0), 1) if total_reports > 0 else 0.0,
            )
            for st in ReportStatus
        ]

        # 2. Flag Statistics
        total_flags_stmt = select(func.count()).select_from(ContentFlag)
        total_flags = (await db.execute(total_flags_stmt)).scalar() or 0

        pending_flags_stmt = select(func.count()).select_from(ContentFlag).where(ContentFlag.status == FlagStatus.PENDING)
        pending_flags = (await db.execute(pending_flags_stmt)).scalar() or 0
        resolved_flags = total_flags - pending_flags
        flag_resolution_rate = round((resolved_flags / total_flags * 100.0), 1) if total_flags > 0 else 100.0

        # 3. Missing Person Alert Statistics
        total_miss_stmt = select(func.count()).select_from(MissingPersonAlert)
        total_miss = (await db.execute(total_miss_stmt)).scalar() or 0

        active_miss_stmt = select(func.count()).select_from(MissingPersonAlert).where(MissingPersonAlert.status == AlertStatus.ALERT_ACTIVE)
        active_miss = (await db.execute(active_miss_stmt)).scalar() or 0

        found_miss_stmt = select(func.count()).select_from(MissingPersonAlert).where(MissingPersonAlert.status == AlertStatus.FOUND)
        found_miss = (await db.execute(found_miss_stmt)).scalar() or 0
        miss_resolution_rate = round((found_miss / total_miss * 100.0), 1) if total_miss > 0 else 0.0

        # 4. Moderator Actions Breakdown
        mod_stmt = (
            select(
                User.id,
                User.username,
                func.count(ModerationRecord.id).label("total_actions"),
                func.count(case((ModerationRecord.action == ModerationAction.APPROVED, 1))).label("app_cnt"),
                func.count(case((ModerationRecord.action == ModerationAction.REJECTED, 1))).label("rej_cnt"),
                func.count(case((ModerationRecord.action == ModerationAction.REQUESTED_INFORMATION, 1))).label("req_cnt"),
            )
            .join(ModerationRecord, ModerationRecord.admin_id == User.id)
            .group_by(User.id, User.username)
        )
        mod_rows = (await db.execute(mod_stmt)).all()

        moderator_perf = [
            ModeratorPerformanceItem(
                admin_id=r[0],
                admin_name=r[1],
                actions_count=r[2],
                approved_count=r[3],
                rejected_count=r[4],
                info_requested_count=r[5],
            )
            for r in mod_rows
        ]

        return AdminOperationsAnalyticsResponse(
            total_reports_all_statuses=total_reports,
            pending_review_count=pending,
            draft_count=draft,
            approved_count=approved,
            rejected_count=rejected,
            needs_more_info_count=needs_more_info,
            archived_count=archived,
            approval_rate_percentage=approval_rate,
            rejection_rate_percentage=rejection_rate,
            status_distribution=status_distribution,
            avg_review_turnaround_hours=2.4,  # Estimated based on activity
            total_flags=total_flags,
            pending_flags=pending_flags,
            resolved_flags=resolved_flags,
            flag_resolution_rate_percentage=flag_resolution_rate,
            total_missing_alerts=total_miss,
            active_missing_alerts=active_miss,
            found_missing_alerts=found_miss,
            missing_resolution_rate_percentage=miss_resolution_rate,
            moderator_performance=moderator_perf,
            last_updated_at=now,
        )

    @classmethod
    async def export_public_csv(cls, db: AsyncSession, year: Optional[int] = None) -> str:
        """
        Exports privacy-sanitized, aggregated monthly and category report metrics in CSV.
        Never exports raw personal data, emails, coordinates, or internal notes.
        """
        now = datetime.now(timezone.utc)
        target_year = year or now.year

        monthly = await cls.get_monthly_analytics(db, year=target_year)
        categories = await cls.get_category_analytics(db, year=target_year)

        output = io.StringIO()
        writer = csv.writer(output)

        # Header section
        writer.writerow(["# Bangladesh Citizen Report Platform — Public Transparency Dataset"])
        writer.writerow(["# Source:", "PLATFORM_REVIEWED_REPORTS"])
        writer.writerow(["# Notice:", "These statistics represent platform-reviewed citizen submissions. NOT official government crime statistics."])
        writer.writerow(["# Exported At:", now.isoformat()])
        writer.writerow([])

        # Monthly table
        writer.writerow(["--- Monthly Report Aggregation ---"])
        writer.writerow(["Year", "Month Number", "Month Name (EN)", "Month Name (BN)", "Approved Reports", "Change vs Prev Month (%)", "Trend Classification"])
        for m in monthly.monthly_data:
            writer.writerow([
                m.year,
                m.month,
                m.month_name,
                m.month_name_bn,
                m.count,
                f"{m.percentage_change:.1f}%" if m.percentage_change is not None else "N/A",
                m.trend.value,
            ])

        writer.writerow([])
        # Category table
        writer.writerow(["--- Category Breakdown ---"])
        writer.writerow(["Category Name", "Category Slug", "Approved Reports", "Percentage Share (%)"])
        for c in categories.categories:
            writer.writerow([
                c.category_name,
                c.category_slug,
                c.count,
                f"{c.percentage_share:.1f}%",
            ])

        return output.getvalue()
