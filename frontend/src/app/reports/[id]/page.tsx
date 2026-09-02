"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { Report, Category, ReportStatus } from "@/lib/types";

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
    label: "Submitted for Moderation",
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
    label: "Approved & Published",
    bg: "bg-emerald-100 dark:bg-emerald-950",
    text: "text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  REJECTED: {
    label: "Rejected by Moderators",
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

export default function ReportDetailPage() {
  const params = useParams();
  const router = useRouter();
  const reportId = params?.id as string;
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [report, setReport] = useState<Report | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Edit mode state
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
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    let isMounted = true;
    if (isAuthenticated && reportId) {
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
          }
        })
        .catch((err) => {
          if (isMounted) setError(err.message);
        })
        .finally(() => {
          if (isMounted) setLoading(false);
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
      setSuccessMessage("Report successfully submitted for administrative moderation.");
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 dark:border-red-900 dark:bg-red-950/40">
          <h2 className="text-lg font-bold text-red-900 dark:text-red-200">Report Unavailable</h2>
          <p className="mt-2 text-sm text-red-700 dark:text-red-300">
            {error || "Report not found or you do not have permission to access it."}
          </p>
          <div className="mt-6">
            <Link
              href="/reports/mine"
              className="inline-flex rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              Back to My Reports
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const badge = STATUS_BADGES[report.status] || STATUS_BADGES.DRAFT;
  const canEdit = report.status === "DRAFT" || report.status === "NEEDS_MORE_INFORMATION";

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/reports/mine"
            className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1 mb-2"
          >
            ← Back to My Reports
          </Link>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Incident Report Details</h1>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && !isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3.5 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50"
            >
              ✏️ Edit Draft
            </button>
          )}
          {canEdit && (
            <button
              onClick={handleSubmitDraft}
              disabled={saving}
              className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 shadow-sm transition"
            >
              Submit Report
            </button>
          )}
        </div>
      </div>

      {successMessage && (
        <div className="mb-6 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 p-4 border border-emerald-200 dark:border-emerald-900">
          <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">{successMessage}</p>
        </div>
      )}

      {isEditing ? (
        /* Edit Form */
        <div className="space-y-6 bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Edit Draft Details</h2>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              name="title"
              type="text"
              value={editForm.title}
              onChange={handleEditChange}
              className="mt-1 block w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                name="categoryId"
                value={editForm.categoryId}
                onChange={handleEditChange}
                className="mt-1 block w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Location <span className="text-red-500">*</span>
              </label>
              <input
                name="locationText"
                type="text"
                value={editForm.locationText}
                onChange={handleEditChange}
                className="mt-1 block w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Incident Occurrence Date & Time
            </label>
            <input
              name="incidentDate"
              type="datetime-local"
              value={editForm.incidentDate}
              onChange={handleEditChange}
              className="mt-1 block w-full sm:w-1/2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              name="description"
              rows={6}
              value={editForm.description}
              onChange={handleEditChange}
              className="mt-1 block w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              name="isAnonymous"
              type="checkbox"
              id="editAnonymous"
              checked={editForm.isAnonymous}
              onChange={handleEditChange}
              className="rounded text-emerald-600 focus:ring-emerald-500"
            />
            <label htmlFor="editAnonymous" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Submit in Anonymous Whistleblower Mode (mask identity from public)
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleUpdateDraft}
              disabled={saving}
              className="rounded-lg bg-emerald-600 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-500 transition"
            >
              {saving ? "Saving Changes..." : "Save Changes"}
            </button>
          </div>
        </div>
      ) : (
        /* Read-Only View */
        <div className="space-y-6">
          <div className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-6 sm:p-8 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-4 mb-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${badge.bg} ${badge.text}`}>
                  <span className={`h-2 w-2 rounded-full ${badge.dot}`} />
                  {badge.label}
                </span>
                <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 rounded-full">
                  Category: {report.category?.name || "Incident"}
                </span>
                {report.is_anonymous ? (
                  <span className="text-xs font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950 px-2.5 py-1 rounded-full">
                    🛡️ Anonymous Mode
                  </span>
                ) : (
                  <span className="text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950 px-2.5 py-1 rounded-full">
                    👤 Public Attribution
                  </span>
                )}
              </div>
              <span className="text-xs text-zinc-400">
                Created on {new Date(report.created_at).toLocaleString()}
              </span>
            </div>

            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
              {report.title}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs mb-6 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-zinc-700/60">
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
                <span className="text-zinc-500 block">Submission Timestamp:</span>
                <span className="font-medium text-zinc-700 dark:text-zinc-300 mt-0.5 block">
                  {report.submitted_at ? new Date(report.submitted_at).toLocaleString() : "Draft (Unsubmitted)"}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 block">Report Identifier (UUID):</span>
                <span className="font-mono text-zinc-600 dark:text-zinc-400 mt-0.5 block break-all">
                  {report.id}
                </span>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">
                Incident Description
              </h3>
              <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm leading-relaxed text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap">
                {report.description}
              </div>
            </div>
          </div>

          {!canEdit && (
            <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900 dark:bg-blue-950/20 text-xs text-blue-800 dark:text-blue-300">
              ℹ️ This report has been submitted to the moderation team and is locked against modifications. You will be notified once administrators review and verify your submission.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
