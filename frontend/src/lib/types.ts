export type UserRole = "USER" | "ADMIN" | "MODERATOR";

export type ReportStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "NEEDS_MORE_INFORMATION"
  | "ARCHIVED";

export type ModerationAction =
  | "SUBMITTED"
  | "STARTED_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "REQUESTED_INFORMATION"
  | "ARCHIVED";

export type CommentStatus = "VISIBLE" | "HIDDEN" | "REMOVED";

export type ReactionType = "SUPPORT" | "IMPORTANT";

export interface User {
  id: string;
  email: string;
  username: string;
  full_name: string | null;
  role: UserRole;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type CategoryResponse = Category;

export interface PublicCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  approved_reports_count: number;
}

export interface ReportMedia {
  id: string;
  report_id: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  storage_path: string;
  caption: string | null;
  media_type: "image" | "video" | "document";
  download_url: string;
  created_at: string;
}

export interface PublicMedia {
  id: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  caption: string | null;
  media_type: "image" | "video" | "document";
  download_url: string;
}

export interface PublicComment {
  id: string;
  report_id: string;
  body: string;
  status: CommentStatus;
  created_at: string;
  user_display_name: string;
  is_own_comment: boolean;
}

export interface CommentPagination {
  items: PublicComment[];
  total: number;
  limit: number;
  offset: number;
}

export interface AdminComment {
  id: string;
  report_id: string;
  user_id: string;
  body: string;
  status: CommentStatus;
  created_at: string;
  updated_at: string;
  user?: User | null;
}

export interface ReactionSummary {
  report_id: string;
  support_count: number;
  important_count: number;
  user_reactions: ReactionType[];
}

export interface ReactionToggleResponse {
  report_id: string;
  reaction_type: ReactionType;
  action: "added" | "removed";
  summary: ReactionSummary;
}

export interface ModerationRecord {
  id: string;
  report_id: string;
  admin_id: string | null;
  action: ModerationAction;
  user_message: string | null;
  internal_notes?: string | null;
  created_at: string;
  admin?: User | null;
}

export interface Report {
  id: string;
  user_id: string | null;
  category_id: string;
  title: string;
  description: string;
  location_text: string;
  latitude: number | null;
  longitude: number | null;
  incident_date: string | null;
  is_anonymous: boolean;
  status: ReportStatus;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
  category?: Category | null;
  user?: User | null;
  media?: ReportMedia[];
  moderation_records?: ModerationRecord[];
}

export interface PublicReport {
  id: string;
  category_id: string;
  category?: Category | null;
  title: string;
  description: string;
  location_text: string;
  latitude: number | null;
  longitude: number | null;
  incident_date: string | null;
  submitted_at: string | null;
  created_at: string;
  is_anonymous: boolean;
  reporter_display_name?: string | null;
  media: PublicMedia[];
  media_count: number;
  has_evidence: boolean;
  review_status: string;
}

export interface PublicReportPagination {
  items: PublicReport[];
  total: number;
  limit: number;
  offset: number;
}

export interface ReportCreatePayload {
  title: string;
  description: string;
  category_id: string;
  location_text: string;
  latitude?: number | null;
  longitude?: number | null;
  incident_date?: string | null;
  is_anonymous: boolean;
  status?: ReportStatus;
}

export interface ReportUpdatePayload {
  title?: string;
  description?: string;
  category_id?: string;
  location_text?: string;
  latitude?: number | null;
  longitude?: number | null;
  incident_date?: string | null;
  is_anonymous?: boolean;
  status?: ReportStatus;
}

export interface ModerationActionPayload {
  user_message?: string;
  internal_notes?: string;
}

export interface AdminDashboardStats {
  total_reports: number;
  pending_reports: number;
  under_review_reports: number;
  approved_reports: number;
  rejected_reports: number;
  needs_more_info_reports: number;
  archived_reports: number;
  draft_reports: number;
  total_users: number;
  anonymous_reports_count: number;
  total_flags?: number;
  pending_flags?: number;
  total_comments?: number;
  hidden_comments?: number;
  active_categories?: number;
}

export interface AdminUser {
  id: string;
  email: string;
  username: string;
  full_name?: string | null;
  role: UserRole;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
  report_count: number;
}

