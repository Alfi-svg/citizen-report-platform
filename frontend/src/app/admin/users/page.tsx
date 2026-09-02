"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { AdminUser, AdminUserPagination, UserRole } from "@/lib/types";
import AdminNav from "@/components/AdminNav";

export default function AdminUsersPage() {
  const router = useRouter();
  const { user: currentAdmin, isAuthenticated, isLoading: authLoading, isAdmin } = useAuth();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const limit = 20;

  // Modals state
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [targetRole, setTargetRole] = useState<UserRole>("USER");
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isAdmin)) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, isAdmin, router]);

  const [activeQuery, setActiveQuery] = useState("");

  useEffect(() => {
    let isMounted = true;
    if (isAuthenticated && isAdmin) {
      const offset = (page - 1) * limit;
      let url = `/admin/users?limit=${limit}&offset=${offset}`;
      if (activeQuery.trim()) url += `&search=${encodeURIComponent(activeQuery.trim())}`;
      if (roleFilter !== "ALL") url += `&role=${roleFilter}`;
      if (statusFilter !== "ALL") url += `&is_active=${statusFilter === "ACTIVE"}`;

      apiFetch<AdminUserPagination>(url)
        .then((res) => {
          if (isMounted) {
            setUsers(res.items);
            setTotal(res.total);
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
  }, [isAuthenticated, isAdmin, page, roleFilter, statusFilter, activeQuery]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setActiveQuery(search);
  };

  const handleRoleChange = async () => {
    if (!selectedUser) return;
    setActionLoading(true);
    try {
      const updated = await apiFetch<AdminUser>(`/admin/users/${selectedUser.id}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role: targetRole }),
      });
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setShowRoleModal(false);
      setSelectedUser(null);
    } catch (err: unknown) {
      if (err instanceof Error) alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStatusChange = async () => {
    if (!selectedUser) return;
    setActionLoading(true);
    try {
      const updated = await apiFetch<AdminUser>(`/admin/users/${selectedUser.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !selectedUser.is_active }),
      });
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setShowStatusModal(false);
      setSelectedUser(null);
    } catch (err: unknown) {
      if (err instanceof Error) alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (authLoading || !isAuthenticated || !isAdmin) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-600 border-t-transparent" />
      </div>
    );
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <AdminNav />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <span>👥 User Accounts & Roles / ব্যবহারকারী ব্যবস্থাপনা</span>
              <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-xs px-2.5 py-0.5 font-bold">
                {total}
              </span>
            </h1>
            <p className="text-xs text-zinc-500 mt-1">
              Search registered citizen profiles, manage administrative permissions, and inspect account activity.
            </p>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-sm space-y-3">
          <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Search by username, email, or full name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3.5 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <button
              type="submit"
              className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-500 shadow-sm transition"
            >
              Search
            </button>
          </form>

          <div className="flex flex-wrap items-center gap-4 text-xs pt-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-zinc-500">Role:</span>
              <select
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value);
                  setPage(1);
                }}
                className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 py-1 text-xs text-zinc-800 dark:text-zinc-200"
              >
                <option value="ALL">All Roles</option>
                <option value="USER">Citizens (USER)</option>
                <option value="ADMIN">Administrators (ADMIN)</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-semibold text-zinc-500">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 py-1 text-xs text-zinc-800 dark:text-zinc-200"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active Only</option>
                <option value="INACTIVE">Inactive Only</option>
              </select>
            </div>
          </div>
        </div>

        {/* Users Table */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-600 border-t-transparent" />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        ) : users.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800 p-12 text-center text-xs text-zinc-400">
            No registered users found matching your search.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-zinc-600 dark:text-zinc-300">
                <thead className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 font-semibold text-zinc-900 dark:text-zinc-100">
                  <tr>
                    <th className="px-4 py-3">Citizen / Profile</th>
                    <th className="px-4 py-3">Email Address</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Account Status</th>
                    <th className="px-4 py-3">Incidents</th>
                    <th className="px-4 py-3">Registered Date</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {users.map((u) => {
                    const isSelf = currentAdmin?.id === u.id;
                    return (
                      <tr key={u.id} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40 transition">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                            {u.full_name || u.username}
                          </div>
                          <div className="text-[10px] text-zinc-400">@{u.username}</div>
                        </td>
                        <td className="px-4 py-3">{u.email}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold ${
                              u.role === "ADMIN"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold ${
                              u.is_active
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                            }`}
                          >
                            {u.is_active ? "ACTIVE" : "INACTIVE"}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-100">
                          {u.report_count}
                        </td>
                        <td className="px-4 py-3 text-[11px] text-zinc-400">
                          {new Date(u.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-right space-x-2">
                          <button
                            type="button"
                            disabled={isSelf}
                            onClick={() => {
                              setSelectedUser(u);
                              setTargetRole(u.role === "ADMIN" ? "USER" : "ADMIN");
                              setShowRoleModal(true);
                            }}
                            className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 hover:underline disabled:opacity-30"
                          >
                            {isSelf ? "(Self)" : "Change Role"}
                          </button>

                          <button
                            type="button"
                            disabled={isSelf}
                            onClick={() => {
                              setSelectedUser(u);
                              setShowStatusModal(true);
                            }}
                            className={`text-[11px] font-semibold hover:underline disabled:opacity-30 ${
                              u.is_active ? "text-red-600" : "text-emerald-600"
                            }`}
                          >
                            {u.is_active ? "Deactivate" : "Activate"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 text-xs">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-zinc-700 dark:text-zinc-300 disabled:opacity-40"
            >
              ← Previous
            </button>
            <span className="text-zinc-500">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-zinc-700 dark:text-zinc-300 disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {/* Role Change Confirmation Modal */}
      {showRoleModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 p-6 shadow-xl border border-zinc-200 dark:border-zinc-800 space-y-4 text-xs">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              Change User Role / ভূমিকা পরিবর্তন
            </h3>
            <p className="text-zinc-600 dark:text-zinc-400">
              Are you sure you want to change the role for{" "}
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                {selectedUser.username}
              </span>{" "}
              from <span className="font-bold">{selectedUser.role}</span> to{" "}
              <span className="font-bold">{targetRole}</span>?
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowRoleModal(false)}
                className="rounded-xl border border-zinc-300 dark:border-zinc-700 px-3.5 py-2 font-semibold text-zinc-700 dark:text-zinc-300"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleRoleChange}
                className="rounded-xl bg-amber-600 px-4 py-2 font-semibold text-white hover:bg-amber-500 transition"
              >
                {actionLoading ? "Updating..." : "Confirm Role Change"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Toggle Confirmation Modal */}
      {showStatusModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 p-6 shadow-xl border border-zinc-200 dark:border-zinc-800 space-y-4 text-xs">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              {selectedUser.is_active ? "Deactivate User Account" : "Activate User Account"}
            </h3>
            <p className="text-zinc-600 dark:text-zinc-400">
              Are you sure you want to {selectedUser.is_active ? "deactivate" : "reactivate"} the account for{" "}
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                {selectedUser.username}
              </span>
              ?
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowStatusModal(false)}
                className="rounded-xl border border-zinc-300 dark:border-zinc-700 px-3.5 py-2 font-semibold text-zinc-700 dark:text-zinc-300"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleStatusChange}
                className={`rounded-xl px-4 py-2 font-semibold text-white transition ${
                  selectedUser.is_active
                    ? "bg-red-600 hover:bg-red-500"
                    : "bg-emerald-600 hover:bg-emerald-500"
                }`}
              >
                {actionLoading
                  ? "Processing..."
                  : selectedUser.is_active
                  ? "Confirm Deactivation"
                  : "Confirm Activation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
