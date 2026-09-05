"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { Report } from "@/lib/types";

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout, isAdmin } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    let isMounted = true;
    if (isAuthenticated) {
      apiFetch<Report[]>("/reports/mine")
        .then((data) => {
          if (isMounted) setReports(data);
        })
        .catch(() => {})
        .finally(() => {
          if (isMounted) setLoadingReports(false);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-700 border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const draftsCount = reports.filter((r) => r.status === "DRAFT").length;
  const inReviewCount = reports.filter(
    (r) => r.status === "SUBMITTED" || r.status === "UNDER_REVIEW"
  ).length;
  const approvedCount = reports.filter((r) => r.status === "APPROVED").length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* 1. Citizen Profile Banner */}
      <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-8 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-emerald-700 text-white flex items-center justify-center text-2xl font-black shadow-md shadow-emerald-700/20 shrink-0">
              {(user.full_name || user.username).charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
                  {user.full_name || user.username}
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  {user.role}
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-0.5">
                @{user.username} • Verified Citizen Reporter
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {isAdmin && (
              <Link
                href="/admin"
                className="rounded-xl bg-amber-600 hover:bg-amber-500 text-white px-3.5 py-2 text-xs font-bold shadow-xs transition"
              >
                Admin Panel
              </Link>
            )}
            <Link
              href="/reports/create"
              className="rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white px-4 py-2 text-xs font-bold shadow-xs transition"
            >
              + New Report
            </Link>
            <button
              onClick={logout}
              className="rounded-xl border border-zinc-200 dark:border-zinc-700 px-3.5 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Contribution KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-6 border-t border-zinc-100 dark:border-zinc-800">
          <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 p-4 text-center">
            <span className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-zinc-100 block">
              {reports.length}
            </span>
            <span className="text-[11px] text-zinc-500 font-medium">
              Total Submissions
            </span>
          </div>

          <div className="rounded-2xl bg-zinc-100/80 dark:bg-zinc-800/80 p-4 text-center">
            <span className="text-xl sm:text-2xl font-black text-zinc-700 dark:text-zinc-300 block">
              {draftsCount}
            </span>
            <span className="text-[11px] text-zinc-500 font-medium">
              Saved Drafts
            </span>
          </div>

          <div className="rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 p-4 text-center border border-amber-200/40 dark:border-amber-900/40">
            <span className="text-xl sm:text-2xl font-black text-amber-700 dark:text-amber-400 block">
              {inReviewCount}
            </span>
            <span className="text-[11px] text-amber-800/80 dark:text-amber-300 font-medium">
              In Active Review
            </span>
          </div>

          <div className="rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 p-4 text-center border border-emerald-200/40 dark:border-emerald-900/40">
            <span className="text-xl sm:text-2xl font-black text-emerald-700 dark:text-emerald-400 block">
              {approvedCount}
            </span>
            <span className="text-[11px] text-emerald-800/80 dark:text-emerald-300 font-medium">
              Verified & Published
            </span>
          </div>
        </div>
      </div>

      {/* 2. My Reports List */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-100">
            My Incident Reports
          </h2>
          <span className="text-xs text-zinc-500">
            {reports.length} report{reports.length !== 1 ? "s" : ""} recorded
          </span>
        </div>

        {loadingReports ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-20 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 animate-pulse"
              />
            ))}
          </div>
        ) : reports.length === 0 ? (
          <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-12 text-center space-y-3">
            <div className="text-4xl">📝</div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              You haven&apos;t filed any incident reports yet
            </h3>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              Help keep your neighborhood safe by submitting verified reports of civic hazards or safety incidents.
            </p>
            <Link
              href="/reports/create"
              className="inline-block mt-2 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-600 transition"
            >
              Submit Your First Report
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => (
              <div
                key={report.id}
                className="group rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 hover:border-emerald-700/40 dark:hover:border-emerald-500/40 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        report.status === "APPROVED"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          : report.status === "REJECTED"
                          ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                          : report.status === "DRAFT"
                          ? "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                      }`}
                    >
                      {report.status}
                    </span>
                    <span className="text-[11px] text-zinc-400">
                      {new Date(report.created_at).toLocaleDateString()}
                    </span>
                    {report.is_anonymous && (
                      <span className="text-[10px] font-semibold text-purple-700 dark:text-purple-300">
                        🛡️ Anonymous
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">
                    <Link href={`/reports/${report.id}`} className="hover:text-emerald-700 dark:hover:text-emerald-400 transition">
                      {report.title}
                    </Link>
                  </h3>

                  <p className="text-xs text-zinc-500 truncate max-w-md">
                    📍 {report.location_text}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={`/reports/${report.id}`}
                    className="rounded-xl border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
                  >
                    View Details →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