export interface AdminUserPagination {
  items: AdminUser[];
  total: number;
  limit: number;
  offset: number;
}

export interface AdminCategory extends Category {
  report_count: number;
  created_at: string;
  updated_at: string;
}

export interface AdminReportPagination {
  items: Report[];
  total: number;
  limit: number;
  offset: number;
}

export interface ApiError {
  detail: string | Array<{ msg: string; loc: string[] }>;
}

export type FlagTargetType = "REPORT" | "COMMENT";

export type FlagStatus = "PENDING" | "REVIEWED" | "DISMISSED" | "ACTION_TAKEN";

export type ReportFlagReason =
  | "FALSE_OR_MISLEADING"
  | "SPAM"
  | "DUPLICATE"
  | "PRIVACY_CONCERN"
  | "HARASSMENT_OR_ABUSE"
  | "INAPPROPRIATE_CONTENT"
  | "OTHER";

export type CommentFlagReason =
  | "SPAM"
  | "HARASSMENT_OR_ABUSE"
  | "HATEFUL_OR_OFFENSIVE"
  | "PERSONAL_INFORMATION"
  | "THREATENING_CONTENT"
  | "INAPPROPRIATE_CONTENT"
  | "OTHER";

export interface FlagResponse {
  id: string;
  target_type: FlagTargetType;
  report_id?: string | null;
  comment_id?: string | null;
  reason: string;
  status: FlagStatus;
  created_at: string;
  message: string;
}

export interface AdminFlag {
  id: string;
  user_id: string;
  target_type: FlagTargetType;
  report_id?: string | null;
  comment_id?: string | null;
  reason: string;
  details?: string | null;
  status: FlagStatus;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  admin_notes?: string | null;
  created_at: string;
  updated_at: string;
  flagger_username?: string | null;
  target_snippet?: string | null;
}

export interface AdminFlagPagination {
  items: AdminFlag[];
  total: number;
  limit: number;
  offset: number;
}

export type NotificationType =
  | "REPORT_SUBMITTED"
  | "REPORT_UNDER_REVIEW"
  | "REPORT_APPROVED"
  | "REPORT_REJECTED"
  | "REPORT_NEEDS_MORE_INFORMATION"
  | "REPORT_ARCHIVED"
  | "COMMENT_MODERATED"
  | "FLAG_REVIEWED";

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  report_id?: string | null;
  comment_id?: string | null;
  read_at?: string | null;
  created_at: string;
}

export interface NotificationUnreadCount {
  unread_count: number;
}

export interface NotificationPagination {
  items: Notification[];
  total: number;
  limit: number;
  offset: number;
}

export type ServiceType = "POLICE_STATION" | "POLICE_BOX" | "FIRE_SERVICE" | "EMERGENCY_SERVICE" | "OTHER";

export type VerificationStatus =
  | "UNVERIFIED"
  | "PENDING_VERIFICATION"
  | "VERIFIED"
  | "NEEDS_REVIEW"
  | "OUTDATED"
  | "INACTIVE"
  | "PENDING_REVIEW";

export interface EmergencyService {
  id: string;
  name: string;
  name_bn?: string | null;
  service_type: ServiceType;
  division?: string | null;
  district: string;
  area: string;
  address: string;
  address_bn?: string | null;
  phone: string;
  alternate_phone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  source: string;
  source_url?: string | null;
  verification_status: VerificationStatus;
  last_verified_at?: string | null;
  verified_by_admin_id?: string | null;
  verification_notes_internal?: string | null;
  is_active: boolean;
  is_fresh?: boolean;
  created_at: string;
  updated_at?: string | null;
}

export interface NearbyServiceResponse {
  id: string;
  name: string;
  name_bn?: string | null;
  service_type: ServiceType;
  division?: string | null;
  district: string;
  area: string;
  address: string;
  address_bn?: string | null;
  phone: string;
  alternate_phone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  source: string;
  source_url?: string | null;
  verification_status: VerificationStatus;
  last_verified_at?: string | null;
  is_fresh: boolean;
  distance_km: number;
  distance_formatted: string;
  directions_url: string;
}

export interface NationalEmergencyResponse {
  number: string;
  name: string;
  name_bn: string;
  description: string;
  description_bn: string;
  call_action: string;
}

