"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { Notification, NotificationPagination, NotificationUnreadCount } from "@/lib/types";
import { useBackClose } from "@/lib/useBackClose";

export default function NotificationBell() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [recentNotifications, setRecentNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Android back-button compatibility
  useBackClose(isOpen, () => setIsOpen(false), "notificationBell");

  // Fetch unread count on mount and when authentication changes
  useEffect(() => {
    let isMounted = true;
    if (isAuthenticated) {
      apiFetch<NotificationUnreadCount>("/notifications/unread-count")
        .then((res) => {
          if (isMounted) setUnreadCount(res.unread_count);
        })
        .catch(() => {});
    }
    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, isOpen]);

  // Real-time foreground push notification updates
  useEffect(() => {
    const handlePushReceived = () => {
      setUnreadCount((c) => c + 1);
    };
    window.addEventListener("notification:received", handlePushReceived);
    return () => {
      window.removeEventListener("notification:received", handlePushReceived);
    };
  }, []);

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleToggle = async () => {
    if (!isOpen) {
      setLoading(true);
      setIsOpen(true);
      try {
        const data = await apiFetch<NotificationPagination>("/notifications?limit=5&offset=0");
        setRecentNotifications(data.items);
      } catch {
        // Fallback or ignore
      } finally {
        setLoading(false);
      }
    } else {
      setIsOpen(false);
    }
  };

  const handleMarkAsRead = async (e: React.MouseEvent, notifId: string) => {
    e.stopPropagation();
    try {
      await apiFetch(`/notifications/${notifId}/read`, { method: "PATCH" });
      setRecentNotifications((prev) =>
        prev.map((n) => (n.id === notifId ? { ...n, read_at: new Date().toISOString() } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // Ignored
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await apiFetch("/notifications/read-all", { method: "PATCH" });
      setRecentNotifications((prev) =>
        prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch {
      // Ignored
    }
  };

  if (!isAuthenticated) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={handleToggle}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
        aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ""}`}
        aria-expanded={isOpen}
      >
        {/* Crisp SVG Bell Icon */}
        <svg
          className="h-5 w-5"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.75}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
          />
        </svg>

        {/* Small, neat unread indicator */}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-bold text-white shadow-2xs">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Clean Notification Dropdown */}
      {isOpen && (
        <>
          {/* Mobile backdrop for easy dismissal */}
          <div
            className="fixed inset-0 z-40 bg-black/25 backdrop-blur-2xs sm:hidden"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed inset-x-3 top-[calc(3.75rem+env(safe-area-inset-top,0px))] sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96 sm:max-w-sm rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl border border-zinc-200 dark:border-zinc-800 py-2.5 z-50 text-xs animate-in fade-in zoom-in-95 duration-150 max-h-[calc(85vh-env(safe-area-inset-top,0px))] flex flex-col">
            <div className="flex items-center justify-between px-3.5 pb-2 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
              <span className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                <span>Notifications</span>
                <span className="text-[10px] text-zinc-400 font-normal">/ বিজ্ঞপ্তি</span>
              </span>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllAsRead}
                  className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300 transition cursor-pointer min-h-[32px] px-2 flex items-center"
                >
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-72 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800 flex-1 overscroll-contain">
              {loading ? (
                <div className="py-8 flex flex-col items-center justify-center gap-2 text-zinc-400 text-xs">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                  <span>Loading notifications...</span>
                </div>
              ) : recentNotifications.length === 0 ? (
                <div className="py-8 text-center text-zinc-400 text-xs space-y-1">
                  <p className="font-medium text-zinc-500 dark:text-zinc-400">No recent notifications</p>
                  <p className="text-[11px]">You are completely up to date.</p>
                </div>
              ) : (
                recentNotifications.map((n) => {
                  const isUnread = !n.read_at;
                  return (
                    <div
                      key={n.id}
                      onClick={() => {
                        if (n.report_id) {
                          setIsOpen(false);
                          router.push(`/reports/${n.report_id}`);
                        }
                      }}
                      className={`p-3 transition ${n.report_id ? "cursor-pointer" : ""} ${
                        isUnread
                          ? "bg-emerald-50/50 dark:bg-emerald-950/25 border-l-[3px] border-l-emerald-600"
                          : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50 border-l-[3px] border-l-transparent"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            {isUnread && (
                              <span className="h-2 w-2 rounded-full bg-emerald-600 shrink-0" aria-label="Unread" />
                            )}
                            <span className="font-bold text-zinc-900 dark:text-zinc-100 break-words line-clamp-1">
                              {n.title}
                            </span>
                          </div>
                          <p className="text-zinc-600 dark:text-zinc-400 text-[11px] leading-relaxed line-clamp-2 break-words">
                            {n.message}
                          </p>
                          <span className="text-[10px] text-zinc-400 block">
                            {new Date(n.created_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}{" "}
                            • {new Date(n.created_at).toLocaleDateString()}
                          </span>
                          {n.report_id && (
                            <span className="inline-flex items-center gap-1 pt-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline">
                              <span>View report details</span>
                              <span>→</span>
                            </span>
                          )}
                        </div>

                        {isUnread && (
                          <button
                            type="button"
                            onClick={(e) => handleMarkAsRead(e, n.id)}
                            className="shrink-0 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-zinc-400 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-emerald-100/50 dark:hover:bg-emerald-950/50 transition cursor-pointer"
                            title="Mark as read"
                            aria-label="Mark as read"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="px-3.5 pt-2 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center text-[11px] shrink-0">
              <span className="text-zinc-400">
                {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
              </span>
              <Link
                href="/notifications"
                onClick={() => setIsOpen(false)}
                className="font-semibold text-emerald-700 dark:text-emerald-400 hover:underline py-1"
              >
                View all notifications →
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
