"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout, isAdmin } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            Citizen Dashboard
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Welcome back, <span className="font-semibold text-zinc-900 dark:text-zinc-100">{user.full_name || user.username}</span>.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <Link
              href="/admin"
              className="rounded-lg bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-amber-500 transition"
            >
              Access Admin Panel
            </Link>
          )}
          <button
            onClick={logout}
            className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3.5 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition"
          >
            Sign Out
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Account Profile Card */}
        <div className="col-span-1 md:col-span-2 rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center justify-between">
            <span>Profile Details</span>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                user.role === "ADMIN"
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                  : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
              }`}
            >
              {user.role}
            </span>
          </h2>

          <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2 text-sm">
            <div>
              <dt className="text-xs font-medium text-zinc-500">Username</dt>
              <dd className="mt-1 font-semibold text-zinc-900 dark:text-zinc-100">{user.username}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-zinc-500">Email Address</dt>
              <dd className="mt-1 font-semibold text-zinc-900 dark:text-zinc-100">{user.email}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-zinc-500">Display Name</dt>
              <dd className="mt-1 font-semibold text-zinc-900 dark:text-zinc-100">{user.full_name || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-zinc-500">Account Status</dt>
              <dd className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-600" />
                Active & Verified
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium text-zinc-500">Account Identifier (UUID)</dt>
              <dd className="mt-1 font-mono text-xs text-zinc-600 dark:text-zinc-400 break-all">{user.id}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium text-zinc-500">Registered At</dt>
              <dd className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                {new Date(user.created_at).toLocaleString()}
              </dd>
            </div>
          </dl>
        </div>

        {/* Auth Verification Card */}
        <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
              Auth Status
            </h2>
            <p className="text-xs text-zinc-500 mb-4">
              Step 2 Authentication & Authorization verified.
            </p>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-zinc-100 dark:border-zinc-800">
                <span className="text-zinc-500">JWT Bearer:</span>
                <span className="font-semibold text-emerald-600">Active</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-zinc-100 dark:border-zinc-800">
                <span className="text-zinc-500">Role Authority:</span>
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">{user.role}</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-zinc-500">Protected Route:</span>
                <span className="font-semibold text-emerald-600">Unlocked</span>
              </div>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800 text-[11px] text-zinc-400">
            Awaiting Step 3 for report submission workflows.
          </div>
        </div>
      </div>
    </div>
  );
}
