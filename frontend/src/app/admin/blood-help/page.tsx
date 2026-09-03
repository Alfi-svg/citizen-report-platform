"use client";

import React, { useState, useEffect } from "react";
import AdminNav from "@/components/AdminNav";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";

interface AdminBloodRequest {
  id: string;
  user_id: string;
  requester_name: string;
  blood_group: string;
  units_required: number;
  hospital_name: string;
  hospital_area: string;
  district: string;
  urgency: string;
  status: string;
  is_active: boolean;
  contact_name?: string | null;
  contact_phone?: string | null;
  contact_method: string;
  additional_information?: string | null;
  flag_count: number;
  response_count: number;
  required_date: string;
  created_at: string;
}

interface AdminBloodFlag {
  id: string;
  request_id: string;
  hospital_name: string;
  blood_group: string;
  reason: string;
  details?: string | null;
  status: string;
  reporter_name: string;
  created_at: string;
}

export default function AdminBloodHelpPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<"REQUESTS" | "FLAGS">("REQUESTS");

  // Requests state
  const [requests, setRequests] = useState<AdminBloodRequest[]>([]);
  const [totalRequests, setTotalRequests] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [loadingRequests, setLoadingRequests] = useState(true);

  // Flags state
  const [flags, setFlags] = useState<AdminBloodFlag[]>([]);
  const [totalFlags, setTotalFlags] = useState(0);
  const [loadingFlags, setLoadingFlags] = useState(false);

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadRequests = async () => {
    setLoadingRequests(true);
    try {
      const url = statusFilter
        ? `/admin/blood/requests?status=${statusFilter}&limit=50`
        : `/admin/blood/requests?limit=50`;
      const data = await apiFetch<{ items: AdminBloodRequest[]; total: number }>(url);
      setRequests(data.items);
      setTotalRequests(data.total);
    } catch {
      // Handled
    } finally {
      setLoadingRequests(false);
    }
  };

  const loadFlags = async () => {
    setLoadingFlags(true);
    try {
      const data = await apiFetch<{ items: AdminBloodFlag[]; total: number }>(
        "/admin/blood/flags?limit=50"
      );
      setFlags(data.items);
      setTotalFlags(data.total);
    } catch {
      // Handled
    } finally {
      setLoadingFlags(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && user?.role === "ADMIN") {
      if (activeTab === "REQUESTS") loadRequests();
      else loadFlags();
    }
  }, [activeTab, statusFilter, isAuthenticated, user]);

  const handleToggleActive = async (req: AdminBloodRequest) => {
    setActionLoading(req.id);
    try {
      await apiFetch(`/admin/blood/requests/${req.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !req.is_active }),
      });
      setMessage(`Request ${req.is_active ? "deactivated" : "reactivated"} successfully.`);
      loadRequests();
    } catch (err: unknown) {
      if (err instanceof Error) alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleResolveFlag = async (flagId: string, deactivate = false) => {
    setActionLoading(flagId);
    try {
      await apiFetch(`/admin/blood/flags/${flagId}/resolve`, {
        method: "POST",
        body: JSON.stringify({ action: "RESOLVE", deactivate_request: deactivate }),
      });
      setMessage("Flag resolved successfully.");
      loadFlags();
    } catch (err: unknown) {
      if (err instanceof Error) alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  if (authLoading) return <div className="p-8 text-center text-xs">Checking authorization...</div>;
  if (!isAuthenticated || user?.role !== "ADMIN") {
    return <div className="p-8 text-center text-xs text-red-600">Administrator access required.</div>;
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <AdminNav />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/60 mb-2">
              <span>🩸</span>
              <span>Blood Help Administration</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
              Blood Requests &amp; Safety Moderation
            </h1>
            <p className="text-xs text-zinc-500">
              Review published blood requests, inspect safety flags, and deactivate abusive submissions.
            </p>
          </div>

          {/* Tab Switcher */}
          <div className="flex rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-1 shadow-2xs">
            <button
              type="button"
              onClick={() => setActiveTab("REQUESTS")}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
                activeTab === "REQUESTS"
                  ? "bg-rose-600 text-white shadow-2xs"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
              }`}
            >
              Requests ({totalRequests})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("FLAGS")}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
                activeTab === "FLAGS"
                  ? "bg-rose-600 text-white shadow-2xs"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
              }`}
            >
              Flags ({totalFlags})
            </button>
          </div>
        </div>

        {message && (
          <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 text-xs text-emerald-700 dark:text-emerald-300">
            {message}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 1: REQUESTS */}
        {/* ========================================================= */}
        {activeTab === "REQUESTS" && (
          <div className="space-y-4">
            {/* Filter */}
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-zinc-400">Filter Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2 text-xs text-zinc-800 dark:text-zinc-200"
              >
                <option value="">All Statuses</option>
                <option value="OPEN">OPEN</option>
                <option value="RESPONDED">RESPONDED</option>
                <option value="FULFILLED">FULFILLED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </div>

            {loadingRequests ? (
              <div className="p-12 text-center text-xs text-zinc-400">Loading requests...</div>
            ) : requests.length === 0 ? (
              <div className="p-12 text-center text-xs text-zinc-400 rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800">
                No blood requests found.
              </div>
            ) : (
              <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-850 text-zinc-500 font-bold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="p-4">Group</th>
                        <th className="p-4">Hospital &amp; Area</th>
                        <th className="p-4">Requester</th>
                        <th className="p-4">Urgency</th>
                        <th className="p-4">Status</th>
                        <th className="p-4">Flags</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-zinc-700 dark:text-zinc-300">
                      {requests.map((r) => (
                        <tr key={r.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40 transition">
                          <td className="p-4">
                            <span className="font-black bg-rose-600 text-white px-2 py-0.5 rounded-lg text-xs">
                              {r.blood_group}
                            </span>
                            <span className="ml-1.5 font-semibold text-zinc-500">
                              {r.units_required} bag(s)
                            </span>
                          </td>
                          <td className="p-4">
                            <strong className="block text-zinc-900 dark:text-zinc-100">{r.hospital_name}</strong>
                            <span className="text-[11px] text-zinc-400">{r.hospital_area}, {r.district}</span>
                          </td>
                          <td className="p-4">
                            <span>{r.requester_name}</span>
                            {r.contact_phone && (
                              <span className="block font-mono text-[10px] text-zinc-400">{r.contact_phone}</span>
                            )}
                          </td>
                          <td className="p-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                r.urgency === "EMERGENCY"
                                  ? "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                                  : r.urgency === "URGENT"
                                  ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                                  : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                              }`}
                            >
                              {r.urgency}
                            </span>
                          </td>
                          <td className="p-4">
                            <span className="font-semibold text-[11px]">{r.status}</span>
                            {!r.is_active && (
                              <span className="ml-1 text-[10px] text-red-600 font-bold">(Inactive)</span>
                            )}
                          </td>
                          <td className="p-4">
                            {r.flag_count > 0 ? (
                              <span className="font-bold text-red-600 bg-red-50 dark:bg-red-950 px-2 py-0.5 rounded-full">
                                🚩 {r.flag_count}
                              </span>
                            ) : (
                              <span className="text-zinc-400">0</span>
                            )}
                          </td>
                          <td className="p-4 text-right space-x-2">
                            <Link
                              href={`/blood-help/${r.id}`}
                              className="px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 text-[11px] font-semibold"
                            >
                              View
                            </Link>
                            <button
                              type="button"
                              onClick={() => handleToggleActive(r)}
                              disabled={actionLoading === r.id}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                                r.is_active
                                  ? "bg-red-50 text-red-700 hover:bg-red-100 border border-red-200"
                                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                              }`}
                            >
                              {actionLoading === r.id ? "..." : r.is_active ? "Deactivate" : "Activate"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: FLAGS */}
        {/* ========================================================= */}
        {activeTab === "FLAGS" && (
          <div className="space-y-4">
            {loadingFlags ? (
              <div className="p-12 text-center text-xs text-zinc-400">Loading flags...</div>
            ) : flags.length === 0 ? (
              <div className="p-12 text-center text-xs text-zinc-400 rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800">
                No active safety flags on blood requests.
              </div>
            ) : (
              <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-850 text-zinc-500 font-bold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="p-4">Target Request</th>
                        <th className="p-4">Reason</th>
                        <th className="p-4">Reporter</th>
                        <th className="p-4">Date</th>
                        <th className="p-4 text-right">Moderation Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-zinc-700 dark:text-zinc-300">
                      {flags.map((f) => (
                        <tr key={f.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40 transition">
                          <td className="p-4">
                            <strong className="block text-zinc-900 dark:text-zinc-100">{f.hospital_name}</strong>
                            <span className="text-[11px] text-zinc-400">Group: {f.blood_group}</span>
                          </td>
                          <td className="p-4">
                            <span className="font-bold text-red-600 block">{f.reason}</span>
                            {f.details && <p className="text-[11px] text-zinc-500 mt-0.5">{f.details}</p>}
                          </td>
                          <td className="p-4 text-zinc-600 dark:text-zinc-400">
                            {f.reporter_name}
                          </td>
                          <td className="p-4 text-zinc-400 text-[11px]">
                            {new Date(f.created_at).toLocaleDateString()}
                          </td>
                          <td className="p-4 text-right space-x-2">
                            <button
                              type="button"
                              onClick={() => handleResolveFlag(f.id, true)}
                              disabled={actionLoading === f.id}
                              className="px-3 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold shadow-2xs cursor-pointer"
                            >
                              Resolve &amp; Deactivate
                            </button>
                            <button
                              type="button"
                              onClick={() => handleResolveFlag(f.id, false)}
                              disabled={actionLoading === f.id}
                              className="px-3 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 text-[11px] font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                            >
                              Dismiss Flag
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
