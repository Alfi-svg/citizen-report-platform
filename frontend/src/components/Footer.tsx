import React from "react";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 py-10 text-xs text-zinc-600 dark:text-zinc-400 mt-auto">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand & Purpose */}
          <div className="space-y-3 md:col-span-2">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-600 text-white font-bold text-xs">
                🇧🇩
              </span>
              <span className="font-extrabold text-sm text-zinc-900 dark:text-zinc-100">
                Bangladesh Citizen Report Platform
              </span>
            </div>
            <p className="leading-relaxed text-zinc-500 max-w-md">
              A secure civic platform enabling citizens to report community hazards, track public safety incidents, coordinate verified missing person searches, and inspect open transparency analytics across Bangladesh.
            </p>
          </div>

          {/* Quick Civic Navigation */}
          <div className="space-y-2">
            <h4 className="font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider text-[11px]">
              Civic Services
            </h4>
            <ul className="space-y-1.5">
              <li>
                <Link href="/" className="hover:text-emerald-600 transition">
                  Public Incident Feed
                </Link>
              </li>
              <li>
                <Link href="/safety" className="hover:text-emerald-600 transition">
                  Safety Navigator (999 & Nearby)
                </Link>
              </li>
              <li>
                <Link href="/safety-map" className="hover:text-emerald-600 transition">
                  Community Safety Map
                </Link>
              </li>
              <li>
                <Link href="/missing-person" className="hover:text-red-600 transition">
                  Missing Person Alert Network
                </Link>
              </li>
            </ul>
          </div>

          {/* Transparency & Governance */}
          <div className="space-y-2">
            <h4 className="font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider text-[11px]">
              Transparency & Audit
            </h4>
            <ul className="space-y-1.5">
              <li>
                <Link href="/transparency" className="hover:text-blue-600 transition font-semibold">
                  📊 Transparency & Crime Analysis
                </Link>
              </li>
              <li>
                <Link href="/reports/create" className="hover:text-emerald-600 transition">
                  Submit Citizen Report
                </Link>
              </li>
              <li>
                <Link href="/admin" className="hover:text-zinc-900 dark:hover:text-white transition">
                  Official Moderator Portal
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-zinc-400">
          <div>
            &copy; {new Date().getFullYear()} Bangladesh Citizen Report Platform. Civic transparency and privacy protected.
          </div>
          <div className="flex items-center gap-4">
            <span className="text-emerald-600 font-semibold">🔒 Zero-Doxxing Location Privacy</span>
            <span>•</span>
            <span>Platform-Reviewed Reports</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
