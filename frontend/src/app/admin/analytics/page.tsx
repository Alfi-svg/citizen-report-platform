"use client";

import React, { useEffect, useState } from "react";
import AdminNav from "@/components/AdminNav";
import { apiFetch } from "@/lib/api";
import { AdminOperationsAnalyticsResponse } from "@/lib/types";

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AdminOperationsAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = () => {
    setLoading(true);
    apiFetch<AdminOperationsAnalyticsResponse>("/analytics/admin/operations")
      .then((res) => {
        setData(res);
        setError(null);
      })
      .catch((err: unknown) => {
        if (err instanceof Error) setError(err.message);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Admin Navigation */}
      <AdminNav />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
            Internal Operations & Moderation Analytics
          </h1>
          <p className="text-xs text-zinc-500">
            Administrative queue depths, moderator throughput, approval/rejection rates, and platform operations velocity.
          </p>
        </div>

        <button
          onClick={loadData}
          className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3.5 py-2 text-xs font-bold text-zinc-700 dark:text-zinc-300 shadow-xs hover:bg-zinc-50 transition shrink-0"
        >
          🔄 Refresh Metrics
        </button>
      </div>

      {error && (
        <div className="rounded-2xl bg-red-50 dark:bg-red-950/40 p-4 border border-red-200 text-xs text-red-700">
          {error}
        </div>
      )}

      {loading && !data ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
        </div>
      ) : data ? (
        <div className="space-y-6">
          {/* Operations Overview KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-xs space-y-1">
              <span className="text-xs font-semibold text-zinc-500 block">Pending Review Queue</span>
              <div className="text-3xl font-black text-amber-600">{data.pending_review_count}</div>
              <span className="text-[10px] text-zinc-400">Awaiting moderator action</span>
            </div>

            <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-xs space-y-1">
              <span className="text-xs font-semibold text-zinc-500 block">Approval Rate</span>
              <div className="text-3xl font-black text-emerald-600">{data.approval_rate_percentage}%</div>
              <span className="text-[10px] text-zinc-400">{data.approved_count} approved reports</span>
            </div>

            <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-xs space-y-1">
              <span className="text-xs font-semibold text-zinc-500 block">Flag Resolution Rate</span>
              <div className="text-3xl font-black text-indigo-600">{data.flag_resolution_rate_percentage}%</div>
              <span className="text-[10px] text-zinc-400">{data.pending_flags} flags pending</span>
            </div>

            <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-xs space-y-1">
              <span className="text-xs font-semibold text-zinc-500 block">Missing Cases Found</span>
              <div className="text-3xl font-black text-blue-600">{data.missing_resolution_rate_percentage}%</div>
              <span className="text-[10px] text-zinc-400">{data.found_missing_alerts} resolved / {data.total_missing_alerts} total</span>
            </div>
          </div>

          {/* Status Distribution Progress */}
          <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm space-y-4">
            <h2 className="text-base font-extrabold text-zinc-900 dark:text-zinc-100">
              Report Status Breakdown ({data.total_reports_all_statuses} Total Submissions)
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              {data.status_distribution.map((st) => (
                <div key={st.status} className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800 space-y-1">
                  <div className="flex items-center justify-between font-bold">
                    <span className="text-zinc-800 dark:text-zinc-200">{st.status}</span>
                    <span className="text-zinc-500">{st.count} ({st.percentage}%)</span>
                  </div>
                  <div className="h-2 w-full bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        st.status === "APPROVED" ? "bg-emerald-600" : st.status === "REJECTED" ? "bg-red-600" : st.status === "UNDER_REVIEW" ? "bg-amber-500" : "bg-zinc-400"
                      }`}
                      style={{ width: `${Math.max(2, st.percentage)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Moderator Performance Table */}
          {data.moderator_performance && data.moderator_performance.length > 0 && (
            <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm space-y-4">
              <h2 className="text-base font-extrabold text-zinc-900 dark:text-zinc-100">
                Moderator Audit & Throughput
              </h2>

              <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800">
                <table className="w-full text-left text-xs text-zinc-700 dark:text-zinc-300">
                  <thead className="bg-zinc-50 dark:bg-zinc-800 font-semibold text-zinc-900 dark:text-zinc-100">
                    <tr>
                      <th className="p-3.5">Admin Username</th>
                      <th className="p-3.5">Total Actions</th>
                      <th className="p-3.5">Approvals</th>
                      <th className="p-3.5">Rejections</th>
                      <th className="p-3.5">Info Requests</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {data.moderator_performance.map((m) => (
                      <tr key={m.admin_id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                        <td className="p-3.5 font-bold text-zinc-900 dark:text-zinc-100">{m.admin_name}</td>
                        <td className="p-3.5 font-semibold text-indigo-600">{m.actions_count}</td>
                        <td className="p-3.5 text-emerald-600 font-semibold">{m.approved_count}</td>
                        <td className="p-3.5 text-red-600 font-semibold">{m.rejected_count}</td>
                        <td className="p-3.5 text-purple-600 font-semibold">{m.info_requested_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
