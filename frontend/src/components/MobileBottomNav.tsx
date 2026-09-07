"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function MobileBottomNav() {
  const pathname = usePathname();
  const [lang, setLang] = useState<"en" | "bn">("en");

  useEffect(() => {
    const checkLang = () => {
      if (typeof window !== "undefined") {
        const saved = localStorage.getItem("app_lang") as "en" | "bn" | null;
        if (saved) setLang(saved);
      }
    };
    checkLang();
    window.addEventListener("languagechange", checkLang);
    return () => window.removeEventListener("languagechange", checkLang);
  }, []);

  const navItems = [
    {
      href: "/",
      label: lang === "bn" ? "হোম" : "Home",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
        </svg>
      ),
    },
    {
      href: "/reports",
      label: lang === "bn" ? "রিপোর্ট" : "Reports",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
        </svg>
      ),
    },
    {
      href: "/reports/create",
      label: lang === "bn" ? "রিপোর্ট করুন" : "Report",
      isPrimary: true,
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      ),
    },
    {
      href: "/safety-map",
      label: lang === "bn" ? "মানচিত্র" : "Map",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.31a1.125 1.125 0 0 0-1.006 0L3.622 5.748A1.125 1.125 0 0 0 3 6.754v11.926c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z" />
        </svg>
      ),
    },
    {
      href: "/safety",
      label: lang === "bn" ? "জরুরি ৯৯৯" : "SOS 999",
      isEmergency: true,
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.249-8.25-3.286Zm0 13.036h.008v.008H12v-.008Z" />
        </svg>
      ),
    },
  ];

  return (
    <nav
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-t border-slate-200/70 dark:border-white/10 pb-safe shadow-[0_-4px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_24px_rgba(0,0,0,0.4)]"
    >
      <div className="grid grid-cols-5 h-14 items-center px-1">
        {navItems.map((item) => {
          let isActive = false;
          if (item.href === "/") {
            isActive = pathname === "/";
          } else if (item.href === "/reports") {
            isActive =
              pathname === "/reports" ||
              (pathname.startsWith("/reports/") &&
                !pathname.startsWith("/reports/create") &&
                !pathname.startsWith("/reports/mine"));
          } else if (item.href === "/reports/create") {
            isActive = pathname.startsWith("/reports/create");
          } else if (item.href === "/safety-map") {
            isActive = pathname.startsWith("/safety-map");
          } else if (item.href === "/safety") {
            isActive =
              (pathname === "/safety" || pathname.startsWith("/safety/")) &&
              !pathname.startsWith("/safety-map");
          } else {
            isActive = pathname.startsWith(item.href);
          }

          if (item.isPrimary) {
            return (
              <div key={item.href} className="flex justify-center items-center">
                <Link
                  href={item.href}
                  className={`flex flex-col items-center justify-center -mt-5 h-12 w-12 rounded-full bg-gradient-to-br from-emerald-600 to-emerald-800 text-white shadow-lg shadow-emerald-700/40 ring-4 ring-white/90 dark:ring-zinc-900/90 hover:from-emerald-500 hover:to-emerald-700 active:scale-95 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 ${
                    isActive ? "ring-emerald-400 dark:ring-emerald-600 shadow-emerald-600/50" : ""
                  }`}
                  aria-label={lang === "bn" ? "নতুন ঘটনা রিপোর্ট করুন" : "Create Incident Report"}
                  aria-current={isActive ? "page" : undefined}
                >
                  {item.icon}
                </Link>
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={`flex flex-col items-center justify-center min-h-[44px] py-1 text-center transition select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 rounded-xl active:scale-95 ${
                isActive
                  ? item.isEmergency
                    ? "text-red-600 font-black"
                    : "text-emerald-700 dark:text-emerald-400 font-black"
                  : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              <div className="relative">
                {item.icon}
                {item.isEmergency && (
                  <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-600 animate-ping" />
                )}
              </div>
              <span className="text-[10px] tracking-tight mt-0.5 font-semibold">
                {item.label}
              </span>
              {isActive && !item.isEmergency && (
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-700 dark:bg-emerald-400 mt-0.5" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