export interface NearbyEmergencyServicesResult {
  national_emergency: NationalEmergencyResponse;
  nearest_police_station?: NearbyServiceResponse | null;
  nearest_police_box?: NearbyServiceResponse | null;
  nearby_services: NearbyServiceResponse[];
  search_location?: { latitude: number; longitude: number } | null;
  total_found: number;
  warning_message?: string | null;
}

export interface AreaReference {
  id: string;
  name: string;
  name_bn: string;
  district: string;
  district_bn: string;
  latitude: number;
  longitude: number;
}

export interface AdminEmergencyServicePagination {
  items: EmergencyService[];
  total: number;
  limit: number;
  offset: number;
}

export interface SafetyServiceVerificationAudit {
  id: string;
  service_id: string;
  admin_id?: string | null;
  previous_status: VerificationStatus;
  new_status: VerificationStatus;
  changed_fields?: string | null;
  verification_notes?: string | null;
  source?: string | null;
  source_url?: string | null;
  created_at: string;
}

export interface SafetyDirectoryMetrics {
  total_services: number;
  verified_count: number;
  unverified_count: number;
  needs_review_count: number;
  outdated_count: number;
  inactive_count: number;
  recently_verified_count: number;
}

export interface SafetyServiceDuplicateCandidate {
  service_id: string;
  service_name: string;
  district: string;
  phone: string;
  duplicate_with_id: string;
  duplicate_with_name: string;
  duplicate_with_phone: string;
  reason: string;
}

export interface SafetyServiceVerifyPayload {
  source: string;
  source_url?: string | null;
  verification_notes?: string | null;
}

export type AlertStatus = "ALERT_PENDING" | "ALERT_ACTIVE" | "FOUND" | "EXPIRED" | "CLOSED";

export type SightingStatus = "PENDING" | "APPROVED" | "REJECTED" | "REQUEST_MORE_INFO";

export interface MissingPersonProfile {
  id: string;
  report_id: string;
  full_name: string;
  name_bn?: string | null;
  age?: number | null;
  approximate_age?: string | null;
  gender?: string | null;
  photo_url?: string | null;
  height?: string | null;
  clothing?: string | null;
  clothing_bn?: string | null;
  identifying_features?: string | null;
  identifying_features_bn?: string | null;
  last_seen_location: string;
  last_seen_location_bn?: string | null;
  last_seen_latitude?: number | null;
  last_seen_longitude?: number | null;
  last_seen_time?: string | null;
  description?: string | null;
  contact_information?: string | null;
  reporting_authority?: string | null;
  source?: string | null;
  created_at: string;
  updated_at: string;
}

export interface MissingPersonProfileCreate {
  full_name: string;
  name_bn?: string;
  age?: number | null;
  approximate_age?: string;
  gender?: string;
  photo_url?: string;
  height?: string;
  clothing?: string;
  clothing_bn?: string;
  identifying_features?: string;
  identifying_features_bn?: string;
  last_seen_location: string;
  last_seen_location_bn?: string;
  last_seen_latitude?: number | null;
  last_seen_longitude?: number | null;
  last_seen_time?: string | null;
  description?: string;
  contact_information?: string;
  reporting_authority?: string;
  source?: string;
}

export interface MissingPersonSightingCreate {
  approximate_location: string;
  latitude?: number | null;
  longitude?: number | null;
  sighting_date?: string | null;
  sighting_time?: string | null;
  description: string;
  clothing?: string | null;
  direction?: string | null;
  additional_information?: string | null;
  photo_url?: string | null;
}

export interface PublicMissingPersonSightingResponse {
  id: string;
  alert_id: string;
  approximate_location: string;
  sighting_date?: string | null;
  sighting_time?: string | null;
  description: string;
  clothing?: string | null;
  direction?: string | null;
  photo_url?: string | null;
  status: SightingStatus;
  created_at: string;
}

export interface AdminMissingPersonSightingResponse extends PublicMissingPersonSightingResponse {
  user_id?: string | null;
  additional_information?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  reviewed_by_admin_id?: string | null;
  reviewed_at?: string | null;
  admin_notes?: string | null;
  is_potential_duplicate?: boolean;
  duplicate_reason?: string | null;
}

