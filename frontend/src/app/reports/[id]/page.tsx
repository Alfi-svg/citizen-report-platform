"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { Report, Category, ReportStatus, ReportMedia, PublicReport, PublicRelatedReportResponse } from "@/lib/types";
import EvidenceGallery from "@/components/EvidenceGallery";
import EvidenceUploader from "@/components/EvidenceUploader";
import ReactionControls from "@/components/ReactionControls";
import CommentsSection from "@/components/CommentsSection";
import FlagModal from "@/components/FlagModal";

const STATUS_BADGES: Record<
  ReportStatus,
  { label: string; bg: string; text: string; dot: string }
> = {
  DRAFT: {
    label: "Draft (Unsubmitted)",
    bg: "bg-zinc-100 dark:bg-zinc-800",
    text: "text-zinc-700 dark:text-zinc-300",
    dot: "bg-zinc-400",
  },
  SUBMITTED: {
    label: "Submitted for Review",
    bg: "bg-blue-50 dark:bg-blue-950/60",
    text: "text-blue-700 dark:text-blue-300",
    dot: "bg-blue-500",
  },
  UNDER_REVIEW: {
    label: "Under Active Review",
    bg: "bg-amber-50 dark:bg-amber-950/60",
    text: "text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  APPROVED: {
    label: "Platform Reviewed",
    bg: "bg-emerald-50 dark:bg-emerald-950/60",
    text: "text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  REJECTED: {
    label: "Not Approved",
    bg: "bg-red-50 dark:bg-red-950/60",
    text: "text-red-700 dark:text-red-300",
    dot: "bg-red-500",
  },
  NEEDS_MORE_INFORMATION: {
    label: "Needs Information",
    bg: "bg-purple-50 dark:bg-purple-950/60",
    text: "text-purple-700 dark:text-purple-300",
    dot: "bg-purple-500",
  },
  ARCHIVED: {
    label: "Archived",
    bg: "bg-zinc-200 dark:bg-zinc-800",
    text: "text-zinc-600 dark:text-zinc-400",
    dot: "bg-zinc-500",
  },
};

