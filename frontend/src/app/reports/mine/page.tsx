"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { Report, ReportStatus } from "@/lib/types";

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
    label: "Submitted",
    bg: "bg-blue-100 dark:bg-blue-950",
    text: "text-blue-700 dark:text-blue-300",
    dot: "bg-blue-500",
  },
  UNDER_REVIEW: {
    label: "Under Review",
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
    label: "Rejected",
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

export default function MyReportsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>("ALL");

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    let isMounted = true;
    if (isAuthenticated) {
      apiFetch<Report[]>("/reports/mine")
        .then((data) => {
          if (isMounted) setReports(data);
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
  }, [isAuthenticated]);

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  const filteredReports = reports.filter((r) => {
    if (activeFilter === "ALL") return true;
    return r.status === activeFilter;
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            My Incident Reports
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Track the status of your draft submissions and verified citizen reports.
          </p>
        </div>
        <div>
          <Link
            href="/reports/create"
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500 transition"
          >
            + Create New Report
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-xl bg-red-50 p-4 border border-red-200 text-sm text-red-800">
          Failed to load reports: {error}
        </div>
      )}

      {/* Filter Tabs */}
      <div className="mb-6 flex flex-wrap gap-2">
        {["ALL", "DRAFT", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "NEEDS_MORE_INFORMATION"].map((f) => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              activeFilter === f
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50"
            }`}
          >
            {f === "ALL" ? "All Reports" : STATUS_BADGES[f as ReportStatus]?.label || f} (
            {f === "ALL" ? reports.length : reports.filter((r) => r.status === f).length})
          </button>
        ))}
      </div>

      {/* Reports List */}
      {filteredReports.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400">
            📋
          </div>
          <h3 className="mt-4 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {activeFilter === "ALL" ? "No incident reports found" : `No reports with status: ${activeFilter}`}
          </h3>
          <p className="mt-1 text-xs text-zinc-500">
            {activeFilter === "ALL"
              ? "You haven't submitted any citizen reports yet. Submit an incident to alert local authorities."
              : "Try switching to another filter or create a new report."}
          </p>
          {activeFilter === "ALL" && (
            <div className="mt-6">
              <Link
                href="/reports/create"
                className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500 transition"
              >
                Create Incident Report
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredReports.map((report) => {
            const badge = STATUS_BADGES[report.status] || STATUS_BADGES.DRAFT;
            return (
              <div
                key={report.id}
                className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-5 shadow-sm hover:border-zinc-300 dark:hover:border-zinc-700 transition"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${badge.bg} ${badge.text}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
                      {badge.label}
                    </span>
                    <span className="text-xs font-medium text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                      {report.category?.name || "Incident"}
                    </span>
                    {report.is_anonymous && (
                      <span className="text-xs font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950 px-2 py-0.5 rounded">
                        Anonymous
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-zinc-400">
                    Created {new Date(report.created_at).toLocaleDateString()}
                  </span>
                </div>

                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mb-1">
                  <Link href={`/reports/${report.id}`} className="hover:text-emerald-600 transition">
                    {report.title}
                  </Link>
                </h3>

                <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2 mb-3">
                  {report.description}
                </p>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800 text-xs text-zinc-500">
                  <div className="flex items-center gap-1">
                    <span>📍</span>
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">
                      {report.location_text}
                    </span>
                  </div>
                  <Link
                    href={`/reports/${report.id}`}
                    className="font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    {report.status === "DRAFT" || report.status === "NEEDS_MORE_INFORMATION"
                      ? "Edit / Submit →"
                      : "View Details →"}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
