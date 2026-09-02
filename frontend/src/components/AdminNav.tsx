"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface AdminNavProps {
  pendingReports?: number;
  pendingFlags?: number;
}

export default function AdminNav({ pendingReports, pendingFlags }: AdminNavProps) {
  const pathname = usePathname();

  const links = [
    { href: "/admin", label: "Overview", icon: "📊", bn: "সংক্ষিপ্ত বিবরণ" },
    {
      href: "/admin/reports",
      label: "Reports Queue",
      icon: "📋",
      bn: "প্রতিবেদন সারি",
      badge: pendingReports,
    },
    {
      href: "/admin/flags",
      label: "Safety Flags",
      icon: "🚩",
      bn: "সুরক্ষা ফ্ল্যাগ",
      badge: pendingFlags,
    },
    { href: "/admin/comments", label: "Comments", icon: "💬", bn: "মন্তব্য" },
    { href: "/admin/emergency-services", label: "Emergency Services", icon: "🚨", bn: "জরুরি সেবা" },
    { href: "/admin/users", label: "Users", icon: "👥", bn: "ব্যবহারকারী" },
    { href: "/admin/categories", label: "Categories", icon: "🏷️", bn: "ক্যাটাগরি" },
  ];

  return (
    <div className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 sticky top-14 z-40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-2 overflow-x-auto gap-2 no-scrollbar">
          <div className="flex items-center space-x-1 sm:space-x-2 shrink-0">
            {links.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                    isActive
                      ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300"
                      : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100"
                  }`}
                >
                  <span>{link.icon}</span>
                  <span>{link.label}</span>
                  {link.badge !== undefined && link.badge > 0 && (
                    <span className="ml-1 rounded-full bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.2">
                      {link.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          <Link
            href="/dashboard"
            className="text-xs font-semibold text-zinc-500 hover:text-emerald-600 dark:hover:text-emerald-400 shrink-0 hidden md:inline"
          >
            ← Citizen View
          </Link>
        </div>
      </div>
    </div>
  );
}
