import React from "react";
import Link from "next/link";
import Image from "next/image";

export default function Footer() {
  return (
    <footer className="border-t border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 py-10 text-xs text-zinc-600 dark:text-zinc-400 mt-auto">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand & Purpose */}
          <div className="space-y-3 md:col-span-2">
            <div className="flex items-center gap-2.5">
              <div className="relative h-9 w-9 rounded-xl overflow-hidden border border-emerald-700/20 shadow-2xs">
                <Image
                  src="/brand/logo-icon.jpg"
                  alt="Bangladesh Citizen Report Emblem"
                  width={36}
                  height={36}
                  className="object-cover h-full w-full"
                />
              </div>
              <div>
                <span className="font-extrabold text-sm text-zinc-900 dark:text-zinc-100 block leading-tight">
                  Bangladesh Citizen Report
                </span>
                <span className="text-[10px] text-zinc-500 block leading-none">
                  একসাথে গড়ি নিরাপদ বাংলাদেশ
                </span>
              </div>
            </div>
            <p className="leading-relaxed text-zinc-500 dark:text-zinc-400 max-w-md text-xs">
              A secure, privacy-first civic-tech network enabling citizens across all divisions of Bangladesh to report verified community hazards, discover nearby emergency services, and support missing person searches.
            </p>
            {/* National Emergency Hotline Badges */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 font-bold text-[11px] border border-red-200/60 dark:border-red-900/60">
                🚨 Emergency: 999
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 font-medium text-[11px] border border-emerald-200/60 dark:border-emerald-900/60">
                📞 Helpline: 109
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 font-medium text-[11px] border border-blue-200/60 dark:border-blue-900/60">
                🏛️ Civic: 333
              </span>
            </div>
          </div>

          {/* Quick Civic Navigation */}
          <div className="space-y-2">
            <h4 className="font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider text-[11px]">
              Civic Services
            </h4>
            <ul className="space-y-2">
              <li>
                <Link href="/" className="hover:text-emerald-700 dark:hover:text-emerald-400 transition">
                  Public Incident Feed
                </Link>
              </li>
              <li>
                <Link href="/safety" className="hover:text-red-600 transition font-semibold">
                  Safety Navigator (SOS 999)
                </Link>
              </li>
              <li>
                <Link href="/safety-map" className="hover:text-emerald-700 dark:hover:text-emerald-400 transition">
                  Community Safety Map
                </Link>
              </li>
              <li>
                <Link href="/missing-person" className="hover:text-amber-600 transition">
                  Missing Person Alert Network
                </Link>
              </li>
            </ul>
          </div>

          {/* Transparency & Governance */}
          <div className="space-y-2">
            <h4 className="font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider text-[11px]">
              Transparency & Platform
            </h4>
            <ul className="space-y-2">
              <li>
                <Link href="/transparency" className="hover:text-blue-600 transition font-semibold">
                  📊 Crime Analysis Dashboard
                </Link>
              </li>
              <li>
                <Link href="/reports/create" className="hover:text-emerald-700 dark:hover:text-emerald-400 transition">
                  + Submit Incident Report
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="hover:text-zinc-900 dark:hover:text-white transition">
                  Citizen Dashboard
                </Link>
              </li>
              <li>
                <Link href="/admin" className="hover:text-zinc-900 dark:hover:text-white transition">
                  Moderator Console
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-zinc-400">
          <div>
            &copy; {new Date().getFullYear()} Bangladesh Citizen Report Platform. Dedicated to public safety and civic transparency.
          </div>
          <div className="flex items-center gap-3">
            <span className="text-emerald-700 dark:text-emerald-400 font-semibold">🔒 Privacy Protected</span>
            <span>•</span>
            <span>Platform-Reviewed Data</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
