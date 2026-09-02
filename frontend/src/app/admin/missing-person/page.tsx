"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import AdminNav from "@/components/AdminNav";
import { apiFetch } from "@/lib/api";
import {
  AdminMissingPersonAlertResponse,
  AdminMissingPersonAlertPagination,
  AlertStatus,
} from "@/lib/types";

export default function AdminMissingPersonPage() {
  const [data, setData] = useState<AdminMissingPersonAlertPagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 15;

  // Modal States
  const [activeModalAlert, setActiveModalAlert] = useState<AdminMissingPersonAlertResponse | null>(null);
  const [modalType, setModalType] = useState<"ACTIVATE" | "FOUND" | "CLOSE" | null>(null);
  const [alertRadius, setAlertRadius] = useState<number>(10.0);
  const [expiryDays, setExpiryDays] = useState<number>(30);
  const [notes, setNotes] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const loadAlerts = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.append("alert_status", statusFilter);
    if (search.trim()) params.append("search", search.trim());
    params.append("limit", PAGE_SIZE.toString());
    params.append("offset", (page * PAGE_SIZE).toString());

    apiFetch<AdminMissingPersonAlertPagination>(`/admin/missing-person/alerts?${params.toString()}`)
      .then((res) => setData(res))
      .catch((err: unknown) => {
        if (err instanceof Error) setError(err.message);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAlerts();
  }, [statusFilter, search, page]);

  const handleOpenModal = (alert: AdminMissingPersonAlertResponse, type: "ACTIVATE" | "FOUND" | "CLOSE") => {
    setActiveModalAlert(alert);
    setModalType(type);
    setNotes("");
    setAlertRadius(alert.alert_radius_km || 10.0);
    setExpiryDays(30);
    setModalError(null);
  };

  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModalAlert || !modalType) return;
    setSubmitting(true);
    setModalError(null);

    try {
      if (modalType === "ACTIVATE") {
        await apiFetch(`/admin/missing-person/alerts/${activeModalAlert.id}/activate`, {
          method: "POST",
          body: JSON.stringify({
            alert_radius_km: alertRadius,
            alert_expiry_days: expiryDays,
            activation_notes: notes.trim() || null,
          }),
        });
      } else if (modalType === "FOUND") {
        await apiFetch(`/admin/missing-person/alerts/${activeModalAlert.id}/found`, {
          method: "POST",
          body: JSON.stringify({
            found_notes: notes.trim() || null,
          }),
        });
      } else if (modalType === "CLOSE") {
        await apiFetch(`/admin/missing-person/alerts/${activeModalAlert.id}/close`, {
          method: "POST",
        });
      }
      setActiveModalAlert(null);
      setModalType(null);
      loadAlerts();
    } catch (err: unknown) {
      if (err instanceof Error) setModalError(err.message);
      else setModalError("Action failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Admin Navigation */}
      <AdminNav />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-100">
            Missing Person Alert Moderation
          </h1>
          <p className="text-xs text-zinc-500">
            Review missing person reports, verify identity and evidence, activate geospatial radius alerts, and track community sightings.
          </p>
        </div>

        <Link
          href="/admin/missing-person/sightings"
          className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-2.5 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 transition shrink-0"
        >
          👁️ Sightings Moderation Queue →
        </Link>
      </div>

      {/* Filters Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <div className="sm:col-span-6">
          <input
            type="text"
            placeholder="Search by name, last seen area, or contact..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3.5 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <div className="sm:col-span-6">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(0);
            }}
            className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="">All Alert Statuses</option>
            <option value="ALERT_PENDING">Pending Verification</option>
            <option value="ALERT_ACTIVE">Active Alert</option>
            <option value="FOUND">Found / Resolved</option>
            <option value="EXPIRED">Expired</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>
      </div>

      {/* Directory Table */}
      {error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-950/40 p-4 border border-red-200 text-xs text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-red-600 border-t-transparent" />
        </div>
      ) : !data || data.items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 p-12 text-center text-xs text-zinc-500">
          No missing person alert records found.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
            <table className="w-full text-left text-xs text-zinc-700 dark:text-zinc-300">
              <thead className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 font-semibold text-zinc-900 dark:text-zinc-100">
                <tr>
                  <th className="p-3.5">Person Profile</th>
                  <th className="p-3.5">Last Seen</th>
                  <th className="p-3.5">Alert Status</th>
                  <th className="p-3.5">Sightings</th>
                  <th className="p-3.5">Duplicates</th>
                  <th className="p-3.5 text-right">Moderation Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {data.items.map((alert) => (
                  <tr key={alert.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition">
                    <td className="p-3.5">
                      <div className="flex items-center gap-3">
                        {alert.profile.photo_url ? (
                          <img
                            src={alert.profile.photo_url}
                            alt={alert.profile.full_name}
                            className="h-10 w-10 rounded-xl object-cover border border-zinc-200 shrink-0"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800 text-lg shrink-0">
                            👤
                          </div>
                        )}
                        <div>
                          <div className="font-bold text-zinc-900 dark:text-zinc-100">{alert.profile.full_name}</div>
                          {alert.profile.name_bn && <div className="text-[11px] text-zinc-500">{alert.profile.name_bn}</div>}
                          <div className="text-[10px] text-zinc-400">
                            Age: {alert.profile.age ?? "N/A"} • {alert.profile.gender ?? "N/A"}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="p-3.5">
                      <div className="font-semibold text-zinc-800 dark:text-zinc-200">{alert.profile.last_seen_location}</div>
                      <div className="text-[11px] text-zinc-400 font-mono">
                        {alert.profile.last_seen_latitude?.toFixed(4)}, {alert.profile.last_seen_longitude?.toFixed(4)}
                      </div>
                    </td>

                    <td className="p-3.5">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                        alert.status === "ALERT_ACTIVE"
                          ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 animate-pulse"
                          : alert.status === "FOUND"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                      }`}>
                        {alert.status}
                      </span>
                    </td>

                    <td className="p-3.5">
                      <Link
                        href={`/admin/missing-person/sightings?alert_id=${alert.id}`}
                        className="font-bold text-blue-600 hover:underline flex items-center gap-1"
                      >
                        <span>👁️ {alert.total_sightings_count}</span>
                        {alert.pending_sightings_count > 0 && (
                          <span className="rounded-full bg-red-600 text-white text-[9px] px-1 py-0.2">
                            {alert.pending_sightings_count} pending
                          </span>
                        )}
                      </Link>
                    </td>

                    <td className="p-3.5">
                      {alert.duplicate_candidates_count > 0 ? (
                        <span className="inline-flex rounded-md bg-amber-100 text-amber-800 px-2 py-0.5 text-[10px] font-bold">
                          ⚠️ {alert.duplicate_candidates_count} possible
                        </span>
                      ) : (
                        <span className="text-zinc-400 text-[11px]">None</span>
                      )}
                    </td>

                    <td className="p-3.5 text-right space-x-2">
                      <Link
                        href={`/missing-person/${alert.id}`}
                        target="_blank"
                        className="font-semibold text-zinc-500 hover:underline"
                      >
                        Public View
                      </Link>

                      {alert.status !== "ALERT_ACTIVE" && alert.status !== "FOUND" && (
                        <button
                          onClick={() => handleOpenModal(alert, "ACTIVATE")}
                          className="font-bold text-red-600 hover:underline"
                        >
                          Activate Alert
                        </button>
                      )}

                      {alert.status === "ALERT_ACTIVE" && (
                        <>
                          <button
                            onClick={() => handleOpenModal(alert, "FOUND")}
                            className="font-bold text-emerald-600 hover:underline"
                          >
                            Mark Found
                          </button>
                          <button
                            onClick={() => handleOpenModal(alert, "CLOSE")}
                            className="font-semibold text-zinc-500 hover:underline"
                          >
                            Close
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-zinc-500">
              Showing {data.items.length} of {data.total} records
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation & Configuration Modal */}
      {modalType && activeModalAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-zinc-900 p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h3 className="text-base font-extrabold text-zinc-900 dark:text-zinc-100">
                {modalType === "ACTIVATE"
                  ? "🚨 Activate Missing Person Alert"
                  : modalType === "FOUND"
                  ? "✅ Mark Missing Person as FOUND"
                  : "Close Missing Person Alert"}
              </h3>
              <button
                onClick={() => {
                  setModalType(null);
                  setActiveModalAlert(null);
                }}
                className="text-zinc-400 hover:text-zinc-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {modalError && (
              <div className="rounded-xl bg-red-50 dark:bg-red-950/40 p-3 text-xs text-red-700">
                {modalError}
              </div>
            )}

            <form onSubmit={handleModalSubmit} className="space-y-4 text-xs">
              <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-800 p-3 text-zinc-700 dark:text-zinc-300">
                <strong>Subject:</strong> {activeModalAlert.profile.full_name} ({activeModalAlert.profile.age} y/o)
                <div className="text-[11px] text-zinc-500">
                  Last seen: {activeModalAlert.profile.last_seen_location}
                </div>
              </div>

              {modalType === "ACTIVATE" && (
                <>
                  <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/40 p-3.5 border border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200">
                    <strong>⚠️ CONFIRMATION REQUIRED:</strong>
                    <p className="text-[11px] mt-1">
                      MISSING PERSON ALERT WILL BE VISIBLE TO ELIGIBLE USERS AND NOTIFICATIONS WILL BE DISPATCHED TO OPTED-IN USERS WITHIN THE SELECTED RADIUS.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        Alert Radius *
                      </label>
                      <select
                        value={alertRadius}
                        onChange={(e) => setAlertRadius(parseFloat(e.target.value))}
                        className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-2.5"
                      >
                        <option value={1.0}>1 km (Local Area)</option>
                        <option value={3.0}>3 km (Sub-District)</option>
                        <option value={5.0}>5 km (Ward / Zone)</option>
                        <option value={10.0}>10 km (Metropolitan)</option>
                        <option value={25.0}>25 km (District-Wide)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        Alert Expiry (Days) *
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={90}
                        value={expiryDays}
                        onChange={(e) => setExpiryDays(parseInt(e.target.value) || 30)}
                        className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-2.5"
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  {modalType === "ACTIVATE"
                    ? "Verification Notes / Authority Record"
                    : modalType === "FOUND"
                    ? "Recovery Notes & Authority Confirmation"
                    : "Closure Reason"}
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Enter moderation details, authority contact, or verification log..."
                  className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-2.5"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => {
                    setModalType(null);
                    setActiveModalAlert(null);
                  }}
                  className="rounded-xl border border-zinc-300 dark:border-zinc-700 px-4 py-2 font-semibold text-zinc-700 dark:text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`rounded-xl px-5 py-2 font-bold text-white shadow-sm disabled:opacity-50 ${
                    modalType === "ACTIVATE"
                      ? "bg-red-600 hover:bg-red-500"
                      : modalType === "FOUND"
                      ? "bg-emerald-600 hover:bg-emerald-500"
                      : "bg-zinc-800 hover:bg-zinc-700"
                  }`}
                >
                  {submitting ? "Processing..." : `Confirm ${modalType}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
