"use client";

import React, { useEffect, useState } from "react";
import AdminNav from "@/components/AdminNav";
import { apiFetch } from "@/lib/api";
import {
  IncidentClusterDetailResponse,
  IncidentClusterListResponse,
  CategoryResponse,
  SuggestedRelatedReportResponse,
} from "@/lib/types";

export default function AdminClustersPage() {
  const [data, setData] = useState<IncidentClusterListResponse | null>(null);
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 15;

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [activeCluster, setActiveCluster] = useState<IncidentClusterDetailResponse | null>(null);
  const [suggestedReports, setSuggestedReports] = useState<SuggestedRelatedReportResponse[]>([]);
  const [inspectingReportId, setInspectingReportId] = useState<string | null>(null);

  // Form State for Create
  const [newTitle, setNewTitle] = useState("");
  const [newTitleBn, setNewTitleBn] = useState("");
  const [newCatId, setNewCatId] = useState("");
  const [newArea, setNewArea] = useState("");
  const [newLat, setNewLat] = useState("");
  const [newLng, setNewLng] = useState("");
  const [newSummary, setNewSummary] = useState("");
  const [addReportIdInput, setAddReportIdInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadClusters = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search.trim()) params.append("search", search.trim());
    if (categoryFilter) params.append("category_id", categoryFilter);
    params.append("limit", PAGE_SIZE.toString());
    params.append("offset", (page * PAGE_SIZE).toString());

    apiFetch<IncidentClusterListResponse>(`/admin/clusters?${params.toString()}`)
      .then((res) => setData(res))
      .catch((err: unknown) => {
        if (err instanceof Error) setError(err.message);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    apiFetch<CategoryResponse[]>("/categories")
      .then((cats) => setCategories(cats))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadClusters();
  }, [search, categoryFilter, page]);

  const handleCreateCluster = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);

    try {
      await apiFetch("/admin/clusters", {
        method: "POST",
        body: JSON.stringify({
          title: newTitle.trim(),
          title_bn: newTitleBn.trim() || null,
          category_id: newCatId || null,
          area: newArea.trim() || null,
          approximate_latitude: newLat ? parseFloat(newLat) : null,
          approximate_longitude: newLng ? parseFloat(newLng) : null,
          summary: newSummary.trim() || null,
        }),
      });
      setIsCreateModalOpen(false);
      setNewTitle("");
      setNewTitleBn("");
      setNewCatId("");
      setNewArea("");
      setNewLat("");
      setNewLng("");
      setNewSummary("");
      loadClusters();
    } catch (err: unknown) {
      if (err instanceof Error) setFormError(err.message);
      else setFormError("Failed to create cluster.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddMember = async (clusterId: string, reportId: string) => {
    if (!reportId.trim()) return;
    try {
      await apiFetch(`/admin/clusters/${clusterId}/members`, {
        method: "POST",
        body: JSON.stringify({
          report_id: reportId.trim(),
          relationship_type: "SIMILAR_INCIDENT",
        }),
      });
      setAddReportIdInput("");
      // Reload active cluster
      const updated = await apiFetch<IncidentClusterDetailResponse>(`/admin/clusters/${clusterId}`);
      setActiveCluster(updated);
      loadClusters();
    } catch (err: unknown) {
      if (err instanceof Error) alert(err.message);
    }
  };

  const handleRemoveMember = async (clusterId: string, reportId: string) => {
    try {
      await apiFetch(`/admin/clusters/${clusterId}/members/${reportId}`, {
        method: "DELETE",
      });
      const updated = await apiFetch<IncidentClusterDetailResponse>(`/admin/clusters/${clusterId}`);
      setActiveCluster(updated);
      loadClusters();
    } catch (err: unknown) {
      if (err instanceof Error) alert(err.message);
    }
  };

  const handleInspectSuggestions = async (reportId: string) => {
    setInspectingReportId(reportId);
    try {
      const suggestions = await apiFetch<SuggestedRelatedReportResponse[]>(
        `/admin/reports/${reportId}/suggested-related?min_score=20`
      );
      setSuggestedReports(suggestions);
    } catch (err: unknown) {
      if (err instanceof Error) alert(err.message);
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
            Incident Clusters & Intelligence
          </h1>
          <p className="text-xs text-zinc-500">
            Group related reports into incident clusters and inspect deterministic similarity signals.
          </p>
        </div>

        <button
          onClick={() => {
            setFormError(null);
            setIsCreateModalOpen(true);
          }}
          className="rounded-xl bg-amber-600 hover:bg-amber-500 px-4 py-2.5 text-xs font-bold text-white shadow-xs transition shrink-0"
        >
          + Create Incident Cluster
        </button>
      </div>

      {/* Filters Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm text-xs">
        <div className="sm:col-span-8">
          <input
            type="text"
            placeholder="Search clusters by title, area, or description..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3.5 py-2 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <div className="sm:col-span-4">
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(0);
            }}
            className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-950/40 p-4 border border-red-200 text-xs text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-600 border-t-transparent" />
        </div>
      ) : !data || data.items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 p-12 text-center text-xs text-zinc-500">
          No incident cluster records found.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
            <table className="w-full text-left text-xs text-zinc-700 dark:text-zinc-300">
              <thead className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 font-semibold text-zinc-900 dark:text-zinc-100">
                <tr>
                  <th className="p-3.5">Cluster Title</th>
                  <th className="p-3.5">Category</th>
                  <th className="p-3.5">Area</th>
                  <th className="p-3.5">Reports</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {data.items.map((cluster) => (
                  <tr key={cluster.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition">
                    <td className="p-3.5">
                      <div className="font-bold text-zinc-900 dark:text-zinc-100">{cluster.title}</div>
                      {cluster.title_bn && (
                        <div className="text-[11px] text-zinc-500">{cluster.title_bn}</div>
                      )}
                    </td>

                    <td className="p-3.5">
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                        {cluster.category_name || "General"}
                      </span>
                    </td>

                    <td className="p-3.5 text-zinc-600 dark:text-zinc-400">
                      {cluster.area || "N/A"}
                    </td>

                    <td className="p-3.5">
                      <span className="font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md text-[11px]">
                        🔶 {cluster.member_count} reports
                      </span>
                    </td>

                    <td className="p-3.5">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                        cluster.is_active ? "bg-emerald-100 text-emerald-800" : "bg-zinc-100 text-zinc-700"
                      }`}>
                        {cluster.is_active ? "ACTIVE" : "INACTIVE"}
                      </span>
                    </td>

                    <td className="p-3.5 text-right space-x-2">
                      <button
                        onClick={() => setActiveCluster(cluster)}
                        className="font-bold text-amber-600 hover:underline"
                      >
                        Manage Cluster ({cluster.member_count}) →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between pt-2 text-xs text-zinc-500">
            <span>Showing {data.items.length} of {data.total} clusters</span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 font-semibold disabled:opacity-40"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 font-semibold disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cluster Creation Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-zinc-900 p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h3 className="text-base font-extrabold text-zinc-900 dark:text-zinc-100">
                + Create Incident Cluster
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="rounded-xl bg-red-50 dark:bg-red-950/40 p-3 text-xs text-red-700">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateCluster} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Cluster Title (English) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dhanmondi Robbery Series"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-2.5"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Cluster Title (Bangla)
                </label>
                <input
                  type="text"
                  placeholder="উদা: ধানমন্ডি ডাকাতি ঘটনা সিরিজ"
                  value={newTitleBn}
                  onChange={(e) => setNewTitleBn(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-2.5"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Category
                  </label>
                  <select
                    value={newCatId}
                    onChange={(e) => setNewCatId(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-2.5"
                  >
                    <option value="">Select Category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Area / Landmark
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Dhanmondi 27"
                    value={newArea}
                    onChange={(e) => setNewArea(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-2.5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Approximate Latitude
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    placeholder="23.7461"
                    value={newLat}
                    onChange={(e) => setNewLat(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-2.5"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Approximate Longitude
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    placeholder="90.3742"
                    value={newLng}
                    onChange={(e) => setNewLng(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-2.5"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Summary / Intelligence Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Notes about related pattern..."
                  value={newSummary}
                  onChange={(e) => setNewSummary(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-2.5"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="rounded-xl border border-zinc-300 dark:border-zinc-700 px-4 py-2 font-semibold text-zinc-700 dark:text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-amber-600 px-5 py-2 font-bold text-white shadow-sm hover:bg-amber-500 disabled:opacity-50"
                >
                  {submitting ? "Creating..." : "Create Cluster"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cluster Detail & Member Management Modal */}
      {activeCluster && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-2xl rounded-3xl bg-white dark:bg-zinc-900 p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-4 my-8 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-zinc-900 dark:text-zinc-100">
                  🔶 {activeCluster.title}
                </h3>
                <p className="text-xs text-zinc-500">
                  {activeCluster.area} • {activeCluster.category_name || "General"}
                </p>
              </div>
              <button
                onClick={() => setActiveCluster(null)}
                className="text-zinc-400 hover:text-zinc-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* Add Report to Cluster Input */}
            <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-800 p-3 space-y-2 text-xs">
              <label className="font-bold text-zinc-700 dark:text-zinc-300">
                Add Report by UUID to Cluster
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Paste Report UUID..."
                  value={addReportIdInput}
                  onChange={(e) => setAddReportIdInput(e.target.value)}
                  className="flex-1 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2"
                />
                <button
                  type="button"
                  onClick={() => handleAddMember(activeCluster.id, addReportIdInput)}
                  className="rounded-xl bg-amber-600 px-4 py-2 font-bold text-white"
                >
                  Add Member
                </button>
              </div>
            </div>

            {/* Member Reports Table */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                Cluster Member Reports ({activeCluster.members.length})
              </h4>

              {activeCluster.members.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-6 text-center text-xs text-zinc-500">
                  No member reports added yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {activeCluster.members.map((m) => (
                    <div
                      key={m.id}
                      className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-3 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold text-zinc-900 dark:text-zinc-100">
                          {m.report_title}
                        </div>
                        <div className="text-[11px] text-zinc-500 flex gap-2">
                          <span>Status: <strong>{m.report_status}</strong></span>
                          <span>Category: {m.report_category}</span>
                          {m.similarity_score !== null && m.similarity_score !== undefined && (
                            <span className="text-amber-600 font-semibold">
                              Similarity: {m.similarity_score.toFixed(1)} pts
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleInspectSuggestions(m.report_id)}
                          className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-2.5 py-1 text-[11px] font-semibold text-blue-600 hover:bg-blue-50"
                        >
                          Inspect Similar
                        </button>
                        <button
                          onClick={() => handleRemoveMember(activeCluster.id, m.report_id)}
                          className="text-red-600 hover:underline font-bold text-[11px]"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Suggestions Inspector */}
            {inspectingReportId && suggestedReports.length > 0 && (
              <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
                <h4 className="text-xs font-bold text-blue-600">
                  🔍 Algorithmic Similar Report Candidates ({suggestedReports.length})
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {suggestedReports.map((cand) => (
                    <div
                      key={cand.report_id}
                      className="rounded-xl bg-blue-50/50 dark:bg-blue-950/20 p-2.5 border border-blue-100 dark:border-blue-900/40 text-xs flex items-center justify-between"
                    >
                      <div>
                        <div className="font-bold text-zinc-900 dark:text-zinc-100">{cand.title}</div>
                        <div className="text-[10px] text-zinc-500">
                          📍 {cand.location_text} • Total Score: <strong className="text-blue-600">{cand.similarity.total_score} pts</strong> (Geo: {cand.similarity.geo_score}, Time: {cand.similarity.time_score}, Cat: {cand.similarity.category_score}, Text: {cand.similarity.text_score})
                        </div>
                      </div>
                      <button
                        onClick={() => handleAddMember(activeCluster.id, cand.report_id)}
                        className="rounded-lg bg-blue-600 px-3 py-1 font-bold text-white text-[10px]"
                      >
                        + Add to Cluster
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
