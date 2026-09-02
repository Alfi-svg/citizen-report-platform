"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import NotificationBell from "@/components/NotificationBell";

export default function Navbar() {
  const pathname = usePathname();
  const { user, isAuthenticated, isAdmin, logout, isLoading } = useAuth();
  const [lang, setLang] = useState<"en" | "bn">("en");

  const toggleLanguage = () => {
    const nextLang = lang === "en" ? "bn" : "en";
    setLang(nextLang);
    if (typeof window !== "undefined") {
      localStorage.setItem("app_lang", nextLang);
      window.dispatchEvent(new Event("languagechange"));
    }
  };

  const navLinks = [
    { href: "/", label: "Feed", bn: "ফিড" },
    { href: "/safety-map", label: "Safety Map", bn: "নিরাপত্তা মানচিত্র" },
    { href: "/safety", label: "Find Help", bn: "জরুরি সেবা" },
    { href: "/missing-person", label: "Missing Persons", bn: "নিখোঁজ ব্যক্তি" },
    { href: "/transparency", label: "Transparency", bn: "স্বচ্ছতা" },
  ];

  return (
    <header className="border-b border-zinc-200/90 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md sticky top-0 z-50">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-3 sm:px-6 lg:px-8 h-16">
        {/* Brand Logo & Title */}
        <div className="flex items-center gap-3 shrink-0">
          <Link
            href="/"
            className="flex items-center gap-2.5 group rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
          >
            <div className="relative h-10 w-10 sm:h-11 sm:w-11 rounded-xl overflow-hidden shadow-2xs border border-emerald-700/20 group-hover:scale-105 transition">
              <Image
                src="/brand/logo-sm.jpg"
                alt="Bangladesh Citizen Report Logo"
                width={44}
                height={44}
                className="object-cover h-full w-full"
                priority
              />
            </div>
            <div className="flex flex-col">
              <span className="text-sm sm:text-base font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition leading-tight">
                {lang === "bn" ? "বাংলাদেশ সিটিজেন রিপোর্ট" : "Bangladesh Citizen Report"}
              </span>
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium hidden sm:inline leading-none">
                {lang === "bn" ? "একসাথে গড়ি নিরাপদ বাংলাদেশ" : "Together for a Safer Bangladesh"}
              </span>
            </div>
          </Link>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1 xl:gap-1.5" aria-label="Main Navigation">
          {navLinks.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 ${
                  isActive
                    ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold"
                    : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:text-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                {lang === "bn" ? item.bn : item.label}
              </Link>
            );
          })}
        </nav>

        {/* Action Controls & User Identity */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Emergency SOS Shortcut */}
          <Link
            href="/safety"
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white px-2.5 py-1.5 text-xs font-bold shadow-2xs transition shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
            title="Emergency Service & 999 Hotline"
          >
            <span className="h-2 w-2 rounded-full bg-white animate-ping" />
            <span className="hidden sm:inline">{lang === "bn" ? "জরুরি ৯৯৯" : "SOS 999"}</span>
          </Link>

          {/* Primary Report CTA */}
          <Link
            href="/reports/create"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white px-3.5 py-1.5 text-xs font-bold shadow-2xs transition shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
          >
            <span>+</span>
            <span>{lang === "bn" ? "রিপোর্ট করুন" : "Report Incident"}</span>
          </Link>

          {/* Language Switcher */}
          <button
            type="button"
            onClick={toggleLanguage}
            className="px-2 py-1 text-xs font-bold rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
            title="Switch Language / ভাষা পরিবর্তন"
          >
            {lang === "en" ? "বাংলা" : "EN"}
          </button>

          {/* Auth State Handling */}
          {isLoading ? (
            <div className="h-8 w-16 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
          ) : isAuthenticated && user ? (
            <div className="flex items-center gap-2">
              <NotificationBell />

              {isAdmin && (
                <Link
                  href="/admin"
                  className="hidden md:inline-flex items-center rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900 dark:bg-amber-950 dark:text-amber-300 hover:bg-amber-200 transition"
                >
                  Admin
                </Link>
              )}

              <Link
                href="/dashboard"
                className="flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-700 px-2.5 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
                title="Citizen Dashboard"
              >
                <div className="h-6 w-6 rounded-full bg-emerald-700 text-white flex items-center justify-center text-xs font-bold">
                  {(user.full_name || user.username).charAt(0).toUpperCase()}
                </div>
                <span className="hidden xl:inline text-xs font-semibold text-zinc-800 dark:text-zinc-200 max-w-[100px] truncate">
                  {user.full_name || user.username}
                </span>
              </Link>

              <button
                onClick={logout}
                type="button"
                className="hidden sm:inline-block rounded-lg border border-zinc-200 dark:border-zinc-700 px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 transition"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <Link
                href="/login"
                className="text-xs font-semibold text-zinc-700 hover:text-emerald-700 dark:text-zinc-300 dark:hover:text-emerald-400 px-2 py-1.5"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 px-3 py-1.5 text-xs font-semibold shadow-xs hover:opacity-90 transition hidden sm:inline-block"
              >
                Register
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
