"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import NotificationBell from "@/components/NotificationBell";

export default function Navbar() {
  const { user, isAuthenticated, isAdmin, logout, isLoading } = useAuth();

  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 sticky top-0 z-50">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg text-zinc-900 dark:text-zinc-100 hover:opacity-90">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold text-sm">
              BD
            </span>
            <span className="hidden sm:inline">Bangladesh Citizen Report</span>
            <span className="sm:hidden">Citizen Report</span>
          </Link>
        </div>

        <nav className="flex items-center gap-2 sm:gap-3.5">
          <Link
            href="/safety"
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-black text-white shadow-xs hover:bg-red-500 transition animate-pulse hover:animate-none shrink-0"
          >
            <span>🚨</span>
            <span className="hidden sm:inline">I Need Help</span>
            <span className="sm:hidden">Help</span>
          </Link>

          <Link
            href="/"
            className="text-sm font-medium text-zinc-700 hover:text-emerald-600 dark:text-zinc-300 dark:hover:text-emerald-400"
          >
            Public Feed
          </Link>

          <Link
            href="/missing-person"
            className="text-sm font-medium text-zinc-700 hover:text-red-600 dark:text-zinc-300 dark:hover:text-red-400"
          >
            Missing Persons
          </Link>
          {isLoading ? (
            <div className="h-8 w-20 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
          ) : isAuthenticated && user ? (
            <>
              <Link
                href="/reports/mine"
                className="text-sm font-medium text-zinc-700 hover:text-emerald-600 dark:text-zinc-300 dark:hover:text-emerald-400"
              >
                My Reports
              </Link>

              <Link
                href="/reports/create"
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500 transition"
              >
                + New Report
              </Link>

              {isAdmin && (
                <Link
                  href="/admin"
                  className="inline-flex items-center rounded-md bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300 hover:bg-amber-200"
                >
                  Admin Panel
                </Link>
              )}

              <NotificationBell />

              <div className="hidden md:flex flex-col text-right">
                <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  {user.full_name || user.username}
                </span>
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
                  {user.role}
                </span>
              </div>

              <button
                onClick={logout}
                type="button"
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 transition"
              >
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm font-medium text-zinc-700 hover:text-emerald-600 dark:text-zinc-300 dark:hover:text-emerald-400 px-2 py-1.5"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500 transition"
              >
                Register
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