export interface PublicMissingPersonAlertResponse {
  id: string;
  report_id: string;
  status: AlertStatus;
  is_active: boolean;
  alert_radius_km: number;
  alert_expiry?: string | null;
  activated_at?: string | null;
  found_at?: string | null;
  profile: MissingPersonProfile;
  approved_sightings: PublicMissingPersonSightingResponse[];
  approved_sightings_count: number;
  created_at: string;
}

export interface AdminMissingPersonAlertResponse extends PublicMissingPersonAlertResponse {
  activated_by_admin_id?: string | null;
  activation_notes?: string | null;
  found_by_admin_id?: string | null;
  found_notes?: string | null;
  total_sightings_count: number;
  pending_sightings_count: number;
  duplicate_candidates_count: number;
}

export interface PublicMissingPersonAlertPagination {
  items: PublicMissingPersonAlertResponse[];
  total: number;
  limit: number;
  offset: number;
}

export interface AdminMissingPersonAlertPagination {
  items: AdminMissingPersonAlertResponse[];
  total: number;
  limit: number;
  offset: number;
}

export interface UserNotificationPreference {
  user_id: string;
  missing_person_alerts: boolean;
  nearby_safety_alerts: boolean;
  last_known_latitude?: number | null;
  last_known_longitude?: number | null;
  last_location_updated_at?: string | null;
}

export interface PublicMapIncidentPoint {
  id: string;
  title: string;
  category_name: string;
  category_slug: string;
  location_text: string;
  approximate_latitude: number;
  approximate_longitude: number;
  incident_date?: string | null;
  created_at: string;
  status: string;
  cluster_id?: string | null;
  cluster_title?: string | null;
  is_missing_person: boolean;
  missing_person_alert_id?: string | null;
  missing_person_status?: string | null;
}

export interface PublicMapClusterPoint {
  id: string;
  title: string;
  title_bn?: string | null;
  category_name?: string | null;
  category_slug?: string | null;
  summary?: string | null;
  area?: string | null;
  approximate_latitude: number;
  approximate_longitude: number;
  member_count: number;
  created_at: string;
}

export interface PublicSafetyMapResponse {
  incidents: PublicMapIncidentPoint[];
  clusters: PublicMapClusterPoint[];
  total_incidents: number;
  total_clusters: number;
  applied_filters: Record<string, any>;
}

export interface PublicRelatedReportResponse {
  id: string;
  title: string;
  category_name: string;
  category_slug: string;
  location_text: string;
  approximate_latitude?: number | null;
  approximate_longitude?: number | null;
  incident_date?: string | null;
  created_at: string;
  status: string;
  relationship_type?: string | null;
  similarity_score?: number | null;
}

export interface IncidentClusterMemberResponse {
  id: string;
  cluster_id: string;
  report_id: string;
  report_title: string;
  report_status: string;
  report_category: string;
  relationship_type: string;
  similarity_score?: number | null;
  created_at: string;
}

export interface IncidentClusterDetailResponse {
  id: string;
  title: string;
  title_bn?: string | null;
  category_id?: string | null;
  category_name?: string | null;
  summary?: string | null;
  summary_bn?: string | null;
  approximate_latitude?: number | null;
  approximate_longitude?: number | null;
  area?: string | null;
  is_active: boolean;
  member_count: number;
  members: IncidentClusterMemberResponse[];
  created_at: string;
  updated_at: string;
}

export interface IncidentClusterListResponse {
  items: IncidentClusterDetailResponse[];
  total: number;
  limit: number;
  offset: number;
}

export interface SimilarityBreakdown {
  geo_score: number;
  time_score: number;
  category_score: number;
  text_score: number;
  total_score: number;
  distance_km?: number | null;
  time_diff_hours?: number | null;
}

export interface SuggestedRelatedReportResponse {
  report_id: string;
  title: string;
  category_name: string;
  location_text: string;
  created_at: string;
  incident_date?: string | null;
  status: string;
  similarity: SimilarityBreakdown;
}

export type AnalyticsDataSourceType =
  | "PLATFORM_REVIEWED_REPORTS"
  | "OFFICIAL_SOURCE"
  | "THIRD_PARTY_DATASET"
  | "IMPORTED_DATASET";

export type TrendDirection =
  | "INCREASED"
  | "DECREASED"
  | "STABLE"
  | "INSUFFICIENT_DATA";

