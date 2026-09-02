import enum
import uuid
from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class AnalyticsDataSourceType(str, enum.Enum):
    PLATFORM_REVIEWED_REPORTS = "PLATFORM_REVIEWED_REPORTS"
    OFFICIAL_SOURCE = "OFFICIAL_SOURCE"
    THIRD_PARTY_DATASET = "THIRD_PARTY_DATASET"
    IMPORTED_DATASET = "IMPORTED_DATASET"


class TrendDirection(str, enum.Enum):
    INCREASED = "INCREASED"
    DECREASED = "DECREASED"
    STABLE = "STABLE"
    INSUFFICIENT_DATA = "INSUFFICIENT_DATA"


class AnalyticsDataSourceInfo(BaseModel):
    source_type: AnalyticsDataSourceType = AnalyticsDataSourceType.PLATFORM_REVIEWED_REPORTS
    source_name: str = "Bangladesh Citizen Report Platform Verified Reports"
    source_name_bn: str = "বাংলাদেশ সিটিজেন রিপোর্ট প্ল্যাটফর্ম যাচাইকৃত প্রতিবেদন"
    coverage_start: Optional[datetime] = None
    coverage_end: Optional[datetime] = None
    last_verified_at: datetime = Field(default_factory=datetime.utcnow)
    methodology_note: str = (
        "Calculated strictly from platform-reviewed citizen submissions approved by moderation. "
        "These figures represent citizen reports received and reviewed by this platform, "
        "and are NOT official government crime statistics or proof of proven allegations."
    )
    methodology_note_bn: str = (
        "শুধুমাত্র প্ল্যাটফর্মের মডারেশন টিম কর্তৃক যাচাই ও অনুমোদিত নাগরিক প্রতিবেদনের উপর ভিত্তি করে তৈরি। "
        "এই পরিসংখ্যানসমূহ প্ল্যাটফর্মে গৃহীত ও পর্যালোচিত প্রতিবেদন নির্দেশ করে এবং এগুলো কোনোভাবেই সরকারি "
        "বা প্রাতিষ্ঠানিক অপরাধ পরিসংখ্যান অথবা প্রমাণিত অপরাধের চূড়ান্ত প্রমাণ নয়।"
    )


# 1. KPI Cards Schema
class KPICardsResponse(BaseModel):
    total_reviewed_reports: int
    reports_this_month: int
    reports_this_year: int
    active_missing_alerts: int
    total_categories: int
    total_districts: int
    approval_rate_percentage: float = 100.0
    last_updated_at: datetime
    data_source: AnalyticsDataSourceInfo


# 2. Monthly Trend Schemas
class MonthlyDataPoint(BaseModel):
    year: int
    month: int
    month_name: str
    month_name_bn: str
    count: int
    prev_month_count: Optional[int] = None
    percentage_change: Optional[float] = None
    trend: TrendDirection
    trend_label: str
    trend_label_bn: str


class MonthlyAnalyticsResponse(BaseModel):
    year: int
    total_reports_for_year: int
    category_id: Optional[uuid.UUID] = None
    category_name: Optional[str] = None
    district: Optional[str] = None
    monthly_data: List[MonthlyDataPoint]
    sample_size_note: str
    last_updated_at: datetime
    data_source: AnalyticsDataSourceInfo


# 3. Yearly Trend Schemas
class YearlyDataPoint(BaseModel):
    year: int
    count: int
    prev_year_count: Optional[int] = None
    percentage_change: Optional[float] = None
    trend: TrendDirection
    trend_label: str
    trend_label_bn: str


class YearlyAnalyticsResponse(BaseModel):
    available_years: List[int]
    category_id: Optional[uuid.UUID] = None
    category_name: Optional[str] = None
    district: Optional[str] = None
    yearly_data: List[YearlyDataPoint]
    last_updated_at: datetime
    data_source: AnalyticsDataSourceInfo


# 4. Category Breakdown Schemas
class CategoryAnalyticsItem(BaseModel):
    category_id: uuid.UUID
    category_name: str
    category_slug: str
    count: int
    percentage_share: float
    prev_period_count: Optional[int] = None
    percentage_change: Optional[float] = None
    trend: TrendDirection


class CategoryAnalyticsResponse(BaseModel):
    total_reviewed_reports: int
    year_filter: Optional[int] = None
    month_filter: Optional[int] = None
    categories: List[CategoryAnalyticsItem]
    last_updated_at: datetime
    data_source: AnalyticsDataSourceInfo


# 5. Geographic Breakdown Schemas
class GeographicAnalyticsItem(BaseModel):
    division: Optional[str] = None
    district: Optional[str] = None
    area: Optional[str] = None
    report_count: int
    percentage_share: float
    approximate_latitude: Optional[float] = None
    approximate_longitude: Optional[float] = None


class GeographicAnalyticsResponse(BaseModel):
    total_geocoded_reports: int
    year_filter: Optional[int] = None
    divisions: List[GeographicAnalyticsItem]
    districts: List[GeographicAnalyticsItem]
    clusters_count: int
    last_updated_at: datetime
    data_source: AnalyticsDataSourceInfo


# 6. Combined Public Transparency Overview Bundle
class PublicTransparencyOverviewResponse(BaseModel):
    kpis: KPICardsResponse
    monthly: MonthlyAnalyticsResponse
    yearly: YearlyAnalyticsResponse
    categories: CategoryAnalyticsResponse
    geography: GeographicAnalyticsResponse
    last_updated_at: datetime
    data_source: AnalyticsDataSourceInfo


# 7. Admin Operations Analytics Schemas
class StatusDistributionItem(BaseModel):
    status: str
    count: int
    percentage: float


class ModeratorPerformanceItem(BaseModel):
    admin_id: uuid.UUID
    admin_name: str
    actions_count: int
    approved_count: int
    rejected_count: int
    info_requested_count: int


class AdminOperationsAnalyticsResponse(BaseModel):
    total_reports_all_statuses: int
    pending_review_count: int
    draft_count: int
    approved_count: int
    rejected_count: int
    needs_more_info_count: int
    archived_count: int
    approval_rate_percentage: float
    rejection_rate_percentage: float
    status_distribution: List[StatusDistributionItem]
    avg_review_turnaround_hours: Optional[float] = None
    total_flags: int
    pending_flags: int
    resolved_flags: int
    flag_resolution_rate_percentage: float
    total_missing_alerts: int
    active_missing_alerts: int
    found_missing_alerts: int
    missing_resolution_rate_percentage: float
    moderator_performance: List[ModeratorPerformanceItem]
    last_updated_at: datetime
