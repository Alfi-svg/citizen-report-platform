"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { AdminFlag, AdminFlagPagination, FlagStatus } from "@/lib/types";
import AdminNav from "@/components/AdminNav";

const STATUS_BADGES: Record<
  FlagStatus,
  { label: string; bg: string; text: string; border: string }
> = {
  PENDING: {
    label: "Pending Review",
    bg: "bg-amber-100 dark:bg-amber-950",
    text: "text-amber-800 dark:text-amber-300",
    border: "border-amber-200 dark:border-amber-900",
  },
  ACTION_TAKEN: {
    label: "Action Taken",
    bg: "bg-emerald-100 dark:bg-emerald-950",
    text: "text-emerald-800 dark:text-emerald-300",
    border: "border-emerald-200 dark:border-emerald-900",
  },
  DISMISSED: {
    label: "Dismissed",
    bg: "bg-zinc-100 dark:bg-zinc-800",
    text: "text-zinc-700 dark:text-zinc-300",
    border: "border-zinc-200 dark:border-zinc-700",
  },
  REVIEWED: {
    label: "Reviewed / No Action",
    bg: "bg-blue-100 dark:bg-blue-950",
    text: "text-blue-800 dark:text-blue-300",
    border: "border-blue-200 dark:border-blue-900",
  },
};

