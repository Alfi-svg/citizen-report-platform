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