export interface AnalyticsDataSourceInfo {
  source_type: AnalyticsDataSourceType;
  source_name: string;
  source_name_bn: string;
  coverage_start?: string | null;
  coverage_end?: string | null;
  last_verified_at: string;
  methodology_note: string;
  methodology_note_bn: string;
}

export interface KPICardsResponse {
  total_reviewed_reports: number;
  reports_this_month: number;
  reports_this_year: number;
  active_missing_alerts: number;
  total_categories: number;
  total_districts: number;
  approval_rate_percentage: number;
  last_updated_at: string;
  data_source: AnalyticsDataSourceInfo;
}

export interface MonthlyDataPoint {
  year: number;
  month: number;
  month_name: string;
  month_name_bn: string;
  count: number;
  prev_month_count?: number | null;
  percentage_change?: number | null;
  trend: TrendDirection;
  trend_label: string;
  trend_label_bn: string;
}

export interface MonthlyAnalyticsResponse {
  year: number;
  total_reports_for_year: number;
  category_id?: string | null;
  category_name?: string | null;
  district?: string | null;
  monthly_data: MonthlyDataPoint[];
  sample_size_note: string;
  last_updated_at: string;
  data_source: AnalyticsDataSourceInfo;
}

export interface YearlyDataPoint {
  year: number;
  count: number;
  prev_year_count?: number | null;
  percentage_change?: number | null;
  trend: TrendDirection;
  trend_label: string;
  trend_label_bn: string;
}

export interface YearlyAnalyticsResponse {
  available_years: number[];
  category_id?: string | null;
  category_name?: string | null;
  district?: string | null;
  yearly_data: YearlyDataPoint[];
  last_updated_at: string;
  data_source: AnalyticsDataSourceInfo;
}

export interface CategoryAnalyticsItem {
  category_id: string;
  category_name: string;
  category_slug: string;
  count: number;
  percentage_share: number;
  prev_period_count?: number | null;
  percentage_change?: number | null;
  trend: TrendDirection;
}

export interface CategoryAnalyticsResponse {
  total_reviewed_reports: number;
  year_filter?: number | null;
  month_filter?: number | null;
  categories: CategoryAnalyticsItem[];
  last_updated_at: string;
  data_source: AnalyticsDataSourceInfo;
}

export interface GeographicAnalyticsItem {
  division?: string | null;
  district?: string | null;
  area?: string | null;
  report_count: number;
  percentage_share: number;
  approximate_latitude?: number | null;
  approximate_longitude?: number | null;
}

export interface GeographicAnalyticsResponse {
  total_geocoded_reports: number;
  year_filter?: number | null;
  divisions: GeographicAnalyticsItem[];
  districts: GeographicAnalyticsItem[];
  clusters_count: number;
  last_updated_at: string;
  data_source: AnalyticsDataSourceInfo;
}

export interface PublicTransparencyOverviewResponse {
  kpis: KPICardsResponse;
  monthly: MonthlyAnalyticsResponse;
  yearly: YearlyAnalyticsResponse;
  categories: CategoryAnalyticsResponse;
  geography: GeographicAnalyticsResponse;
  last_updated_at: string;
  data_source: AnalyticsDataSourceInfo;
}

export interface StatusDistributionItem {
  status: string;
  count: number;
  percentage: number;
}

export interface ModeratorPerformanceItem {
  admin_id: string;
  admin_name: string;
  actions_count: number;
  approved_count: number;
  rejected_count: number;
  info_requested_count: number;
}

export interface AdminOperationsAnalyticsResponse {
  total_reports_all_statuses: number;
  pending_review_count: number;
  draft_count: number;
  approved_count: number;
  rejected_count: number;
  needs_more_info_count: number;
  archived_count: number;
  approval_rate_percentage: number;
  rejection_rate_percentage: number;
  status_distribution: StatusDistributionItem[];
  avg_review_turnaround_hours?: number | null;
  total_flags: number;
  pending_flags: number;
  resolved_flags: number;
  flag_resolution_rate_percentage: number;
  total_missing_alerts: number;
  active_missing_alerts: number;
  found_missing_alerts: number;
  missing_resolution_rate_percentage: number;
  moderator_performance: ModeratorPerformanceItem[];
  last_updated_at: string;
}




