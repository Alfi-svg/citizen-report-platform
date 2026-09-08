"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { Notification, NotificationPagination, NotificationType } from "@/lib/types";
import {
  checkPushPermissionStatus,
  requestPushPermission,
  isPushPromptDismissed,
  dismissPushPrompt,
  PushStatus,
} from "@/lib/pushNotifications";

interface NotifBadgeConfig {
  bg: string;
  text: string;
  label: string;
  renderIcon: () => React.ReactNode;
}

const NOTIF_CONFIGS: Record<NotificationType, NotifBadgeConfig> = {
  REPORT_APPROVED: {
    bg: "bg-emerald-100 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800/40",
    text: "text-emerald-800 dark:text-emerald-300",
    label: "Approved & Published / অনুমোদিত",
    renderIcon: () => (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    ),
  },
  REPORT_UNDER_REVIEW: {
    bg: "bg-amber-100 dark:bg-amber-950/70 border border-amber-200 dark:border-amber-800/40",
    text: "text-amber-800 dark:text-amber-300",
    label: "Under Active Review / পর্যালোচনাধীন",
    renderIcon: () => (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
      </svg>
    ),
  },
  REPORT_NEEDS_MORE_INFORMATION: {
    bg: "bg-purple-100 dark:bg-purple-950/70 border border-purple-200 dark:border-purple-800/40",
    text: "text-purple-800 dark:text-purple-300",
    label: "Information Needed / তথ্য প্রয়োজন",
    renderIcon: () => (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a.75.75 0 01-.818-.818 5.97 5.97 0 01.996-2.555C4.03 16.25 3 13.556 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
        />
      </svg>
    ),
  },
  REPORT_REJECTED: {
    bg: "bg-red-100 dark:bg-red-950/70 border border-red-200 dark:border-red-800/40",
    text: "text-red-800 dark:text-red-300",
    label: "Moderation Decision / সিদ্ধান্ত",
    renderIcon: () => (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
  },
  REPORT_SUBMITTED: {
    bg: "bg-blue-100 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800/40",
    text: "text-blue-800 dark:text-blue-300",
    label: "Submitted / জমা হয়েছে",
    renderIcon: () => (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  REPORT_ARCHIVED: {
    bg: "bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700",
    text: "text-zinc-800 dark:text-zinc-300",
    label: "Archived / সংরক্ষিত",
    renderIcon: () => (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
      </svg>
    ),
  },
  COMMENT_MODERATED: {
    bg: "bg-orange-100 dark:bg-orange-950/70 border border-orange-200 dark:border-orange-800/40",
    text: "text-orange-800 dark:text-orange-300",
    label: "Comment Moderation / মন্তব্য নিয়ন্ত্রণ",
    renderIcon: () => (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
  },
  FLAG_REVIEWED: {
    bg: "bg-cyan-100 dark:bg-cyan-950/70 border border-cyan-200 dark:border-cyan-800/40",
    text: "text-cyan-800 dark:text-cyan-300",
    label: "Safety Flag Inspected / ফ্ল্যাগ পর্যালোচনা",
    renderIcon: () => (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
      </svg>
    ),
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

  // Push notification opt-in states
  const [pushStatus, setPushStatus] = useState<PushStatus | null>(null);
  const [showPushBanner, setShowPushBanner] = useState(false);
  const [enablingPush, setEnablingPush] = useState(false);
  const [pushSuccessMsg, setPushSuccessMsg] = useState<string | null>(null);

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

  // Check push notification availability on mount (never prompts)
  useEffect(() => {
    checkPushPermissionStatus().then((status) => {
      setPushStatus(status);
      if (status.isSupported && !status.isGranted && !isPushPromptDismissed()) {
        setShowPushBanner(true);
      }
    });
  }, []);

  // Listen for real-time foreground push notification event
  useEffect(() => {
    const handleForegroundNotification = () => {
      const offset = (page - 1) * limit;
      const url = `/notifications?limit=${limit}&offset=${offset}${
        unreadOnly ? "&unread_only=true" : ""
      }`;
      apiFetch<NotificationPagination>(url)
        .then((data) => {
          setNotifications(data.items);
          setTotal(data.total);
        })
        .catch(() => {});
    };

    window.addEventListener("notification:received", handleForegroundNotification);
    return () => {
      window.removeEventListener("notification:received", handleForegroundNotification);
    };
  }, [page, unreadOnly]);

  const handleEnablePush = async () => {
    setEnablingPush(true);
    try {
      const granted = await requestPushPermission();
      if (granted) {
        setPushSuccessMsg("Push notifications enabled! / পুশ বিজ্ঞপ্তি সক্রিয় করা হয়েছে!");
        setShowPushBanner(false);
        const status = await checkPushPermissionStatus();
        setPushStatus(status);
        setTimeout(() => setPushSuccessMsg(null), 5000);
      }
    } finally {
      setEnablingPush(false);
    }
  };

  const handleDismissPush = () => {
    dismissPushPrompt();
    setShowPushBanner(false);
  };

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
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
                />
              </svg>
            </span>
            <span>Activity & Notifications</span>
            <span className="text-xs text-zinc-400 font-normal hidden sm:inline">/ বিজ্ঞপ্তি কেন্দ্র</span>
            <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-xs px-2.5 py-0.5 font-bold">
              {total}
            </span>
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Real-time status updates on your incident reports, evidence submissions, and moderation reviews.
          </p>
        </div>

        <button
          type="button"
          onClick={handleMarkAllAsRead}
          className="w-full sm:w-auto rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-750 shadow-xs transition min-h-[40px] flex items-center justify-center gap-2 cursor-pointer shrink-0 active:scale-98"
        >
          <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span>Mark All as Read / সব পড়া হয়েছে</span>
        </button>
      </div>

      {/* Push Success message */}
      {pushSuccessMsg && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/30 p-3.5 text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <span>{pushSuccessMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setPushSuccessMsg(null)}
            className="text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 font-bold px-2 py-1 min-h-[36px] flex items-center cursor-pointer"
            aria-label="Close message"
          >
            ✕
          </button>
        </div>
      )}

      {/* Non-intrusive Android Push Notification Opt-in Card */}
      {showPushBanner && (
        <div className="rounded-2xl border border-teal-200 dark:border-teal-800/60 bg-teal-50/70 dark:bg-teal-950/30 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-start gap-3.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-white shadow-xs">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
              </svg>
            </span>
            <div className="space-y-0.5">
              <h2 className="text-sm font-bold text-teal-950 dark:text-teal-100">
                Enable Instant Alerts / তাত্ক্ষণিক বিজ্ঞপ্তি চালু করুন
              </h2>
              <p className="text-xs text-teal-700 dark:text-teal-300/90 leading-relaxed">
                Receive notifications when your reports are verified, comments are reviewed, or urgent blood requests happen in your area.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0">
            <button
              type="button"
              onClick={handleDismissPush}
              className="flex-1 sm:flex-initial px-3.5 py-2 text-xs font-semibold text-teal-700 dark:text-teal-300 hover:text-teal-900 dark:hover:text-teal-100 rounded-xl transition min-h-[40px] flex items-center justify-center cursor-pointer"
            >
              Later / পরে
            </button>
            <button
              type="button"
              onClick={handleEnablePush}
              disabled={enablingPush}
              className="flex-1 sm:flex-initial px-4 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 active:bg-teal-800 rounded-xl shadow-xs transition flex items-center justify-center gap-2 min-h-[40px] cursor-pointer disabled:opacity-50"
            >
              {enablingPush ? (
                <>
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Enabling...</span>
                </>
              ) : (
                <span>Enable Alerts / চালু করুন</span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Push Status Pill if already granted on native Android */}
      {pushStatus?.isGranted && (
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-100/80 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-xs font-medium border border-emerald-200 dark:border-emerald-800/50">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <span>Android Push Notifications Active / পুশ বিজ্ঞপ্তি সক্রিয়</span>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-2 text-xs">
        <button
          type="button"
          onClick={() => {
            setUnreadOnly(false);
            setPage(1);
          }}
          className={`font-semibold pb-2 transition flex items-center gap-1.5 min-h-[40px] cursor-pointer ${
            !unreadOnly
              ? "text-emerald-600 dark:text-emerald-400 border-b-2 border-emerald-600"
              : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          }`}
        >
          <span>All Activity / সমস্ত বিজ্ঞপ্তি</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
            {total}
          </span>
        </button>
        <button
          type="button"
          onClick={() => {
            setUnreadOnly(true);
            setPage(1);
          }}
          className={`font-semibold pb-2 transition flex items-center gap-1.5 min-h-[40px] cursor-pointer ${
            unreadOnly
              ? "text-emerald-600 dark:text-emerald-400 border-b-2 border-emerald-600"
              : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          }`}
        >
          <span>Unread Only / অপঠিত</span>
        </button>
      </div>

      {/* Notifications List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
          <span className="text-xs text-zinc-500">Loading notifications...</span>
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      ) : notifications.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800 p-12 text-center text-xs text-zinc-400 space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          </div>
          <p className="font-semibold text-zinc-700 dark:text-zinc-200 text-sm">No notifications found.</p>
          <p className="text-[11px] max-w-sm mx-auto text-zinc-500">
            When moderators review your reports, updates occur, or critical events take place, you will see notifications here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => {
            const isUnread = !n.read_at;
            const badge = NOTIF_CONFIGS[n.type] || NOTIF_CONFIGS.REPORT_SUBMITTED;

            return (
              <article
                key={n.id}
                className={`rounded-2xl border p-4 sm:p-5 shadow-xs transition space-y-3 text-xs overflow-hidden ${
                  isUnread
                    ? "border-l-4 border-l-emerald-600 border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-emerald-950/20"
                    : "border-l-4 border-l-transparent border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
                }`}
              >
                {/* Responsive Top Bar: Mobile Safe */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <span
                      className={`flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl font-bold shadow-2xs ${badge.bg} ${badge.text}`}
                      aria-hidden="true"
                    >
                      {badge.renderIcon()}
                    </span>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm sm:text-base leading-snug break-words">
                          {n.title}
                        </h3>
                        {isUnread && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white shrink-0">
                            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                            <span>Unread</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Mark as read button */}
                  {isUnread && (
                    <button
                      type="button"
                      onClick={() => handleMarkAsRead(n.id)}
                      className="shrink-0 min-h-[36px] px-3 py-1.5 text-xs font-semibold rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900 transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                      aria-label="Mark notification as read"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="hidden sm:inline">Mark Read</span>
                    </button>
                  )}
                </div>

                {/* Message Body */}
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed text-xs sm:text-sm break-words whitespace-pre-line pl-0 sm:pl-11">
                  {n.message}
                </p>

                {/* Bottom Metadata & Deep Link Row */}
                <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-400 pl-0 sm:pl-11">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200/50 dark:border-zinc-700/50">
                      {badge.label}
                    </span>
                    <span>
                      {new Date(n.created_at).toLocaleString([], {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                  </div>

                  {n.report_id && (
                    <Link
                      href={`/reports/${n.report_id}`}
                      className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400 hover:underline min-h-[36px] px-1 transition"
                    >
                      <span>View Report Details</span>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                      </svg>
                    </Link>
                  )}
                </div>
              </article>
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
            className="rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-2 text-zinc-700 dark:text-zinc-300 disabled:opacity-40 min-h-[40px] flex items-center cursor-pointer font-medium"
          >
            ← Previous
          </button>
          <span className="text-zinc-500 font-medium">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-2 text-zinc-700 dark:text-zinc-300 disabled:opacity-40 min-h-[40px] flex items-center cursor-pointer font-medium"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
