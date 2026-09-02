"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { Notification, NotificationPagination, NotificationUnreadCount } from "@/lib/types";

export default function NotificationBell() {
  const { isAuthenticated } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [recentNotifications, setRecentNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggle = async () => {
    if (!isOpen) {
      setLoading(true);
      setIsOpen(true);
      try {
        const data = await apiFetch<NotificationPagination>("/notifications?limit=5&offset=0");
        setRecentNotifications(data.items);
      } catch {
        // Ignored
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
        className="relative rounded-xl p-2 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition focus:outline-none"
        aria-label="View notifications"
      >
        <span className="text-base">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white shadow-sm">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl border border-zinc-200 dark:border-zinc-800 py-3 z-50 text-xs">
          <div className="flex items-center justify-between px-4 pb-2.5 border-b border-zinc-100 dark:border-zinc-800">
            <span className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <span>🔔</span>
              <span>Notifications / বিজ্ঞপ্তি</span>
            </span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-72 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800">
            {loading ? (
              <div className="py-6 text-center text-zinc-400">Loading notifications...</div>
            ) : recentNotifications.length === 0 ? (
              <div className="py-6 text-center text-zinc-400 text-xs">
                No recent notifications.
              </div>
            ) : (
              recentNotifications.map((n) => {
                const isUnread = !n.read_at;
                return (
                  <div
                    key={n.id}
                    className={`p-3 transition ${
                      isUnread
                        ? "bg-emerald-50/40 dark:bg-emerald-950/20"
                        : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          {isUnread && (
                            <span className="h-2 w-2 rounded-full bg-emerald-600 shrink-0" />
                          )}
                          <span className="font-bold text-zinc-900 dark:text-zinc-100">
                            {n.title}
                          </span>
                        </div>
                        <p className="text-zinc-600 dark:text-zinc-400 text-[11px] leading-relaxed line-clamp-2">
                          {n.message}
                        </p>
                        <span className="text-[10px] text-zinc-400 block">
                          {new Date(n.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}{" "}
                          • {new Date(n.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      {isUnread && (
                        <button
                          type="button"
                          onClick={(e) => handleMarkAsRead(e, n.id)}
                          className="shrink-0 rounded p-1 text-[10px] font-semibold text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400"
                          title="Mark as read"
                        >
                          ✓
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="border-t border-zinc-100 dark:border-zinc-800 px-4 pt-2.5 text-center">
            <Link
              href="/notifications"
              onClick={() => setIsOpen(false)}
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline block"
            >
              View All Notifications →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
