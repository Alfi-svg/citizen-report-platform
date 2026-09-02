"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { Report, ReportStatus } from "@/lib/types";
import EvidenceGallery from "@/components/EvidenceGallery";

const STATUS_BADGES: Record<
  ReportStatus,
  { label: string; bg: string; text: string; dot: string }
> = {
  DRAFT: {
    label: "Draft",
    bg: "bg-zinc-100 dark:bg-zinc-800",
    text: "text-zinc-700 dark:text-zinc-300",
    dot: "bg-zinc-400",
  },
  SUBMITTED: {
    label: "Submitted (Pending Review)",
    bg: "bg-blue-100 dark:bg-blue-950",
    text: "text-blue-700 dark:text-blue-300",
    dot: "bg-blue-500",
  },
  UNDER_REVIEW: {
    label: "Under Active Review",
    bg: "bg-amber-100 dark:bg-amber-950",
    text: "text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  APPROVED: {
    label: "Approved & Platform Verified",
    bg: "bg-emerald-100 dark:bg-emerald-950",
    text: "text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  REJECTED: {
    label: "Rejected by Moderation",
    bg: "bg-red-100 dark:bg-red-950",
    text: "text-red-700 dark:text-red-300",
    dot: "bg-red-500",
  },
  NEEDS_MORE_INFORMATION: {
    label: "Needs More Information",
    bg: "bg-purple-100 dark:bg-purple-950",
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

export default function AdminReportDetailPage() {
  const params = useParams();
  const router = useRouter();
  const reportId = params?.id as string;
  const { isAuthenticated, isLoading: authLoading, isAdmin } = useAuth();

  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [deletingMediaId, setDeletingMediaId] = useState<string | null>(null);

  // Modal dialog state
  const [activeModal, setActiveModal] = useState<"APPROVE" | "REJECT" | "REQUEST_INFO" | null>(null);
  const [userMessage, setUserMessage] = useState("");
  const [internalNotes, setInternalNotes] = useState("");

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isAdmin)) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, isAdmin, router]);

  useEffect(() => {
    let isMounted = true;
    if (isAuthenticated && isAdmin && reportId) {
      apiFetch<Report>(`/admin/reports/${reportId}`)
        .then((data) => {
          if (isMounted) setReport(data);
        })
        .catch((err: unknown) => {
          if (isMounted && err instanceof Error) setError(err.message);
        })
        .finally(() => {
          if (isMounted) setLoading(false);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, isAdmin, reportId]);

  const handleStartReview = async () => {
    setProcessing(true);
    setError(null);
    setActionSuccess(null);
    try {
      const updated = await apiFetch<Report>(`/admin/reports/${reportId}/review`, {
        method: "POST",
        body: JSON.stringify({ internal_notes: "Admin began review." }),
      });
      setReport(updated);
      setActionSuccess("Incident report moved to UNDER_REVIEW.");
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleExecuteModalAction = async () => {
    if (!activeModal) return;
    setProcessing(true);
    setError(null);
    setActionSuccess(null);

    let endpoint = "";
    if (activeModal === "APPROVE") endpoint = `/admin/reports/${reportId}/approve`;
    else if (activeModal === "REJECT") endpoint = `/admin/reports/${reportId}/reject`;
    else if (activeModal === "REQUEST_INFO") endpoint = `/admin/reports/${reportId}/request-information`;

    try {
      const updated = await apiFetch<Report>(endpoint, {
        method: "POST",
        body: JSON.stringify({
          user_message: userMessage.trim() || undefined,
          internal_notes: internalNotes.trim() || undefined,
        }),
      });
      setReport(updated);
      setActiveModal(null);
      setUserMessage("");
      setInternalNotes("");
      setActionSuccess(`Moderation action '${activeModal}' completed successfully.`);
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteEvidenceAdmin = async (mediaId: string) => {
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
      setActionSuccess("Evidence attachment removed by administrator.");
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setDeletingMediaId(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-600 border-t-transparent" />
      </div>
    );
  }

  if (!isAdmin) return null;

  if (error || !report) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 dark:border-red-900 dark:bg-red-950/40">
          <h2 className="text-lg font-bold text-red-900 dark:text-red-200">Incident Unavailable</h2>
          <p className="mt-2 text-sm text-red-700 dark:text-red-300">
            {error || "Report was not found."}
          </p>
          <div className="mt-6">
            <Link
              href="/admin/reports"
              className="inline-flex rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              Back to Moderation Queue
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const badge = STATUS_BADGES[report.status] || STATUS_BADGES.DRAFT;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Top Header */}
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/admin/reports"
            className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline inline-flex items-center gap-1 mb-2"
          >
            ← Back to Moderation Queue
          </Link>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            Incident Moderation Console
          </h1>
        </div>
        <div>
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${badge.bg} ${badge.text}`}
          >
            <span className={`h-2 w-2 rounded-full ${badge.dot}`} />
            {badge.label}
          </span>
        </div>
      </div>

      {actionSuccess && (
        <div className="mb-6 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 p-4 border border-emerald-200 dark:border-emerald-900">
          <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">{actionSuccess}</p>
        </div>
      )}

      {/* Moderation Actions Action Bar */}
      <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50/40 dark:border-amber-900/60 dark:bg-amber-950/20 p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              Moderation Decision Controls
            </h2>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
              Current status: <span className="font-semibold">{report.status}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {report.status === "SUBMITTED" && (
              <button
                type="button"
                onClick={handleStartReview}
                disabled={processing}
                className="rounded-lg bg-amber-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-amber-500 shadow-sm transition disabled:opacity-50"
              >
                🔍 Start Review
              </button>
            )}

            <button
              type="button"
              onClick={() => setActiveModal("APPROVE")}
              disabled={processing || report.status === "APPROVED"}
              className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 shadow-sm transition disabled:opacity-50"
            >
              ✓ Approve Report
            </button>

            <button
              type="button"
              onClick={() => setActiveModal("REQUEST_INFO")}
              disabled={processing || report.status === "NEEDS_MORE_INFORMATION"}
              className="rounded-lg bg-purple-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-purple-500 shadow-sm transition disabled:opacity-50"
            >
              💬 Request More Info
            </button>

            <button
              type="button"
              onClick={() => setActiveModal("REJECT")}
              disabled={processing || report.status === "REJECTED"}
              className="rounded-lg bg-red-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-red-500 shadow-sm transition disabled:opacity-50"
            >
              ✕ Reject Report
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Report Details & Evidence */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-6 shadow-sm">
            <div className="flex items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3 mb-4">
              <span className="text-xs font-semibold text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 rounded-md">
                Category: {report.category?.name || "Incident"}
              </span>
              <span className="text-xs text-zinc-400">
                Created {new Date(report.created_at).toLocaleString()}
              </span>
            </div>

            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-3">
              {report.title}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-zinc-700/60 mb-4">
              <div>
                <span className="text-zinc-500 block">Incident Location:</span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200 text-sm mt-0.5 block">
                  📍 {report.location_text}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 block">Incident Date / Time:</span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200 text-sm mt-0.5 block">
                  🕒 {report.incident_date ? new Date(report.incident_date).toLocaleString() : "Not specified"}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 block">Submitted At:</span>
                <span className="font-medium text-zinc-700 dark:text-zinc-300 mt-0.5 block">
                  {report.submitted_at ? new Date(report.submitted_at).toLocaleString() : "Draft"}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 block">Report UUID:</span>
                <span className="font-mono text-zinc-600 dark:text-zinc-400 mt-0.5 block break-all">
                  {report.id}
                </span>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">
                Incident Description
              </h3>
              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 text-sm leading-relaxed text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap">
                {report.description}
              </div>
            </div>

            {/* Evidence Inspection Gallery */}
            <div>
              <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">
                Supporting Evidence Inspection ({report.media?.length || 0})
              </h3>
              <EvidenceGallery
                media={report.media || []}
                canDelete={true}
                onDelete={handleDeleteEvidenceAdmin}
                deletingId={deletingMediaId}
              />
            </div>
          </div>

          {/* Moderation History Audit Trail */}
          <div className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-6 shadow-sm">
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mb-4">
              Moderation Audit History ({report.moderation_records?.length || 0})
            </h3>

            {report.moderation_records && report.moderation_records.length > 0 ? (
              <div className="space-y-4">
                {report.moderation_records.map((rec) => (
                  <div
                    key={rec.id}
                    className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/40 text-xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-zinc-900 dark:text-zinc-100">
                        Action: {rec.action}
                      </span>
                      <span className="text-zinc-400">
                        {new Date(rec.created_at).toLocaleString()}
                      </span>
                    </div>

                    {rec.admin && (
                      <div className="text-zinc-500">
                        Moderator: <span className="font-semibold text-zinc-800 dark:text-zinc-200">{rec.admin.username}</span>
                      </div>
                    )}

                    {rec.user_message && (
                      <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-blue-900 dark:text-blue-200">
                        <span className="font-semibold block mb-0.5">User-Facing Message:</span>
                        {rec.user_message}
                      </div>
                    )}

                    {rec.internal_notes && (
                      <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200">
                        <span className="font-semibold block mb-0.5">🔒 Private Internal Moderator Note:</span>
                        {rec.internal_notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-500">No moderation actions recorded yet.</p>
            )}
          </div>
        </div>

        {/* Right Column: Reporter Profile (Admin View) */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-6 shadow-sm">
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mb-3 flex items-center justify-between">
              <span>Reporter Profile</span>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 px-2 py-0.5 rounded">
                Admin Privilege
              </span>
            </h3>

            <div className="mb-4">
              <span className="text-xs font-medium text-zinc-500 block mb-1">Public Privacy Mode</span>
              {report.is_anonymous ? (
                <div className="p-2.5 rounded-lg bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900 text-xs text-purple-800 dark:text-purple-300">
                  <span className="font-bold block">🛡️ Anonymous Whistleblower</span>
                  Identity is masked on public interfaces. Visible here for administrator verification.
                </div>
              ) : (
                <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-xs text-blue-800 dark:text-blue-300">
                  <span className="font-bold block">👤 Public Attribution</span>
                  Reporter requested standard public attribution.
                </div>
              )}
            </div>

            {report.user ? (
              <dl className="space-y-3 text-xs">
                <div>
                  <dt className="text-zinc-500 font-medium">Username</dt>
                  <dd className="font-semibold text-zinc-900 dark:text-zinc-100">{report.user.username}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500 font-medium">Email Address</dt>
                  <dd className="font-semibold text-zinc-900 dark:text-zinc-100">{report.user.email}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500 font-medium">Display Name</dt>
                  <dd className="font-semibold text-zinc-900 dark:text-zinc-100">{report.user.full_name || "—"}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500 font-medium">Account Role</dt>
                  <dd className="font-semibold text-zinc-900 dark:text-zinc-100">{report.user.role}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500 font-medium">Reporter UUID</dt>
                  <dd className="font-mono text-zinc-600 dark:text-zinc-400 break-all">{report.user.id}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-xs text-zinc-500">Reporter account not linked or removed.</p>
            )}
          </div>
        </div>
      </div>

      {/* Action Dialog Modal */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-zinc-900 p-6 shadow-xl border border-zinc-200 dark:border-zinc-800">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-2">
              {activeModal === "APPROVE" && "Approve & Verify Incident Report"}
              {activeModal === "REJECT" && "Reject Incident Report"}
              {activeModal === "REQUEST_INFO" && "Request Additional Information from Reporter"}
            </h3>

            <p className="text-xs text-zinc-500 mb-4">
              {activeModal === "APPROVE" && "This report will transition to APPROVED status (Platform Reviewed)."}
              {activeModal === "REJECT" && "This report will transition to REJECTED status. Explain why the report is ineligible."}
              {activeModal === "REQUEST_INFO" && "Explain what evidence or location details the citizen should provide to clarify this incident."}
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  User-Facing Message {activeModal === "REQUEST_INFO" && <span className="text-red-500">*</span>}
                </label>
                <textarea
                  rows={3}
                  value={userMessage}
                  onChange={(e) => setUserMessage(e.target.value)}
                  placeholder="Message visible to the reporter on their dashboard..."
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-2.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Private Internal Moderator Notes (Admin Only)
                </label>
                <textarea
                  rows={2}
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  placeholder="Notes visible exclusively to fellow administrators..."
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-2.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-zinc-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                disabled={processing}
                className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteModalAction}
                disabled={processing || (activeModal === "REQUEST_INFO" && !userMessage.trim())}
                className="rounded-lg bg-amber-600 px-5 py-2 text-xs font-semibold text-white hover:bg-amber-500 transition disabled:opacity-50"
              >
                {processing ? "Processing..." : "Confirm Moderation Decision"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
