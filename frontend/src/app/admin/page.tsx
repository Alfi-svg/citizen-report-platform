"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";

interface AdminCheckResponse {
  message: string;
  admin_id: string;
  username: string;
  email: string;
  role: string;
}

export default function AdminPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, isAdmin } = useAuth();
  const [adminCheck, setAdminCheck] = useState<AdminCheckResponse | null>(null);
  const [backendError, setBackendError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    let isMounted = true;
    if (isAuthenticated && isAdmin) {
      apiFetch<AdminCheckResponse>("/auth/admin-check")
        .then((res) => {
          if (isMounted) {
            setAdminCheck(res);
          }
        })
        .catch((err) => {
          if (isMounted) {
            setBackendError(err.message);
          }
        });
    }
    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, isAdmin]);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-600 border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  // Non-admin user access attempt
  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 dark:border-red-900 dark:bg-red-950/40">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300 font-bold text-xl">
            !
          </div>
          <h1 className="mt-4 text-xl font-bold text-red-900 dark:text-red-200">
            Access Denied — HTTP 403 Forbidden
          </h1>
          <p className="mt-2 text-sm text-red-700 dark:text-red-300">
            Your account <span className="font-semibold">{user.username}</span> possesses the role <span className="font-semibold">{user.role}</span>. Administrative privileges are required to access this area.
          </p>
          <div className="mt-6">
            <Link
              href="/dashboard"
              className="inline-flex rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition"
            >
              Return to Citizen Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 mb-2">
            Administrator Console
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            Administrative Management
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Backend-enforced role authorization confirmed for <span className="font-semibold text-zinc-900 dark:text-zinc-100">{user.username}</span>.
          </p>
        </div>
        <div>
          <Link
            href="/dashboard"
            className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3.5 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition"
          >
            Citizen Dashboard
          </Link>
        </div>
      </div>

      {backendError && (
        <div className="mb-6 rounded-lg bg-red-50 p-4 border border-red-200 text-sm text-red-800">
          Backend Admin Check Failed: {backendError}
        </div>
      )}

      {adminCheck && (
        <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-6 shadow-sm mb-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
            Backend Verification Status
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800">
              <span className="text-zinc-500 block">Status:</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400 text-sm">
                {adminCheck.message}
              </span>
            </div>
            <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800">
              <span className="text-zinc-500 block">Enforced Role:</span>
              <span className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">
                {adminCheck.role}
              </span>
            </div>
            <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800 sm:col-span-2">
              <span className="text-zinc-500 block">Administrator UUID:</span>
              <span className="font-mono text-zinc-700 dark:text-zinc-300 break-all">
                {adminCheck.admin_id}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-8 text-center text-zinc-500">
        <p className="text-sm font-medium">
          Step 2 Role-Based Authorization Verified.
        </p>
        <p className="text-xs mt-1 text-zinc-400">
          Admin moderation tools, user management, and report verification pipelines will be built in future steps.
        </p>
      </div>
    </div>
  );
}
