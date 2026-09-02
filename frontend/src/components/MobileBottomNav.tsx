"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function MobileBottomNav() {
  const pathname = usePathname();

  const navItems = [
    { href: "/", label: "Feed", icon: "📰" },
    { href: "/safety-map", label: "Map", icon: "🗺️" },
    { href: "/reports/create", label: "Report", icon: "➕", isPrimary: true },
    { href: "/missing-person", label: "Missing", icon: "🔍" },
    { href: "/safety", label: "SOS 999", icon: "🚨", isEmergency: true },
  ];

  return (
    <nav
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-t border-zinc-200 dark:border-zinc-800 pb-safe"
    >
      <div className="grid grid-cols-5 h-14 items-center px-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;

          if (item.isPrimary) {
            return (
              <div key={item.href} className="flex justify-center items-center">
                <Link
                  href={item.href}
                  className="flex flex-col items-center justify-center -mt-5 h-12 w-12 rounded-full bg-emerald-700 text-white shadow-lg shadow-emerald-700/30 ring-4 ring-white dark:ring-zinc-900 hover:bg-emerald-600 active:scale-95 transition"
                  aria-label="Create Incident Report"
                >
                  <span className="text-xl leading-none font-bold">+</span>
                </Link>
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center py-1 text-center transition ${
                isActive
                  ? item.isEmergency
                    ? "text-red-600 font-bold"
                    : "text-emerald-700 dark:text-emerald-400 font-bold"
                  : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              <span className="text-lg leading-none">{item.icon}</span>
              <span className="text-[10px] tracking-tight mt-0.5 font-medium">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
