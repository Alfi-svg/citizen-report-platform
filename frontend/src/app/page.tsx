"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

export default function Home() {
  const { user, isAuthenticated, isLoading } = useAuth();

  return (
    <div className="flex min-h-[calc(100vh-60px)] flex-col items-center justify-center p-6 sm:p-12">
      <div className="max-w-2xl w-full text-center space-y-8 bg-white dark:bg-zinc-900 p-8 sm:p-10 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Step 2 — Authentication & Authorization Active
        </div>

        <div className="space-y-3">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
            Bangladesh Citizen Report Platform
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 text-base max-w-lg mx-auto">
            A secure and accountable citizen incident reporting system with administrative verification workflows.
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-4">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
          </div>
        ) : isAuthenticated && user ? (
          <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800 p-6 space-y-4 border border-zinc-200 dark:border-zinc-700">
            <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Authenticated as{" "}
              <span className="font-bold text-zinc-900 dark:text-zinc-100">
                {user.full_name || user.username}
              </span>{" "}
              ({user.role})
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href="/dashboard"
                className="rounded-lg bg-emerald-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500 transition"
              >
                Go to Dashboard
              </Link>
              {user.role === "ADMIN" && (
                <Link
                  href="/admin"
                  className="rounded-lg bg-amber-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-amber-500 transition"
                >
                  Admin Console
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              href="/register"
              className="w-full sm:w-auto rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 transition"
            >
              Create Citizen Account
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-6 py-2.5 text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition"
            >
              Sign In
            </Link>
          </div>
        )}

        <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500">
          JWT Authentication • Role Authorization (USER / ADMIN) • Secure Password Hashing
        </div>
      </div>
    </div>
  );
}