export default function ReportDetailPage() {
  const params = useParams();
  const reportId = params?.id as string;
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [report, setReport] = useState<Report | null>(null);
  const [publicReport, setPublicReport] = useState<PublicReport | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [deletingMediaId, setDeletingMediaId] = useState<string | null>(null);
  const [isFlagModalOpen, setIsFlagModalOpen] = useState(false);
  const [relatedReports, setRelatedReports] = useState<PublicRelatedReportResponse[]>([]);
  const [copied, setCopied] = useState(false);

  // Edit mode state for report owner
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    title: "",
    categoryId: "",
    description: "",
    locationText: "",
    incidentDate: "",
    isAnonymous: false,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (!reportId) return;

    // Fetch related reports
    apiFetch<PublicRelatedReportResponse[]>(`/safety/reports/${reportId}/related`)
      .then((rels) => {
        if (isMounted) setRelatedReports(rels);
      })
      .catch(() => {});

    // 1. If authenticated, attempt to fetch user/owner report
    if (isAuthenticated) {
      Promise.all([
        apiFetch<Report>(`/reports/${reportId}`),
        apiFetch<Category[]>("/categories"),
      ])
        .then(([reportData, categoryData]) => {
          if (isMounted) {
            setReport(reportData);
            setCategories(categoryData);
            setEditForm({
              title: reportData.title,
              categoryId: reportData.category_id,
              description: reportData.description,
              locationText: reportData.location_text,
              incidentDate: reportData.incident_date
                ? new Date(reportData.incident_date).toISOString().slice(0, 16)
                : "",
              isAnonymous: reportData.is_anonymous,
            });
            setLoading(false);
          }
        })
        .catch(() => {
          // If not owner/admin (403), fallback to public report endpoint
          apiFetch<PublicReport>(`/public/reports/${reportId}`)
            .then((pubData) => {
              if (isMounted) {
                setPublicReport(pubData);
                setLoading(false);
              }
            })
            .catch((pubErr) => {
              if (isMounted) {
                setError(pubErr.message);
                setLoading(false);
              }
            });
        });
    } else {
      // 2. Unauthenticated visitor -> fetch from public endpoint
      apiFetch<PublicReport>(`/public/reports/${reportId}`)
        .then((pubData) => {
          if (isMounted) {
            setPublicReport(pubData);
            setLoading(false);
          }
        })
        .catch((pubErr) => {
          if (isMounted) {
            setError(pubErr.message);
            setLoading(false);
          }
        });
    }

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, reportId]);

  const handleEditChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setEditForm((prev) => ({ ...prev, [name]: checked }));
    } else {
      setEditForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleUpdateDraft = async () => {
    setError(null);
    setSuccessMessage(null);
    setSaving(true);
    try {
      const payload = {
        title: editForm.title.trim(),
        category_id: editForm.categoryId,
        description: editForm.description.trim(),
        location_text: editForm.locationText.trim(),
        incident_date: editForm.incidentDate ? new Date(editForm.incidentDate).toISOString() : null,
        is_anonymous: editForm.isAnonymous,
      };

      const updated = await apiFetch<Report>(`/reports/${reportId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      setReport(updated);
      setIsEditing(false);
      setSuccessMessage("Draft updated successfully.");
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitDraft = async () => {
    setError(null);
    setSuccessMessage(null);
    setSaving(true);
    try {
      const submitted = await apiFetch<Report>(`/reports/${reportId}/submit`, {
        method: "POST",
      });
      setReport(submitted);
      setIsEditing(false);
      setSuccessMessage("Report successfully submitted for moderation review.");
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMedia = async (mediaId: string) => {
    if (!report) return;
    setDeletingMediaId(mediaId);
    setError(null);
    try {
      await apiFetch(`/reports/${report.id}/media/${mediaId}`, {
        method: "DELETE",
      });
      setReport({
        ...report,
        media: report.media?.filter((m) => m.id !== mediaId) || [],
      });
      setSuccessMessage("Evidence file removed successfully.");
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setDeletingMediaId(null);
    }
  };

  const handleUploadComplete = (newMedia: ReportMedia) => {
    if (!report) return;
    setReport({
      ...report,
      media: [...(report.media || []), newMedia],
    });
    setSuccessMessage("Supporting evidence uploaded successfully.");
  };

  const handleShare = async (title: string) => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: `Check out this incident report on Bangladesh Citizen Safety Network: ${title}`,
          url,
        });
        return;
      } catch {
        // Fallback to clipboard
      }
    }
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Loading Skeleton State
  if (authLoading || loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-32 animate-pulse" />
        <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-8 space-y-6 animate-pulse">
          <div className="flex gap-2">
            <div className="h-6 bg-zinc-200 dark:bg-zinc-800 rounded-full w-24" />
            <div className="h-6 bg-zinc-200 dark:bg-zinc-800 rounded-full w-32" />
          </div>
          <div className="h-8 bg-zinc-200 dark:bg-zinc-800 rounded w-3/4" />
          <div className="h-20 bg-zinc-100 dark:bg-zinc-800/50 rounded-2xl w-full" />
          <div className="space-y-2">
            <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-full" />
            <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-5/6" />
            <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-4/6" />
          </div>
        </div>
      </div>
    );
  }

  // Error / Not Found State
  if (error || (!report && !publicReport)) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 shadow-sm space-y-4">
          <div className="text-4xl">📋</div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Report Unavailable</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto leading-relaxed">
            {error || "This report was not found or has not yet been approved for public release."}
          </p>
          <div className="pt-2">
            <Link
              href="/reports"
              className="inline-flex rounded-xl bg-emerald-700 hover:bg-emerald-800 px-4 py-2 text-xs font-bold text-white shadow-2xs transition"
            >
              ← Return to Community Reports
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 1. PUBLIC CITIZEN REPORT VIEW
  // =========================================================================
  if (publicReport && !report) {
    return (
      <article className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        {/* Breadcrumb / Back */}
        <div className="flex items-center justify-between">
          <Link
            href="/reports"
            className="text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:text-emerald-700 dark:hover:text-emerald-400 inline-flex items-center gap-1.5 transition"
          >
            <span>←</span>
            <span>Back to Community Reports</span>
          </Link>
        </div>

        {/* Main Report Container */}
        <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-10 shadow-2xs space-y-6">
          {/* Header Row: Category Badge + Status Badge + Date */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-900/60">
                {publicReport.category?.name || "Civic Incident"}
              </span>

              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900/60">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse" />
                <span>{publicReport.review_status || "Platform Reviewed"}</span>
              </span>
            </div>

            <span className="text-xs text-zinc-400">
              Reported {new Date(publicReport.created_at).toLocaleDateString()}
            </span>
          </div>

          {/* Title */}
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight leading-tight">
            {publicReport.title}
          </h1>

          {/* Incident Metadata Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/80 dark:border-zinc-700/80 text-xs">
            <div>
              <span className="text-zinc-400 font-medium block">Approximate Location</span>
              <span className="font-bold text-zinc-800 dark:text-zinc-200 text-xs sm:text-sm mt-0.5 block truncate">
                📍 {publicReport.location_text}
              </span>
            </div>
            <div>
              <span className="text-zinc-400 font-medium block">Incident Time</span>
              <span className="font-bold text-zinc-800 dark:text-zinc-200 text-xs sm:text-sm mt-0.5 block">
                🕒 {publicReport.incident_date ? new Date(publicReport.incident_date).toLocaleString() : "Not specified"}
              </span>
            </div>
            <div>
              <span className="text-zinc-400 font-medium block">Reporter Identity</span>
              <span className="font-bold text-zinc-800 dark:text-zinc-200 text-xs sm:text-sm mt-0.5 block">
                {publicReport.is_anonymous ? "🛡️ Anonymous Citizen" : `👤 ${publicReport.reporter_display_name || "Citizen"}`}
              </span>
            </div>
          </div>

          {/* Map Link Action */}
          <div className="flex items-center justify-between text-xs pt-1">
            <Link
              href="/safety-map"
              className="text-emerald-700 dark:text-emerald-400 font-bold hover:underline inline-flex items-center gap-1"
            >
              <span>🗺️</span>
              <span>View On Interactive Safety Map →</span>
            </Link>
          </div>

          {/* Description Section */}
          <div className="space-y-2 pt-2">
            <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
              Incident Details
            </h2>
            <div className="p-6 rounded-2xl bg-zinc-50/50 dark:bg-zinc-800/20 border border-zinc-200/60 dark:border-zinc-800 text-sm leading-relaxed text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap">
              {publicReport.description}
            </div>
          </div>

          {/* Supporting Evidence Attachments */}
          {publicReport.media && publicReport.media.length > 0 && (
            <div className="space-y-3 pt-2">
              <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                Attached Supporting Evidence ({publicReport.media.length})
              </h2>
              <EvidenceGallery media={publicReport.media as ReportMedia[]} canDelete={false} />
            </div>
          )}

          {/* Social Action Bar: Reactions, Share, Flag */}
          <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-4">
            <ReactionControls reportId={publicReport.id} />

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleShare(publicReport.title)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-750 transition shadow-2xs"
              >
                <span>↗</span>
                <span>{copied ? "Link Copied!" : "Share Report"}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsFlagModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-zinc-500 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
              >
                <span>🚩</span>
                <span>Flag</span>
              </button>
            </div>
          </div>

          {/* Verification Notice Banner */}
          <div className="rounded-2xl border border-blue-200/80 bg-blue-50/50 dark:border-blue-900/60 dark:bg-blue-950/20 p-4 text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
            ℹ️ <strong>Platform Verification Notice:</strong> This report has undergone administrative review according to platform civic guidelines. It is published for public transparency and community safety awareness.
          </div>

          {/* Related Incidents Section */}
          {relatedReports.length > 0 && (
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/40 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <span>🔗</span>
                  <span>Related Reports</span>
                </h3>
                <span className="text-[11px] text-zinc-400 font-semibold">
                  {relatedReports.length} related
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {relatedReports.map((rel) => (
                  <Link
                    key={rel.id}
                    href={`/reports/${rel.id}`}
                    className="group rounded-xl border border-zinc-200/80 dark:border-zinc-700/80 bg-white dark:bg-zinc-900 p-3.5 shadow-2xs hover:border-emerald-600 transition"
                  >
                    <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-1">
                      <span className="font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-1.5 py-0.5 rounded">
                        {rel.category_name}
                      </span>
                      <span>{new Date(rel.created_at).toLocaleDateString()}</span>
                    </div>
                    <h4 className="text-xs font-bold text-zinc-800 dark:text-zinc-200 group-hover:text-emerald-700 transition line-clamp-1">
                      {rel.title}
                    </h4>
                    <p className="text-[11px] text-zinc-500 mt-1 line-clamp-1">
                      📍 {rel.location_text}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Citizen Comments & Discussion */}
          <CommentsSection reportId={publicReport.id} />

          {/* Flag Modal */}
          <FlagModal
            isOpen={isFlagModalOpen}
            onClose={() => setIsFlagModalOpen(false)}
            targetType="REPORT"
            targetId={publicReport.id}
            targetTitleOrSnippet={publicReport.title}
          />
        </div>
      </article>
    );
  }

  // =========================================================================
  // 2. OWNER / CITIZEN REPORT MANAGEMENT VIEW
  // =========================================================================
  if (!report) return null;

  const badge = STATUS_BADGES[report.status] || STATUS_BADGES.DRAFT;
  const canEdit = report.status === "DRAFT" || report.status === "NEEDS_MORE_INFORMATION";

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* Header with Back Link and Action Buttons */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/reports/mine"
            className="text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:text-emerald-700 dark:hover:text-emerald-400 inline-flex items-center gap-1.5 transition mb-2"
          >
            <span>←</span>
            <span>Back to My Reports</span>
          </Link>
          <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
            Incident Submission Details
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && !isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3.5 py-2 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 transition shadow-2xs"
            >
              ✏️ Edit Draft
            </button>
          )}
          {canEdit && (
            <button
              onClick={handleSubmitDraft}
              disabled={saving}
              className="rounded-xl bg-emerald-700 hover:bg-emerald-800 px-4 py-2 text-xs font-bold text-white shadow-2xs transition"
            >
              Submit for Review
            </button>
          )}
        </div>
      </div>

      {successMessage && (
        <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 p-4 border border-emerald-200 dark:border-emerald-900">
          <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">{successMessage}</p>
        </div>
      )}

      {isEditing ? (
        /* Edit Form */
        <div className="space-y-6 bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xs">
          <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Edit Draft Submission</h2>

          <div>
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              name="title"
              type="text"
              value={editForm.title}
              onChange={handleEditChange}
              className="mt-1.5 block w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 px-3.5 py-2.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-700"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                name="categoryId"
                value={editForm.categoryId}
                onChange={handleEditChange}
                className="mt-1.5 block w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 px-3.5 py-2.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-700"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                Location <span className="text-red-500">*</span>
              </label>
              <input
                name="locationText"
                type="text"
                value={editForm.locationText}
                onChange={handleEditChange}
                className="mt-1.5 block w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 px-3.5 py-2.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
              Incident Occurrence Date & Time
            </label>
            <input
              name="incidentDate"
              type="datetime-local"
              value={editForm.incidentDate}
              onChange={handleEditChange}
              className="mt-1.5 block w-full sm:w-1/2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 px-3.5 py-2.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-700"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              name="description"
              rows={6}
              value={editForm.description}
              onChange={handleEditChange}
              className="mt-1.5 block w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 p-3.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-700"
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              name="isAnonymous"
              type="checkbox"
              id="editAnonymous"
              checked={editForm.isAnonymous}
              onChange={handleEditChange}
              className="rounded text-emerald-700 focus:ring-emerald-700"
            />
            <label htmlFor="editAnonymous" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Submit in Anonymous Whistleblower Mode (mask identity from public)
            </label>
          </div>

          {/* Manage Attachments in Edit Mode */}
          <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
            <h3 className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
              Supporting Evidence Attachments
            </h3>
            {report.media && report.media.length > 0 && (
              <div className="mb-4">
                <EvidenceGallery
                  media={report.media}
                  canDelete={canEdit}
                  onDelete={handleDeleteMedia}
                  deletingId={deletingMediaId}
                />
              </div>
            )}
            <EvidenceUploader
              reportId={report.id}
              onUploadComplete={handleUploadComplete}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="rounded-xl border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleUpdateDraft}
              disabled={saving}
              className="rounded-xl bg-emerald-700 hover:bg-emerald-800 px-5 py-2 text-xs font-bold text-white transition shadow-2xs"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      ) : (
        /* Read-Only Owner View */
        <div className="space-y-6">
          <div className="rounded-3xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-6 sm:p-8 shadow-2xs space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${badge.bg} ${badge.text}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
                  {badge.label}
                </span>
                <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 rounded-full">
                  Category: {report.category?.name || "Incident"}
                </span>
                {report.is_anonymous ? (
                  <span className="text-xs font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 px-2.5 py-1 rounded-full">
                    🛡️ Anonymous Mode
                  </span>
                ) : (
                  <span className="text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-1 rounded-full">
                    👤 Public Attribution
                  </span>
                )}
              </div>
              <span className="text-xs text-zinc-400">
                Created {new Date(report.created_at).toLocaleDateString()}
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
              {report.title}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/80 dark:border-zinc-700/80">
              <div>
                <span className="text-zinc-400 block font-medium">Incident Location</span>
                <span className="font-bold text-zinc-800 dark:text-zinc-200 text-sm mt-0.5 block">
                  📍 {report.location_text}
                </span>
              </div>
              <div>
                <span className="text-zinc-400 block font-medium">Incident Occurrence</span>
                <span className="font-bold text-zinc-800 dark:text-zinc-200 text-sm mt-0.5 block">
                  🕒 {report.incident_date ? new Date(report.incident_date).toLocaleString() : "Not specified"}
                </span>
              </div>
              <div>
                <span className="text-zinc-400 block font-medium">Submission Timestamp</span>
                <span className="font-medium text-zinc-700 dark:text-zinc-300 mt-0.5 block">
                  {report.submitted_at ? new Date(report.submitted_at).toLocaleString() : "Draft (Unsubmitted)"}
                </span>
              </div>
              <div>
                <span className="text-zinc-400 block font-medium">Tracking Reference (ID)</span>
                <span className="font-mono text-zinc-600 dark:text-zinc-400 mt-0.5 block break-all text-[11px]">
                  {report.id}
                </span>
              </div>
            </div>

            {/* Moderator Feedback for Reporter */}
            {report.moderation_records && report.moderation_records.some((m) => m.user_message) && (
              <div className="rounded-2xl border border-purple-200 bg-purple-50/70 dark:border-purple-900 dark:bg-purple-950/30 p-4 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-purple-900 dark:text-purple-200">
                  <span>💬 Official Moderation Feedback</span>
                </div>
                {report.moderation_records
                  .filter((m) => m.user_message)
                  .map((m) => (
                    <div key={m.id} className="text-xs text-purple-800 dark:text-purple-300">
                      <p className="font-semibold">
                        {m.action === "REQUESTED_INFORMATION"
                          ? "Information Requested:"
                          : m.action === "REJECTED"
                          ? "Rejection Reason:"
                          : "Moderator Note:"}
                      </p>
                      <p className="mt-0.5">{m.user_message}</p>
                    </div>
                  ))}
              </div>
            )}

            <div>
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                Incident Description
              </h3>
              <div className="p-5 rounded-2xl bg-zinc-50/50 dark:bg-zinc-800/20 border border-zinc-200/60 dark:border-zinc-800 text-sm leading-relaxed text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap">
                {report.description}
              </div>
            </div>

            {/* Evidence Gallery View */}
            <div>
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">
                Supporting Evidence ({report.media?.length || 0})
              </h3>
              <EvidenceGallery
                media={report.media || []}
                canDelete={canEdit}
                onDelete={handleDeleteMedia}
                deletingId={deletingMediaId}
              />
            </div>
          </div>

          {!canEdit && (
            <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900 dark:bg-blue-950/20 text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
              ℹ️ This report has been submitted to the moderation team and is locked against modifications. You will be notified once administrators review and verify your submission.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
