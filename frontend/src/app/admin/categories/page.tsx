"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { AdminCategory } from "@/lib/types";
import AdminNav from "@/components/AdminNav";

export default function AdminCategoriesPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, isAdmin } = useAuth();

  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<AdminCategory | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isAdmin)) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, isAdmin, router]);

  useEffect(() => {
    let isMounted = true;
    if (isAuthenticated && isAdmin) {
      apiFetch<AdminCategory[]>("/admin/categories")
        .then((res) => {
          if (isMounted) {
            setCategories(res);
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
  }, [isAuthenticated, isAdmin]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);
    try {
      const created = await apiFetch<AdminCategory>("/admin/categories", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim() || undefined,
          description: description.trim() || undefined,
          is_active: isActive,
        }),
      });
      setCategories((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setShowCreateModal(false);
      setName("");
      setSlug("");
      setDescription("");
    } catch (err: unknown) {
      if (err instanceof Error) setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategory) return;
    setFormLoading(true);
    setFormError(null);
    try {
      const updated = await apiFetch<AdminCategory>(`/admin/categories/${selectedCategory.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          is_active: isActive,
        }),
      });
      setCategories((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c)).sort((a, b) => a.name.localeCompare(b.name))
      );
      setShowEditModal(false);
      setSelectedCategory(null);
    } catch (err: unknown) {
      if (err instanceof Error) setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteOrDeactivate = async () => {
    if (!selectedCategory) return;
    setFormLoading(true);
    try {
      const res = await apiFetch<{ message: string; is_active: boolean }>(
        `/admin/categories/${selectedCategory.id}`,
        { method: "DELETE" }
      );
      if (res.is_active === false && selectedCategory.report_count > 0) {
        setCategories((prev) =>
          prev.map((c) => (c.id === selectedCategory.id ? { ...c, is_active: false } : c))
        );
      } else {
        setCategories((prev) => prev.filter((c) => c.id !== selectedCategory.id));
      }
      setShowDeleteModal(false);
      setSelectedCategory(null);
    } catch (err: unknown) {
      if (err instanceof Error) alert(err.message);
    } finally {
      setFormLoading(false);
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
              <span>🏷️ Category Management / ক্যাটাগরি ব্যবস্থাপনা</span>
              <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-xs px-2.5 py-0.5 font-bold">
                {categories.length}
              </span>
            </h1>
            <p className="text-xs text-zinc-500 mt-1">
              Create, rename, or safely deactivate incident categories without breaking historical report links.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setName("");
              setSlug("");
              setDescription("");
              setIsActive(true);
              setFormError(null);
              setShowCreateModal(true);
            }}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 shadow-sm transition"
          >
            + Create New Category / নতুন ক্যাটাগরি
          </button>
        </div>

        {/* Categories List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-600 border-t-transparent" />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        ) : categories.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800 p-12 text-center text-xs text-zinc-400">
            No incident categories found.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
            <table className="w-full text-left text-xs text-zinc-600 dark:text-zinc-300">
              <thead className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 font-semibold text-zinc-900 dark:text-zinc-100">
                <tr>
                  <th className="px-4 py-3">Category Name</th>
                  <th className="px-4 py-3">Slug Identifier</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Associated Reports</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {categories.map((c) => (
                  <tr key={c.id} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40 transition">
                    <td className="px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-100">
                      {c.name}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-zinc-500">{c.slug}</td>
                    <td className="px-4 py-3 text-zinc-500 max-w-xs truncate">
                      {c.description || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold ${
                          c.is_active
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                        }`}
                      >
                        {c.is_active ? "ACTIVE" : "INACTIVE"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-100">
                      {c.report_count}
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCategory(c);
                          setName(c.name);
                          setDescription(c.description || "");
                          setIsActive(c.is_active);
                          setFormError(null);
                          setShowEditModal(true);
                        }}
                        className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 hover:underline"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCategory(c);
                          setShowDeleteModal(true);
                        }}
                        className={`text-[11px] font-semibold hover:underline ${
                          c.report_count > 0 ? "text-amber-600" : "text-red-600"
                        }`}
                      >
                        {c.report_count > 0 ? (c.is_active ? "Deactivate" : "Active Toggle") : "Delete"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 p-6 shadow-xl border border-zinc-200 dark:border-zinc-800 space-y-4 text-xs">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              Create New Incident Category
            </h3>

            {formError && (
              <div className="rounded-xl bg-red-50 p-3 text-red-700 border border-red-200">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-3">
              <div>
                <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Category Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Environmental Hazard"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3.5 py-2 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Slug (Optional - auto-generated if blank)
                </label>
                <input
                  type="text"
                  placeholder="e.g. environmental-hazard"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3.5 py-2 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Describe what incident reports fit in this category..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3.5 py-2 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="create_is_active"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="create_is_active" className="font-medium text-zinc-700 dark:text-zinc-300">
                  Active for new citizen reports
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl border border-zinc-300 dark:border-zinc-700 px-3.5 py-2 font-semibold text-zinc-700 dark:text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="rounded-xl bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-500 transition"
                >
                  {formLoading ? "Creating..." : "Create Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 p-6 shadow-xl border border-zinc-200 dark:border-zinc-800 space-y-4 text-xs">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              Edit Category: {selectedCategory.name}
            </h3>

            {formError && (
              <div className="rounded-xl bg-red-50 p-3 text-red-700 border border-red-200">
                {formError}
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-3">
              <div>
                <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Category Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3.5 py-2 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3.5 py-2 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="edit_is_active"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="edit_is_active" className="font-medium text-zinc-700 dark:text-zinc-300">
                  Active for new citizen reports
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="rounded-xl border border-zinc-300 dark:border-zinc-700 px-3.5 py-2 font-semibold text-zinc-700 dark:text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="rounded-xl bg-amber-600 px-4 py-2 font-semibold text-white hover:bg-amber-500 transition"
                >
                  {formLoading ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete / Deactivate Confirmation Modal */}
      {showDeleteModal && selectedCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 p-6 shadow-xl border border-zinc-200 dark:border-zinc-800 space-y-4 text-xs">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              {selectedCategory.report_count > 0 ? "Soft Deactivate Category" : "Delete Category"}
            </h3>
            <p className="text-zinc-600 dark:text-zinc-400">
              {selectedCategory.report_count > 0 ? (
                <>
                  Category <span className="font-semibold">{selectedCategory.name}</span> is referenced by{" "}
                  <span className="font-bold">{selectedCategory.report_count}</span> existing report(s). It will be{" "}
                  <span className="font-bold text-amber-600">safely deactivated</span> so no new reports can use it, while preserving all existing reports.
                </>
              ) : (
                <>
                  Are you sure you want to permanently delete{" "}
                  <span className="font-semibold">{selectedCategory.name}</span>? No reports reference this category.
                </>
              )}
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="rounded-xl border border-zinc-300 dark:border-zinc-700 px-3.5 py-2 font-semibold text-zinc-700 dark:text-zinc-300"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={formLoading}
                onClick={handleDeleteOrDeactivate}
                className="rounded-xl bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-500 transition"
              >
                {formLoading ? "Processing..." : selectedCategory.report_count > 0 ? "Confirm Deactivation" : "Confirm Deletion"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