export default function AdminFlagsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, isAdmin } = useAuth();

  const [flags, setFlags] = useState<AdminFlag[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Filters
  const [targetTypeFilter, setTargetTypeFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const limit = 20;

  // Review Modal State
  const [selectedFlag, setSelectedFlag] = useState<AdminFlag | null>(null);
  const [reviewStatus, setReviewStatus] = useState<FlagStatus>("ACTION_TAKEN");
  const [adminNotes, setAdminNotes] = useState("");
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isAdmin)) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, isAdmin, router]);

  useEffect(() => {
    let isMounted = true;
    if (isAuthenticated && isAdmin) {
      const offset = (page - 1) * limit;
      let url = `/admin/flags?limit=${limit}&offset=${offset}`;
      if (targetTypeFilter !== "ALL") url += `&target_type=${targetTypeFilter}`;
      if (statusFilter !== "ALL") url += `&flag_status=${statusFilter}`;

      apiFetch<AdminFlagPagination>(url)
        .then((res) => {
          if (isMounted) {
            setFlags(res.items);
            setTotal(res.total);
            setLoading(false);
          }
        })
        .catch((err: unknown) => {
          if (isMounted) {
            if (err instanceof Error) setError(err.message);
            setLoading(false);
          }
        });
    }
    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, isAdmin, targetTypeFilter, statusFilter, page]);

  const handleOpenReview = (flag: AdminFlag) => {
    setSelectedFlag(flag);
    setReviewStatus(flag.status === "PENDING" ? "ACTION_TAKEN" : flag.status);
    setAdminNotes(flag.admin_notes || "");
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFlag) return;
    setModalLoading(true);

    try {
      const updated = await apiFetch<AdminFlag>(`/admin/flags/${selectedFlag.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: reviewStatus,
          admin_notes: adminNotes.trim() || undefined,
        }),
      });

      setFlags((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
      setSelectedFlag(null);
      setActionSuccess(`Flag for ${updated.target_type.toLowerCase()} updated to ${updated.status}.`);
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: unknown) {
      if (err instanceof Error) alert(err.message);
    } finally {
      setModalLoading(false);
    }
  };

  if (authLoading || !isAuthenticated || !isAdmin) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-600 border-t-transparent" />
      </div>
    );
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <AdminNav />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <span>🚩 Content Moderation & Flags Queue / ফ্ল্যাগ পর্যালোচনা</span>
              <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-xs px-2.5 py-0.5 font-bold">
                {total}
              </span>
            </h1>
            <p className="text-xs text-zinc-500 mt-1">
              Review user-reported reports and comments for civic safety compliance.
            </p>
          </div>
        </div>

        {actionSuccess && (
          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/50 p-4 border border-emerald-200 dark:border-emerald-900">
            <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
              {actionSuccess}
            </p>
          </div>
        )}

        {/* Filter Bar */}
        <div className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-4 shadow-sm flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">Target:</span>
            <select
              value={targetTypeFilter}
              onChange={(e) => {
                setTargetTypeFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-1.5 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="ALL">All Targets</option>
              <option value="REPORT">Reports Only</option>
              <option value="COMMENT">Comments Only</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-1.5 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending Only</option>
              <option value="ACTION_TAKEN">Action Taken</option>
              <option value="DISMISSED">Dismissed</option>
              <option value="REVIEWED">Reviewed</option>
            </select>
          </div>
        </div>

        {/* Flag Items List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-600 border-t-transparent" />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        ) : flags.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 p-12 text-center text-xs text-zinc-400">
            No content flags match the selected criteria.
          </div>
        ) : (
          <div className="space-y-4">
            {flags.map((flag) => {
              const badge = STATUS_BADGES[flag.status] || STATUS_BADGES.PENDING;
              return (
                <div
                  key={flag.id}
                  className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-sm space-y-3 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          flag.target_type === "REPORT"
                            ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                            : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                        }`}
                      >
                        {flag.target_type}
                      </span>
                      <span className="font-bold text-zinc-900 dark:text-zinc-100">
                        Reason: {flag.reason}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${badge.bg} ${badge.text} border ${badge.border}`}
                      >
                        {badge.label}
                      </span>
                      <span className="text-zinc-400 text-[11px]">
                        {new Date(flag.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Target Snippet */}
                  {flag.target_snippet && (
                    <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-zinc-700/60">
                      <span className="font-semibold text-zinc-500 block mb-0.5 text-[11px]">
                        Target Content Snippet:
                      </span>
                      <p className="text-zinc-800 dark:text-zinc-200 italic">
                        “{flag.target_snippet}”
                      </p>
                    </div>
                  )}

                  {/* Flagger Info & Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-zinc-500 block">Flagger Username (Private):</span>
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                        👤 {flag.flagger_username || "Unknown"}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-500 block">Flag Details / Explanation:</span>
                      <span className="text-zinc-700 dark:text-zinc-300">
                        {flag.details || "No explanation provided."}
                      </span>
                    </div>
                  </div>

                  {/* Action Controls */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center gap-2">
                      {flag.report_id && (
                        <Link
                          href={`/admin/reports/${flag.report_id}`}
                          className="rounded-lg bg-zinc-900 dark:bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-white dark:text-zinc-900 hover:bg-zinc-800"
                        >
                          Inspect Report Console →
                        </Link>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenReview(flag)}
                      className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500"
                    >
                      Update Status
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 text-xs">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-zinc-700 dark:text-zinc-300 disabled:opacity-40"
            >
              ← Previous
            </button>
            <span className="text-zinc-500">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-zinc-700 dark:text-zinc-300 disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {/* Review Modal */}
      {selectedFlag && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 p-6 shadow-xl border border-zinc-200 dark:border-zinc-800 space-y-4 text-xs">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              Review Safety Flag ({selectedFlag.target_type})
            </h3>

            <form onSubmit={handleReviewSubmit} className="space-y-3">
              <div>
                <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Moderation Decision *
                </label>
                <select
                  value={reviewStatus}
                  onChange={(e) => setReviewStatus(e.target.value as FlagStatus)}
                  className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3.5 py-2 text-zinc-900 dark:text-zinc-100"
                >
                  <option value="ACTION_TAKEN">Action Taken (Content moderated)</option>
                  <option value="REVIEWED">Reviewed (No policy violation)</option>
                  <option value="DISMISSED">Dismissed (Invalid / bad-faith flag)</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Internal Administrative Notes (Private)
                </label>
                <textarea
                  rows={3}
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Private explanation of review decision..."
                  className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3.5 py-2 text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedFlag(null)}
                  className="rounded-xl border border-zinc-300 dark:border-zinc-700 px-3.5 py-2 font-semibold text-zinc-700 dark:text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="rounded-xl bg-amber-600 px-4 py-2 font-semibold text-white hover:bg-amber-500 transition"
                >
                  {modalLoading ? "Saving..." : "Save Review Decision"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
