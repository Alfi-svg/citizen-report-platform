"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { AdminDashboardStats, AdminReportPagination } from "@/lib/types";

export default function AdminDashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, isAdmin } = useAuth();

  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [recentReports, setRecentReports] = useState<AdminReportPagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    let isMounted = true;
    if (isAuthenticated && isAdmin) {
      Promise.all([
        apiFetch<AdminDashboardStats>("/admin/dashboard"),
        apiFetch<AdminReportPagination>("/admin/reports?status=SUBMITTED&limit=5"),
      ])
        .then(([statsData, reportsData]) => {
          if (isMounted) {
            setStats(statsData);
            setRecentReports(reportsData);
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
  }, [isAuthenticated, isAdmin]);

  if (isLoading || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-600 border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  // Non-admin user access attempt
  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 dark:border-red-900 dark:bg-red-950/40">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300 font-bold text-xl">
            !
          </div>
          <h1 className="mt-4 text-xl font-bold text-red-900 dark:text-red-200">
            Access Denied — HTTP 403 Forbidden
          </h1>
          <p className="mt-2 text-sm text-red-700 dark:text-red-300">
            Your account <span className="font-semibold">{user.username}</span> possesses the role <span className="font-semibold">{user.role}</span>. Administrative privileges are required to access moderation tools.
          </p>
          <div className="mt-6">
            <Link
              href="/dashboard"
              className="inline-flex rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 transition"
            >
              Return to Citizen Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Top Header */}
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 mb-2">
            🛡️ Administrative Management
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            Moderation Operations Console
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Platform incident oversight and citizen report verification dashboard.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/reports"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500 transition"
          >
            📋 Moderation Queue ({stats?.pending_reports || 0})
          </Link>
          <Link
            href="/dashboard"
            className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3.5 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50"
          >
            Citizen View
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-xl bg-red-50 p-4 border border-red-200 text-sm text-red-800">
          Failed to load administrative data: {error}
        </div>
      )}

      {/* Real Statistics Grid */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-5 shadow-sm">
            <span className="text-xs font-medium text-zinc-500 block">Total Reports</span>
            <span className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-100 mt-1 block">
              {stats.total_reports}
            </span>
            <span className="text-[11px] text-zinc-400 mt-1 block">All created incidents</span>
          </div>

          <div className="rounded-xl border border-blue-200 bg-blue-50/40 dark:border-blue-900/60 dark:bg-blue-950/20 p-5 shadow-sm">
            <span className="text-xs font-medium text-blue-700 dark:text-blue-300 block">
              Pending Moderation
            </span>
            <span className="text-2xl font-extrabold text-blue-800 dark:text-blue-200 mt-1 block">
              {stats.pending_reports}
            </span>
            <span className="text-[11px] text-blue-600 dark:text-blue-400 mt-1 block">
              Awaiting review
            </span>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50/40 dark:border-amber-900/60 dark:bg-amber-950/20 p-5 shadow-sm">
            <span className="text-xs font-medium text-amber-700 dark:text-amber-300 block">
              Under Review
            </span>
            <span className="text-2xl font-extrabold text-amber-800 dark:text-amber-200 mt-1 block">
              {stats.under_review_reports}
            </span>
            <span className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 block">
              Active field checks
            </span>
          </div>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/60 dark:bg-emerald-950/20 p-5 shadow-sm">
            <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300 block">
              Approved Reports
            </span>
            <span className="text-2xl font-extrabold text-emerald-800 dark:text-emerald-200 mt-1 block">
              {stats.approved_reports}
            </span>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 block">
              Platform verified
            </span>
          </div>

          <div className="rounded-xl border border-purple-200 bg-purple-50/40 dark:border-purple-900/60 dark:bg-purple-950/20 p-5 shadow-sm">
            <span className="text-xs font-medium text-purple-700 dark:text-purple-300 block">
              Needs Citizen Info
            </span>
            <span className="text-2xl font-extrabold text-purple-800 dark:text-purple-200 mt-1 block">
              {stats.needs_more_info_reports}
            </span>
            <span className="text-[11px] text-purple-600 dark:text-purple-400 mt-1 block">
              Returned to reporter
            </span>
          </div>

          <div className="rounded-xl border border-red-200 bg-red-50/40 dark:border-red-900/60 dark:bg-red-950/20 p-5 shadow-sm">
            <span className="text-xs font-medium text-red-700 dark:text-red-300 block">
              Rejected
            </span>
            <span className="text-2xl font-extrabold text-red-800 dark:text-red-200 mt-1 block">
              {stats.rejected_reports}
            </span>
            <span className="text-[11px] text-red-600 dark:text-red-400 mt-1 block">
              Unverified / spam
            </span>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-5 shadow-sm">
            <span className="text-xs font-medium text-zinc-500 block">Total Users</span>
            <span className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-100 mt-1 block">
              {stats.total_users}
            </span>
            <span className="text-[11px] text-zinc-400 mt-1 block">Registered accounts</span>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-5 shadow-sm">
            <span className="text-xs font-medium text-zinc-500 block">Anonymous Reports</span>
            <span className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-100 mt-1 block">
              {stats.anonymous_reports_count}
            </span>
            <span className="text-[11px] text-zinc-400 mt-1 block">Whistleblower mode</span>
          </div>
        </div>
      )}

      {/* Pending Reports Moderation Preview */}
      <div className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              Pending Submissions Awaiting Moderation
            </h2>
            <p className="text-xs text-zinc-500">
              Incidents requiring administrative review before platform approval.
            </p>
          </div>
          <Link
            href="/admin/reports?status=SUBMITTED"
            className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            View All Pending ({recentReports?.total || 0}) →
          </Link>
        </div>

        {recentReports && recentReports.items.length > 0 ? (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {recentReports.items.map((r) => (
              <div
                key={r.id}
                className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                      SUBMITTED
                    </span>
                    <span className="text-xs text-zinc-500">
                      {r.category?.name || "Incident"}
                    </span>
                    {r.is_anonymous && (
                      <span className="text-[10px] font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950 px-1.5 py-0.5 rounded">
                        Anonymous
                      </span>
                    )}
                  </div>
                  <Link
                    href={`/admin/reports/${r.id}`}
                    className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 hover:text-emerald-600 transition"
                  >
                    {r.title}
                  </Link>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    📍 {r.location_text} • Submitted {r.submitted_at ? new Date(r.submitted_at).toLocaleString() : "Recently"}
                  </p>
                </div>
                <div>
                  <Link
                    href={`/admin/reports/${r.id}`}
                    className="inline-flex items-center rounded-lg bg-zinc-900 dark:bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-white dark:text-zinc-900 hover:bg-zinc-800 transition"
                  >
                    Review Incident →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-zinc-500">
            🎉 No pending submissions in queue. All reports have been processed.
          </div>
        )}
      </div>
    </div>
  );
}
