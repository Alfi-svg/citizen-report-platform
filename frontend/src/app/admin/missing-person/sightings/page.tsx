"use client";

import React, { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AdminNav from "@/components/AdminNav";
import { apiFetch } from "@/lib/api";
import { AdminMissingPersonSightingResponse, SightingStatus } from "@/lib/types";

function SightingsContent() {
  const searchParams = useSearchParams();
  const alertIdParam = searchParams.get("alert_id");

  const [sightings, setSightings] = useState<AdminMissingPersonSightingResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>("");
  const [activeSighting, setActiveSighting] = useState<AdminMissingPersonSightingResponse | null>(null);
  const [targetStatus, setTargetStatus] = useState<SightingStatus | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const loadSightings = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (alertIdParam) params.append("alert_id", alertIdParam);
    if (statusFilter) params.append("status_filter", statusFilter);

    apiFetch<AdminMissingPersonSightingResponse[]>(`/admin/missing-person/sightings?${params.toString()}`)
      .then((res) => setSightings(res))
      .catch((err: unknown) => {
        if (err instanceof Error) setError(err.message);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadSightings();
  }, [alertIdParam, statusFilter]);

  const handleOpenModerateModal = (sighting: AdminMissingPersonSightingResponse, status: SightingStatus) => {
    setActiveSighting(sighting);
    setTargetStatus(status);
    setAdminNotes("");
    setModalError(null);
  };

  const handleModerateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSighting || !targetStatus) return;
    setSubmitting(true);
    setModalError(null);

    try {
      await apiFetch(`/admin/missing-person/sightings/${activeSighting.id}/moderate`, {
        method: "POST",
        body: JSON.stringify({
          status: targetStatus,
          admin_notes: adminNotes.trim() || null,
        }),
      });
      setActiveSighting(null);
      setTargetStatus(null);
      loadSightings();
    } catch (err: unknown) {
      if (err instanceof Error) setModalError(err.message);
      else setModalError("Moderation failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Admin Navigation */}
      <AdminNav />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/missing-person"
              className="text-xs font-semibold text-zinc-500 hover:text-zinc-800"
            >
              ← Missing Person Alerts
            </Link>
          </div>
          <h1 className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-100 mt-1">
            Community Sightings Moderation Queue
          </h1>
          <p className="text-xs text-zinc-500">
            Review community sighting tips before approving safe approximate updates to public alerts.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setStatusFilter("")}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
              statusFilter === "" ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900" : "bg-zinc-100 dark:bg-zinc-800"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setStatusFilter("PENDING")}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
              statusFilter === "PENDING" ? "bg-amber-600 text-white" : "bg-zinc-100 dark:bg-zinc-800"
            }`}
          >
            Pending Review
          </button>
          <button
            onClick={() => setStatusFilter("APPROVED")}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
              statusFilter === "APPROVED" ? "bg-emerald-600 text-white" : "bg-zinc-100 dark:bg-zinc-800"
            }`}
          >
            Approved
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-950/40 p-4 border border-red-200 text-xs text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
        </div>
      ) : sightings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 p-12 text-center text-xs text-zinc-500">
          No community sighting records found for this filter.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
          <table className="w-full text-left text-xs text-zinc-700 dark:text-zinc-300">
            <thead className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 font-semibold text-zinc-900 dark:text-zinc-100">
              <tr>
                <th className="p-3.5">Approximate Area</th>
                <th className="p-3.5">Description & Evidence</th>
                <th className="p-3.5">Time Seen</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Submitted</th>
                <th className="p-3.5 text-right">Moderation Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {sightings.map((s) => (
                <tr key={s.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition">
                  <td className="p-3.5 font-bold text-zinc-900 dark:text-zinc-100">
                    📍 {s.approximate_location}
                  </td>
                  <td className="p-3.5 max-w-sm">
                    <p className="text-zinc-800 dark:text-zinc-200 line-clamp-2">{s.description}</p>
                    {s.photo_url && (
                      <a
                        href={s.photo_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-blue-600 hover:underline mt-1 inline-block"
                      >
                        🖼️ View Attached Image
                      </a>
                    )}
                  </td>
                  <td className="p-3.5 text-zinc-500">
                    {s.sighting_time || "Not specified"}
                  </td>
                  <td className="p-3.5">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                      s.status === "APPROVED"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        : s.status === "REJECTED"
                        ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                    }`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="p-3.5 text-zinc-400 text-[11px]">
                    {new Date(s.created_at).toLocaleString()}
                  </td>
                  <td className="p-3.5 text-right space-x-2">
                    {s.status === "PENDING" && (
                      <>
                        <button
                          onClick={() => handleOpenModerateModal(s, "APPROVED")}
                          className="font-bold text-emerald-600 hover:underline"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleOpenModerateModal(s, "REJECTED")}
                          className="font-bold text-red-600 hover:underline"
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Moderation Notes Modal */}
      {targetStatus && activeSighting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-zinc-900 p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-4">
            <h3 className="text-base font-extrabold text-zinc-900 dark:text-zinc-100">
              {targetStatus === "APPROVED" ? "✅ Approve Sighting" : "❌ Reject Sighting"}
            </h3>

            {modalError && (
              <div className="rounded-xl bg-red-50 dark:bg-red-950/40 p-3 text-xs text-red-700">
                {modalError}
              </div>
            )}

            <form onSubmit={handleModerateSubmit} className="space-y-4 text-xs">
              <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-800 p-3 text-zinc-700 dark:text-zinc-300 space-y-1">
                <div><strong>Location:</strong> {activeSighting.approximate_location}</div>
                <div><strong>Details:</strong> {activeSighting.description}</div>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Internal Moderation Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Record verification rationale or notes..."
                  className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-2.5"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => {
                    setTargetStatus(null);
                    setActiveSighting(null);
                  }}
                  className="rounded-xl border border-zinc-300 dark:border-zinc-700 px-4 py-2 font-semibold text-zinc-700 dark:text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`rounded-xl px-5 py-2 font-bold text-white shadow-sm disabled:opacity-50 ${
                    targetStatus === "APPROVED" ? "bg-emerald-600 hover:bg-emerald-500" : "bg-red-600 hover:bg-red-500"
                  }`}
                >
                  {submitting ? "Saving..." : `Confirm ${targetStatus}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminMissingPersonSightingsPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
      </div>
    }>
      <SightingsContent />
    </Suspense>
  );
}
