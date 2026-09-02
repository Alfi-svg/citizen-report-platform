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
          <span className="absolute 1 top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-black text-white shadow-2xs">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Clean Notification Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl bg-white dark:bg-zinc-900 shadow-lg border border-zinc-200 dark:border-zinc-800 py-2.5 z-50 text-xs animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between px-3.5 pb-2 border-b border-zinc-100 dark:border-zinc-800">
            <span className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <span>Notifications</span>
              <span className="text-[10px] text-zinc-400 font-normal">/ বিজ্ঞপ্তি</span>
            </span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300 transition"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-72 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800">
            {loading ? (
              <div className="py-6 text-center text-zinc-400 text-xs">
                Loading notifications...
              </div>
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
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          {isUnread && (
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 shrink-0" />
                          )}
                          <span className="font-bold text-zinc-900 dark:text-zinc-100">
                            {n.title}
                          </span>
                        </div>
                        <p className="text-zinc-600 dark:text-zinc-400 text-[11px] leading-relaxed line-clamp-2">
                          {n.message}
                        </p>
                        <span className="text-[10px] text-zinc-400 block pt-0.5">
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
                          className="shrink-0 rounded p-1 text-[10px] font-semibold text-zinc-400 hover:text-emerald-700 dark:hover:text-emerald-400"
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

          <div className="border-t border-zinc-100 dark:border-zinc-800 px-3.5 pt-2 text-center">
            <Link
              href="/notifications"
              onClick={() => setIsOpen(false)}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300 block"
            >
              View All Notifications →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
