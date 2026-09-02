"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { AdminComment, CommentStatus } from "@/lib/types";
import AdminNav from "@/components/AdminNav";

export default function AdminCommentsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, isAdmin } = useAuth();

  const [comments, setComments] = useState<AdminComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const limit = 30;

  // Action modal
  const [selectedComment, setSelectedComment] = useState<AdminComment | null>(null);
  const [targetStatus, setTargetStatus] = useState<CommentStatus>("VISIBLE");
  const [showModal, setShowModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isAdmin)) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, isAdmin, router]);

  const [activeQuery, setActiveQuery] = useState("");

  useEffect(() => {
    let isMounted = true;
    if (isAuthenticated && isAdmin) {
      const offset = (page - 1) * limit;
      let url = `/admin/comments?limit=${limit}&offset=${offset}`;
      if (statusFilter !== "ALL") url += `&comment_status=${statusFilter}`;
      if (activeQuery.trim()) url += `&search=${encodeURIComponent(activeQuery.trim())}`;

      apiFetch<AdminComment[]>(url)
        .then((res) => {
          if (isMounted) {
            setComments(res);
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
  }, [isAuthenticated, isAdmin, page, statusFilter, activeQuery]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setActiveQuery(search);
  };

  const handleStatusUpdate = async () => {
    if (!selectedComment) return;
    setActionLoading(true);
    try {
      const updated = await apiFetch<AdminComment>(`/admin/comments/${selectedComment.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: targetStatus }),
      });
      setComments((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setShowModal(false);
      setSelectedComment(null);
    } catch (err: unknown) {
      if (err instanceof Error) alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (authLoading || !isAuthenticated || !isAdmin) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <AdminNav />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <span>💬 Community Comments Moderation / মন্তব্য নিয়ন্ত্রণ</span>
              <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-xs px-2.5 py-0.5 font-bold">
                {comments.length}
              </span>
            </h1>
            <p className="text-xs text-zinc-500 mt-1">
              Review and moderate public discussion comments posted on platform verified incident reports.
            </p>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-sm space-y-3">
          <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Search comments text content..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3.5 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <button
              type="submit"
              className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-500 shadow-sm transition"
            >
              Search
            </button>
          </form>

          <div className="flex items-center gap-2 text-xs pt-1">
            <span className="font-semibold text-zinc-500">Moderation Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 py-1 text-xs text-zinc-800 dark:text-zinc-200"
            >
              <option value="ALL">All Comments</option>
              <option value="VISIBLE">Visible Publicly</option>
              <option value="HIDDEN">Hidden by Moderation</option>
              <option value="REMOVED">Removed Permanently</option>
            </select>
          </div>
        </div>

        {/* Comments Table */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-600 border-t-transparent" />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        ) : comments.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800 p-12 text-center text-xs text-zinc-400">
            No comments found matching your query.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
            <table className="w-full text-left text-xs text-zinc-600 dark:text-zinc-300">
              <thead className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 font-semibold text-zinc-900 dark:text-zinc-100">
                <tr>
                  <th className="px-4 py-3">Comment Body</th>
                  <th className="px-4 py-3">Associated Report</th>
                  <th className="px-4 py-3">Author</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Posted Date</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {comments.map((c) => (
                  <tr key={c.id} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40 transition">
                    <td className="px-4 py-3 max-w-sm">
                      <p className="line-clamp-2 text-zinc-900 dark:text-zinc-100 font-medium">{c.body}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/reports/${c.report_id}`}
                        className="text-[11px] font-semibold text-emerald-600 hover:underline"
                      >
                        Inspect Report →
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {c.user?.username ? `@${c.user.username}` : "Citizen"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold ${
                          c.status === "VISIBLE"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : c.status === "HIDDEN"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-zinc-400">
                      {new Date(c.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      {c.status !== "VISIBLE" && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedComment(c);
                            setTargetStatus("VISIBLE");
                            setShowModal(true);
                          }}
                          className="text-[11px] font-semibold text-emerald-600 hover:underline"
                        >
                          Restore
                        </button>
                      )}
                      {c.status !== "HIDDEN" && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedComment(c);
                            setTargetStatus("HIDDEN");
                            setShowModal(true);
                          }}
                          className="text-[11px] font-semibold text-amber-600 hover:underline"
                        >
                          Hide
                        </button>
                      )}
                      {c.status !== "REMOVED" && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedComment(c);
                            setTargetStatus("REMOVED");
                            setShowModal(true);
                          }}
                          className="text-[11px] font-semibold text-red-600 hover:underline"
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showModal && selectedComment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 p-6 shadow-xl border border-zinc-200 dark:border-zinc-800 space-y-4 text-xs">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              Update Comment Moderation Status
            </h3>
            <p className="text-zinc-600 dark:text-zinc-400">
              Are you sure you want to change the status of this comment to{" "}
              <span className="font-bold text-zinc-900 dark:text-zinc-100">{targetStatus}</span>?
            </p>
            <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/60 p-3 border border-zinc-200 dark:border-zinc-700 italic text-zinc-700 dark:text-zinc-300">
              &quot;{selectedComment.body}&quot;
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-xl border border-zinc-300 dark:border-zinc-700 px-3.5 py-2 font-semibold text-zinc-700 dark:text-zinc-300"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleStatusUpdate}
                className={`rounded-xl px-4 py-2 font-semibold text-white transition ${
                  targetStatus === "VISIBLE"
                    ? "bg-emerald-600 hover:bg-emerald-500"
                    : targetStatus === "HIDDEN"
                    ? "bg-amber-600 hover:bg-amber-500"
                    : "bg-red-600 hover:bg-red-500"
                }`}
              >
                {actionLoading ? "Updating..." : `Confirm ${targetStatus}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
