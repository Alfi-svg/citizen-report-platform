"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { Notification, NotificationPagination, NotificationType } from "@/lib/types";

const NOTIF_ICONS: Record<
  NotificationType,
  { icon: string; bg: string; text: string; label: string }
> = {
  REPORT_APPROVED: {
    icon: "✓",
    bg: "bg-emerald-100 dark:bg-emerald-950",
    text: "text-emerald-800 dark:text-emerald-300",
    label: "Approved & Published / অনুমোদিত",
  },
  REPORT_UNDER_REVIEW: {
    icon: "🔍",
    bg: "bg-amber-100 dark:bg-amber-950",
    text: "text-amber-800 dark:text-amber-300",
    label: "Under Active Review / পর্যালোচনাধীন",
  },
  REPORT_NEEDS_MORE_INFORMATION: {
    icon: "💬",
    bg: "bg-purple-100 dark:bg-purple-950",
    text: "text-purple-800 dark:text-purple-300",
    label: "Information Needed / তথ্য প্রয়োজন",
  },
  REPORT_REJECTED: {
    icon: "✕",
    bg: "bg-red-100 dark:bg-red-950",
    text: "text-red-800 dark:text-red-300",
    label: "Moderation Decision / সিদ্ধান্ত",
  },
  REPORT_SUBMITTED: {
    icon: "📋",
    bg: "bg-blue-100 dark:bg-blue-950",
    text: "text-blue-800 dark:text-blue-300",
    label: "Submitted / জমা হয়েছে",
  },
  REPORT_ARCHIVED: {
    icon: "📦",
    bg: "bg-zinc-100 dark:bg-zinc-800",
    text: "text-zinc-800 dark:text-zinc-300",
    label: "Archived / সংরক্ষিত",
  },
  COMMENT_MODERATED: {
    icon: "🛡️",
    bg: "bg-orange-100 dark:bg-orange-950",
    text: "text-orange-800 dark:text-orange-300",
    label: "Comment Moderation / মন্তব্য নিয়ন্ত্রণ",
  },
  FLAG_REVIEWED: {
    icon: "🚩",
    bg: "bg-cyan-100 dark:bg-cyan-950",
    text: "text-cyan-800 dark:text-cyan-300",
    label: "Safety Flag Inspected / ফ্ল্যাগ পর্যালোচনা",
  },
};

export default function NotificationsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 20;

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    let isMounted = true;
    if (isAuthenticated) {
      const offset = (page - 1) * limit;
      const url = `/notifications?limit=${limit}&offset=${offset}${
        unreadOnly ? "&unread_only=true" : ""
      }`;

      apiFetch<NotificationPagination>(url)
        .then((data) => {
          if (isMounted) {
            setNotifications(data.items);
            setTotal(data.total);
          }
        })
        .catch((err: unknown) => {
          if (isMounted && err instanceof Error) setError(err.message);
        })
        .finally(() => {
          if (isMounted) setLoading(false);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, page, unreadOnly]);

  const handleMarkAsRead = async (notifId: string) => {
    try {
      await apiFetch(`/notifications/${notifId}/read`, { method: "PATCH" });
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notifId ? { ...n, read_at: new Date().toISOString() } : n
        )
      );
    } catch (err: unknown) {
      if (err instanceof Error) alert(err.message);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await apiFetch("/notifications/read-all", { method: "PATCH" });
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
      );
    } catch (err: unknown) {
      if (err instanceof Error) alert(err.message);
    }
  };

  if (authLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <span>🔔 Activity & Notifications / বিজ্ঞপ্তি কেন্দ্র</span>
            <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-xs px-2.5 py-0.5 font-bold">
              {total}
            </span>
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Real-time status updates on your incident reports, evidence submissions, and moderation reviews.
          </p>
        </div>

        <button
          type="button"
          onClick={handleMarkAllAsRead}
          className="rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 shadow-sm transition"
        >
          ✓ Mark All as Read / সব পড়া হয়েছে
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-3 text-xs">
        <button
          type="button"
          onClick={() => {
            setUnreadOnly(false);
            setPage(1);
          }}
          className={`font-semibold pb-1 transition ${
            !unreadOnly
              ? "text-emerald-600 dark:text-emerald-400 border-b-2 border-emerald-600"
              : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          }`}
        >
          All Activity / সমস্ত বিজ্ঞপ্তি
        </button>
        <button
          type="button"
          onClick={() => {
            setUnreadOnly(true);
            setPage(1);
          }}
          className={`font-semibold pb-1 transition ${
            unreadOnly
              ? "text-emerald-600 dark:text-emerald-400 border-b-2 border-emerald-600"
              : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          }`}
        >
          Unread Only / অপঠিত
        </button>
      </div>

      {/* Notifications List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      ) : notifications.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800 p-12 text-center text-xs text-zinc-400 space-y-2">
          <span className="text-3xl block">📭</span>
          <p className="font-semibold text-zinc-600 dark:text-zinc-300">No notifications found.</p>
          <p className="text-[11px]">When moderators review your reports or content is updated, you will see notifications here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => {
            const isUnread = !n.read_at;
            const badge = NOTIF_ICONS[n.type] || NOTIF_ICONS.REPORT_SUBMITTED;
            return (
              <div
                key={n.id}
                className={`rounded-2xl border p-5 shadow-sm transition space-y-3 text-xs ${
                  isUnread
                    ? "border-emerald-200 bg-emerald-50/30 dark:border-emerald-900/60 dark:bg-emerald-950/20"
                    : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-xl text-xs font-bold ${badge.bg} ${badge.text}`}
                    >
                      {badge.icon}
                    </span>
                    <div>
                      <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">
                        {n.title}
                      </h3>
                      <span className="text-[10px] text-zinc-400 font-medium">
                        {badge.label}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-zinc-400">
                      {new Date(n.created_at).toLocaleString()}
                    </span>
                    {isUnread && (
                      <button
                        type="button"
                        onClick={() => handleMarkAsRead(n.id)}
                        className="rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 text-[10px] font-bold hover:bg-emerald-200 transition"
                      >
                        Mark Read
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed text-xs">
                  {n.message}
                </p>

                {n.report_id && (
                  <div className="pt-1 flex items-center justify-end">
                    <Link
                      href={`/reports/${n.report_id}`}
                      className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400 hover:underline text-xs"
                    >
                      <span>View Incident Report Details</span>
                      <span>→</span>
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
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
  );
}
