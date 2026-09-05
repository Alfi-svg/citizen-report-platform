"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { AdminDashboardStats, AdminReportPagination } from "@/lib/types";
import AdminNav from "@/components/AdminNav";

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
            Your account possesses the role <span className="font-semibold">{user.role}</span>. Administrative privileges are required.
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
    <div>
      <AdminNav
        pendingReports={stats?.pending_reports}
        pendingFlags={stats?.pending_flags}
      />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* Top Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 mb-2">
              🛡️ Administrative Console
            </div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              Platform Operations & Governance
            </h1>
            <p className="text-xs text-zinc-500 mt-1">
              Centralized platform metrics, moderation workflows, user management, and safety controls.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <Link
              href="/admin/reports"
              className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500 transition"
            >
              📋 Reports Queue ({stats?.pending_reports || 0})
            </Link>
            <Link
              href="/admin/flags"
              className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-amber-500 transition"
            >
              🚩 Safety Flags ({stats?.pending_flags || 0})
            </Link>
          </div>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 p-4 border border-red-200 text-xs text-red-800">
            Failed to load administrative data: {error}
          </div>
        )}

        {/* Primary Platform Metrics */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            <div className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-3.5 sm:p-4 shadow-sm">
              <span className="text-[11px] font-medium text-zinc-500 block">Total Reports</span>
              <span className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-100 mt-1 block">
                {stats.total_reports}
              </span>
              <span className="text-[10px] text-zinc-400 mt-1 block">All created incidents</span>
            </div>

            <div className="rounded-2xl border border-blue-200 bg-blue-50/40 dark:border-blue-900/60 dark:bg-blue-950/20 p-3.5 sm:p-4 shadow-sm">
              <span className="text-[11px] font-medium text-blue-700 dark:text-blue-300 block">
                Pending Review
              </span>
              <span className="text-2xl font-extrabold text-blue-800 dark:text-blue-200 mt-1 block">
                {stats.pending_reports}
              </span>
              <span className="text-[10px] text-blue-600 dark:text-blue-400 mt-1 block">
                Awaiting moderation
              </span>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50/40 dark:border-amber-900/60 dark:bg-amber-950/20 p-3.5 sm:p-4 shadow-sm">
              <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300 block">
                Under Review
              </span>
              <span className="text-2xl font-extrabold text-amber-800 dark:text-amber-200 mt-1 block">
                {stats.under_review_reports}
              </span>
              <span className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 block">
                Active investigation
              </span>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/60 dark:bg-emerald-950/20 p-3.5 sm:p-4 shadow-sm">
              <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300 block">
                Verified & Published
              </span>
              <span className="text-2xl font-extrabold text-emerald-800 dark:text-emerald-200 mt-1 block">
                {stats.approved_reports}
              </span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 block">
                Live on public feed
              </span>
            </div>

            <div className="rounded-2xl border border-purple-200 bg-purple-50/40 dark:border-purple-900/60 dark:bg-purple-950/20 p-3.5 sm:p-4 shadow-sm">
              <span className="text-[11px] font-medium text-purple-700 dark:text-purple-300 block">
                Total Users
              </span>
              <span className="text-2xl font-extrabold text-purple-800 dark:text-purple-200 mt-1 block">
                {stats.total_users}
              </span>
              <span className="text-[10px] text-purple-600 dark:text-purple-400 mt-1 block">
                Registered citizens
              </span>
            </div>

            <div className="rounded-2xl border border-cyan-200 bg-cyan-50/40 dark:border-cyan-900/60 dark:bg-cyan-950/20 p-3.5 sm:p-4 shadow-sm">
              <span className="text-[11px] font-medium text-cyan-700 dark:text-cyan-300 block">
                Safety Flags
              </span>
              <span className="text-2xl font-extrabold text-cyan-800 dark:text-cyan-200 mt-1 block">
                {stats.total_flags || 0}
              </span>
              <span className="text-[10px] text-cyan-600 dark:text-cyan-400 mt-1 block">
                {stats.pending_flags || 0} pending review
              </span>
            </div>
          </div>
        )}

        {/* Quick Operations Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/admin/users"
            className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-sm hover:border-amber-400 dark:hover:border-amber-600 transition space-y-2 text-xs"
          >
            <div className="flex items-center gap-2 text-amber-600 font-bold text-sm">
              <span>👥</span>
              <span>User & Role Governance</span>
            </div>
            <p className="text-zinc-500">
              Inspect registered accounts, assign administrative roles with self-protection guards, and toggle active status.
            </p>
          </Link>

          <Link
            href="/admin/categories"
            className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-sm hover:border-emerald-400 dark:hover:border-emerald-600 transition space-y-2 text-xs"
          >
            <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm">
              <span>🏷️</span>
              <span>Category Management</span>
            </div>
            <p className="text-zinc-500">
              Manage incident classifications, create new report tags, and safely deactivate categories while preserving report links.
            </p>
          </Link>

          <Link
            href="/admin/comments"
            className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-sm hover:border-blue-400 dark:hover:border-blue-600 transition space-y-2 text-xs"
          >
            <div className="flex items-center gap-2 text-blue-600 font-bold text-sm">
              <span>💬</span>
              <span>Comments Moderation</span>
            </div>
            <p className="text-zinc-500">
              Audit public discussion threads on approved reports, hide spam or abusive remarks, and issue moderation notices.
            </p>
          </Link>
        </div>

        {/* Recent Pending Reports Preview */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <span>📋 Recent Submissions Awaiting Moderation</span>
            </h2>
            <Link
              href="/admin/reports"
              className="text-xs font-semibold text-emerald-600 hover:underline"
            >
              Open Full Queue →
            </Link>
          </div>

          {!recentReports || recentReports.items.length === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-400 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
              No reports currently pending moderation review.
            </div>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {recentReports.items.map((r) => (
                <div key={r.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                  <div className="space-y-0.5">
                    <Link
                      href={`/admin/reports/${r.id}`}
                      className="font-bold text-zinc-900 dark:text-zinc-100 hover:text-emerald-600"
                    >
                      {r.title}
                    </Link>
                    <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                      <span>{r.category?.name || "Incident"}</span>
                      <span>•</span>
                      <span>{r.location_text}</span>
                      <span>•</span>
                      <span>{new Date(r.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <Link
                    href={`/admin/reports/${r.id}`}
                    className="rounded-lg bg-zinc-100 dark:bg-zinc-800 px-3 py-1 text-[11px] font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 transition"
                  >
                    Review →
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
