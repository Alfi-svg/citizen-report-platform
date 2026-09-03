"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

interface AdminNavProps {
  pendingReports?: number;
  pendingFlags?: number;
}

export default function AdminNav({ pendingReports, pendingFlags }: AdminNavProps) {
  const pathname = usePathname();
  const { user } = useAuth();

  const links = [
    { href: "/admin", label: "Overview", bn: "সংক্ষিপ্ত বিবরণ", icon: "📊" },
    {
      href: "/admin/reports",
      label: "Reports Queue",
      bn: "প্রতিবেদন সারি",
      icon: "📋",
      badge: pendingReports,
    },
    {
      href: "/admin/flags",
      label: "Safety Flags",
      bn: "সুরক্ষা ফ্ল্যাগ",
      icon: "🚩",
      badge: pendingFlags,
    },
    { href: "/admin/comments", label: "Comments", bn: "মন্তব্য", icon: "💬" },
    {
      href: "/admin/blood-help",
      label: "Blood Help",
      bn: "রক্ত সহায়তা",
      icon: "🩸",
    },
    {
      href: "/admin/emergency-services",
      label: "Safety Directory",
      bn: "জরুরি সেবা",
      icon: "🚨",
    },
    {
      href: "/admin/missing-person",
      label: "Missing Persons",
      bn: "নিখোঁজ ব্যক্তি",
      icon: "🔍",
    },
    {
      href: "/admin/missing-person/sightings",
      label: "Sightings",
      bn: "তথ্য যাচাই",
      icon: "👁️",
    },
    { href: "/admin/clusters", label: "Clusters", bn: "ক্লাস্টার", icon: "🔶" },
    { href: "/admin/analytics", label: "Analytics", bn: "বিশ্লেষণ", icon: "📈" },
    { href: "/admin/users", label: "Users", bn: "ব্যবহারকারী", icon: "👥" },
    { href: "/admin/categories", label: "Categories", bn: "ক্যাটাগরি", icon: "🏷️" },
  ];

  return (
    <div className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 sticky top-16 z-40 shadow-2xs">
      {/* Top Admin Status Strip */}
      <div className="border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/80 dark:bg-zinc-950/40 px-4 sm:px-6 lg:px-8 py-2">
        <div className="mx-auto max-w-7xl flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-black text-amber-700 dark:text-amber-400 border border-amber-500/30">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              ADMIN CONSOLE • অ্যাডমিন প্যানেল
            </span>
            <span className="hidden sm:inline text-xs text-zinc-400 font-medium">
              Bangladesh Citizen Report Moderation & Oversight
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
            >
              <span>←</span>
              <span>Exit to Public Site</span>
            </Link>

            {user && (
              <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 hidden md:inline">
                {user.full_name || user.username}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Admin Horizontal Scroll Navigation Bar */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <nav
          className="flex items-center py-2 overflow-x-auto gap-1 no-scrollbar"
          aria-label="Admin Navigation"
        >
          {links.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                  isActive
                    ? "bg-amber-100/80 text-amber-950 dark:bg-amber-950/80 dark:text-amber-200 font-bold"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100"
                }`}
              >
                <span className="text-xs">{link.icon}</span>
                <span>{link.label}</span>
                {link.badge !== undefined && link.badge > 0 && (
                  <span className="ml-1 rounded-full bg-red-600 text-white text-[10px] font-black px-1.5 py-0.2 leading-none">
                    {link.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
