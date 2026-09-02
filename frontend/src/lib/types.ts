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

export type VerificationStatus = "VERIFIED" | "UNVERIFIED" | "PENDING_REVIEW";

export interface EmergencyService {
  id: string;
  name: string;
  name_bn?: string | null;
  service_type: ServiceType;
  district: string;
  area: string;
  address: string;
  address_bn?: string | null;
  phone: string;
  alternate_phone?: string | null;
  latitude: number;
  longitude: number;
  source: string;
  source_url?: string | null;
  verification_status: VerificationStatus;
  last_verified_at?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at?: string | null;
}

export interface NearbyServiceResponse {
  id: string;
  name: string;
  name_bn?: string | null;
  service_type: ServiceType;
  district: string;
  area: string;
  address: string;
  address_bn?: string | null;
  phone: string;
  alternate_phone?: string | null;
  latitude: number;
  longitude: number;
  verification_status: VerificationStatus;
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

export interface PublicMissingPersonSightingResponse {
  id: string;
  alert_id: string;
  approximate_location: string;
  sighting_date?: string | null;
  sighting_time?: string | null;
  description: string;
  photo_url?: string | null;
  status: SightingStatus;
  created_at: string;
}

export interface AdminMissingPersonSightingResponse extends PublicMissingPersonSightingResponse {
  user_id?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  reviewed_by_admin_id?: string | null;
  reviewed_at?: string | null;
  admin_notes?: string | null;
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


