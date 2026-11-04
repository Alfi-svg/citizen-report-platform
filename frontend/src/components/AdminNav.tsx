"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import AdminCopilotModal from "@/components/AdminCopilotModal";
import {
  BarChart3,
  FileText,
  Flag,
  MessageSquare,
  Droplet,
  ShieldAlert,
  Search,
  Eye,
  Layers,
  Users,
  ShieldCheck,
  Tag,
  ArrowLeft,
  Sparkles,
} from "lucide-react";

interface AdminNavProps {
  pendingReports?: number;
  pendingFlags?: number;
}

export default function AdminNav({ pendingReports, pendingFlags }: AdminNavProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [copilotOpen, setCopilotOpen] = useState(false);

  const links = [
    {
      href: "/admin",
      label: "Overview",
      bn: "সংক্ষিপ্ত বিবরণ",
      icon: <BarChart3 className="h-4 w-4" aria-hidden="true" />,
    },
    {
      href: "/admin/reports",
      label: "Reports Queue",
      bn: "প্রতিবেদন সারি",
      icon: <FileText className="h-4 w-4" aria-hidden="true" />,
      badge: pendingReports,
    },
    {
      href: "/admin/flags",
      label: "Safety Flags",
      bn: "সুরক্ষা ফ্ল্যাগ",
      icon: <Flag className="h-4 w-4" aria-hidden="true" />,
      badge: pendingFlags,
    },
    {
      href: "/admin/comments",
      label: "Comments",
      bn: "মন্তব্য",
      icon: <MessageSquare className="h-4 w-4" aria-hidden="true" />,
    },
    {
      href: "/admin/blood-help",
      label: "Blood Help",
      bn: "রক্ত সহায়তা",
      icon: <Droplet className="h-4 w-4" aria-hidden="true" />,
    },
    {
      href: "/admin/emergency-services",
      label: "Safety Directory",
      bn: "জরুরি সেবা",
      icon: <ShieldAlert className="h-4 w-4" aria-hidden="true" />,
    },
    {
      href: "/admin/missing-person",
      label: "Missing Persons",
      bn: "নিখোঁজ ব্যক্তি",
      icon: <Search className="h-4 w-4" aria-hidden="true" />,
    },
    {
      href: "/admin/missing-person/sightings",
      label: "Sightings",
      bn: "তথ্য যাচাই",
      icon: <Eye className="h-4 w-4" aria-hidden="true" />,
    },
    {
      href: "/admin/clusters",
      label: "Clusters",
      bn: "ক্লাস্টার",
      icon: <Layers className="h-4 w-4" aria-hidden="true" />,
    },
    {
      href: "/admin/users",
      label: "Users",
      bn: "ব্যবহারকারী",
      icon: <Users className="h-4 w-4" aria-hidden="true" />,
    },
    {
      href: "/admin/reputation",
      label: "Reputation & Blood",
      bn: "সুনাম ও রক্তদান",
      icon: <ShieldCheck className="h-4 w-4" aria-hidden="true" />,
    },
    {
      href: "/admin/categories",
      label: "Categories",
      bn: "ক্যাটাগরি",
      icon: <Tag className="h-4 w-4" aria-hidden="true" />,
    },
  ];

  const isLinkActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin";
    if (href === "/admin/missing-person") {
      return (
        (pathname === "/admin/missing-person" || pathname.startsWith("/admin/missing-person/")) &&
        !pathname.startsWith("/admin/missing-person/sightings")
      );
    }
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-14 sm:top-16 z-40 shadow-xs">
      {/* Top Admin Status Strip */}
      <div className="border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-950/40 px-3 sm:px-6 lg:px-8 py-2">
        <div className="mx-auto max-w-7xl flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-800 dark:text-amber-400 border border-amber-500/30">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              ADMIN CONSOLE • অ্যাডমিন প্যানেল
            </span>
            <span className="hidden sm:inline text-xs text-slate-400 font-medium">
              NIRAPOTTA Moderation & Oversight
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setCopilotOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-700 hover:bg-purple-600 text-white text-[11px] font-bold shadow-xs transition cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5 text-purple-200" />
              <span>Copilot AI</span>
            </button>

            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Exit to Public Site</span>
            </Link>

            {user && (
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 hidden md:inline">
                {user.full_name || user.username}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Admin Horizontal Scroll Navigation Bar */}
      <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
        <nav
          className="flex items-center py-2 overflow-x-auto gap-1 no-scrollbar"
          aria-label="Admin Navigation"
        >
          {links.map((link) => {
            const isActive = isLinkActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive ? "page" : undefined}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap select-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-amber-500 ${
                  isActive
                    ? "bg-amber-100/80 text-amber-950 dark:bg-amber-950/80 dark:text-amber-200 font-bold"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
                }`}
              >
                <span className="shrink-0">{link.icon}</span>
                <span>{link.label}</span>
                {link.badge !== undefined && link.badge > 0 && (
                  <span className="ml-1 rounded-full bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 leading-none">
                    {link.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Admin Copilot Assistant Modal (Phase D) */}
      <AdminCopilotModal
        isOpen={copilotOpen}
        onClose={() => setCopilotOpen(false)}
      />
    </div>
  );
}
