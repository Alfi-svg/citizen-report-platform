"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import NotificationBell from "@/components/NotificationBell";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, isAdmin, logout, isLoading } = useAuth();

  // Language State
  const [lang, setLang] = useState<"en" | "bn">("en");
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("app_lang") as "en" | "bn" | null;
      if (saved) setLang(saved);
    }
  }, []);

  const toggleLanguage = () => {
    const nextLang = lang === "en" ? "bn" : "en";
    setLang(nextLang);
    if (typeof window !== "undefined") {
      localStorage.setItem("app_lang", nextLang);
      window.dispatchEvent(new Event("languagechange"));
    }
  };

  // Profile Dropdown State
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Mobile Drawer State
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Search Modal State
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keyboard navigation & body scroll lock for mobile menu / search modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileMenuOpen(false);
        setSearchModalOpen(false);
        setProfileOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (mobileMenuOpen || searchModalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
  }, [mobileMenuOpen, searchModalOpen]);

  // Focus search input on open
  useEffect(() => {
    if (searchModalOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [searchModalOpen]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setProfileOpen(false);
    setSearchModalOpen(false);
  }, [pathname]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchModalOpen(false);
    }
  };

  // Primary Citizen Navigation Links
  const navLinks = [
    { href: "/", label: "Home", bn: "হোম" },
    {
      href: "/reports",
      label: "Reports",
      bn: "রিপোর্ট",
    },
    { href: "/safety-map", label: "Safety Map", bn: "নিরাপত্তা মানচিত্র" },
    {
      href: "/safety",
      label: "Find Help",
      bn: "সাহায্য খুঁজুন",
      isHelp: true,
    },
    {
      href: "/blood-help",
      label: "Blood Help",
      bn: "রক্ত সহায়তা",
      isBlood: true,
    },
    {
      href: "/missing-person",
      label: "Missing Persons",
      bn: "নিখোঁজ ব্যক্তি",
    },
    { href: "/transparency", label: "Transparency", bn: "স্বচ্ছতা" },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-zinc-200/90 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md transition-colors">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-3 sm:px-6 lg:px-8 h-14 sm:h-16">
          {/* ========================================================= */}
          {/* LEFT: Mobile Menu Button + Brand Logo & Title */}
          {/* ========================================================= */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Mobile Hamburger Toggle Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden flex h-9 w-9 items-center justify-center rounded-lg text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
              aria-label="Open navigation menu"
              aria-expanded={mobileMenuOpen}
            >
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
                  d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                />
              </svg>
            </button>

            {/* Official Logo & Platform Identity */}
            <Link
              href="/"
              className="flex items-center gap-2.5 group rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
            >
              <div className="relative h-8 w-8 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl overflow-hidden shadow-2xs border border-emerald-700/20 group-hover:scale-105 transition shrink-0">
                <Image
                  src="/brand/logo-sm.jpg"
                  alt="Bangladesh Citizen Report Emblem"
                  width={40}
                  height={40}
                  className="object-cover h-full w-full"
                  priority
                />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs sm:text-base font-black tracking-tight text-zinc-900 dark:text-zinc-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition leading-tight truncate max-w-[130px] sm:max-w-none">
                  {lang === "bn" ? "বাংলাদেশ সিটিজেন রিপোর্ট" : "Citizen Report BD"}
                </span>
                <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium hidden sm:inline leading-none">
                  {lang === "bn" ? "নিরাপদ বাংলাদেশ গড়ার প্ল্যাটফর্ম" : "Empowering Safer Communities"}
                </span>
              </div>
            </Link>
          </div>

          {/* ========================================================= */}
          {/* CENTER: Desktop Navigation Links */}
          {/* ========================================================= */}
          <nav
            className="hidden lg:flex items-center gap-0.5 xl:gap-1"
            aria-label="Main Navigation"
          >
            {navLinks.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors duration-150 flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 ${
                    isActive
                      ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold"
                      : item.isHelp
                      ? "text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50/60 dark:hover:bg-emerald-950/40 font-bold"
                      : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:text-zinc-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  {item.isHelp && <span className="text-emerald-600 dark:text-emerald-400">🛡️</span>}
                  {item.isBlood && <span className="text-rose-600 dark:text-rose-400">🩸</span>}
                  <span>{lang === "bn" ? item.bn : item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* ========================================================= */}
          {/* RIGHT: Search, SOS, Report CTA, Language, Notifications, Profile */}
          {/* ========================================================= */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Quick Search Button */}
            <button
              type="button"
              onClick={() => setSearchModalOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
              aria-label="Search incident reports"
              title="Search reports / অনুসন্ধান"
            >
              <svg
                className="h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
                />
              </svg>
            </button>

            {/* Emergency SOS 999 Shortcut (Desktop) */}
            <Link
              href="/safety"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white px-2.5 py-1.5 text-xs font-bold shadow-2xs transition shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
              title="Emergency Service & 999 Hotline"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
              <span>{lang === "bn" ? "জরুরি ৯৯৯" : "SOS 999"}</span>
            </Link>

            {/* Primary Action: Report an Issue */}
            <Link
              href="/reports/create"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white px-3 sm:px-3.5 py-1.5 text-xs font-bold shadow-2xs transition shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
            >
              <span className="text-sm leading-none font-bold">+</span>
              <span>{lang === "bn" ? "রিপোর্ট করুন" : "Report"}</span>
            </Link>

            {/* Language Switcher */}
            <button
              type="button"
              onClick={toggleLanguage}
              className="px-2 py-1 text-xs font-bold rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
              title="Switch Language / ভাষা পরিবর্তন"
            >
              {lang === "en" ? "বাং" : "EN"}
            </button>

            {/* Notification Bell */}
            <NotificationBell />

            {/* Auth / Profile Area */}
            {isLoading ? (
              <div className="h-8 w-8 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800" />
            ) : isAuthenticated && user ? (
              <div className="relative" ref={profileRef}>
                <button
                  type="button"
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-2 rounded-lg p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
                  aria-label="User profile menu"
                  aria-expanded={profileOpen}
                >
                  <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-emerald-700 text-white flex items-center justify-center text-xs font-bold shadow-2xs">
                    {(user.full_name || user.username).charAt(0).toUpperCase()}
                  </div>
                  <svg
                    className={`h-3.5 w-3.5 text-zinc-400 transition-transform duration-150 hidden sm:block ${
                      profileOpen ? "rotate-180" : ""
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                {/* Profile Dropdown Menu */}
                {profileOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-xl bg-white dark:bg-zinc-900 shadow-lg border border-zinc-200 dark:border-zinc-800 py-2 z-50 text-xs animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-4 py-2 border-b border-zinc-100 dark:border-zinc-800">
                      <p className="font-bold text-zinc-900 dark:text-zinc-100 truncate">
                        {user.full_name || user.username}
                      </p>
                      <p className="text-[11px] text-zinc-400 truncate">
                        {user.email || user.username}
                      </p>
                    </div>

                    <div className="py-1">
                      {isAdmin && (
                        <Link
                          href="/admin"
                          onClick={() => setProfileOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 font-bold text-amber-700 dark:text-amber-400 bg-amber-50/60 dark:bg-amber-950/40 hover:bg-amber-100/80 transition"
                        >
                          <span>🛡️</span>
                          <span>Admin Console</span>
                        </Link>
                      )}

                      <Link
                        href="/dashboard"
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                      >
                        <span>📊</span>
                        <span>Citizen Dashboard</span>
                      </Link>

                      <Link
                        href="/reports/mine"
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                      >
                        <span>📋</span>
                        <span>My Submissions</span>
                      </Link>

                      <Link
                        href="/notifications"
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                      >
                        <span>🔔</span>
                        <span>Notifications</span>
                      </Link>

                      <Link
                        href="/safety"
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                      >
                        <span>🚨</span>
                        <span>Emergency Directory</span>
                      </Link>
                    </div>

                    <div className="border-t border-zinc-100 dark:border-zinc-800 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setProfileOpen(false);
                          logout();
                        }}
                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition font-medium"
                      >
                        <span>🚪</span>
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <Link
                  href="/login"
                  className="px-2.5 py-1.5 text-xs font-semibold text-zinc-700 hover:text-emerald-700 dark:text-zinc-300 dark:hover:text-emerald-400 transition"
                >
                  {lang === "bn" ? "লগইন" : "Sign In"}
                </Link>
                <Link
                  href="/register"
                  className="hidden sm:inline-block rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 px-3 py-1.5 text-xs font-semibold shadow-2xs hover:opacity-90 transition"
                >
                  {lang === "bn" ? "নিবন্ধন" : "Register"}
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ========================================================= */}
      {/* MOBILE DRAWER / SLIDE-IN NAVIGATION MENU */}
      {/* ========================================================= */}
      {mobileMenuOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 lg:hidden flex"
        >
          {/* Backdrop */}
          <div
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-zinc-950/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
          />

          {/* Drawer Panel */}
          <div className="relative w-4/5 max-w-sm bg-white dark:bg-zinc-900 h-full shadow-2xl flex flex-col justify-between overflow-y-auto border-r border-zinc-200 dark:border-zinc-800 z-10 animate-in slide-in-from-left duration-200">
            {/* Drawer Header */}
            <div>
              <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="relative h-8 w-8 rounded-lg overflow-hidden border border-emerald-700/20">
                    <Image
                      src="/brand/logo-sm.jpg"
                      alt="Logo"
                      width={32}
                      height={32}
                      className="object-cover"
                    />
                  </div>
                  <div>
                    <h2 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                      {lang === "bn" ? "বাংলাদেশ সিটিজেন রিপোর্ট" : "Citizen Report BD"}
                    </h2>
                    <p className="text-[10px] text-zinc-400">
                      {lang === "bn" ? "নাগরিক নিরাপত্তা নেটওয়ার্ক" : "Civic Safety Network"}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                  aria-label="Close menu"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Grouped Drawer Links */}
              <div className="p-4 space-y-6 text-xs">
                {/* 1. MAIN */}
                <div className="space-y-1">
                  <p className="text-[10px] font-bold tracking-wider text-zinc-400 uppercase px-2">
                    {lang === "bn" ? "প্রধান মেনু" : "Main Navigation"}
                  </p>
                  <Link
                    href="/"
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg font-semibold transition ${
                      pathname === "/"
                        ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold"
                        : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    }`}
                  >
                    <span>🏠</span>
                    <span>{lang === "bn" ? "হোম ফিড" : "Home Feed"}</span>
                  </Link>

                  <Link
                    href="/safety-map"
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg font-semibold transition ${
                      pathname === "/safety-map"
                        ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold"
                        : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    }`}
                  >
                    <span>🗺️</span>
                    <span>{lang === "bn" ? "নিরাপত্তা মানচিত্র" : "Safety Map"}</span>
                  </Link>

                  <Link
                    href="/safety"
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg font-bold transition text-emerald-700 dark:text-emerald-400 ${
                      pathname === "/safety"
                        ? "bg-emerald-50 dark:bg-emerald-950/60"
                        : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    }`}
                  >
                    <span>🚨</span>
                    <span>{lang === "bn" ? "জরুরি সেবা ও ৯৯৯" : "Find Help & SOS 999"}</span>
                  </Link>
                </div>

                {/* 2. SAFETY & COMMUNITY */}
                <div className="space-y-1">
                  <p className="text-[10px] font-bold tracking-wider text-zinc-400 uppercase px-2">
                    {lang === "bn" ? "নিরাপত্তা ও রিপোর্ট" : "Safety & Reports"}
                  </p>
                  <Link
                    href="/blood-help"
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg font-semibold transition ${
                      pathname.startsWith("/blood-help")
                        ? "bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 font-bold"
                        : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    }`}
                  >
                    <span>🩸</span>
                    <span>{lang === "bn" ? "রক্ত সহায়তা" : "Blood Help"}</span>
                  </Link>

                  <Link
                    href="/missing-person"
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg font-semibold transition ${
                      pathname.startsWith("/missing-person")
                        ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold"
                        : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    }`}
                  >
                    <span>🔍</span>
                    <span>{lang === "bn" ? "নিখোঁজ ব্যক্তি অনুসন্ধান" : "Missing Persons"}</span>
                  </Link>

                  <Link
                    href="/reports/create"
                    className="flex items-center gap-3 px-3 py-2 rounded-lg font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30 transition"
                  >
                    <span>➕</span>
                    <span>{lang === "bn" ? "ঘটনা রিপোর্ট করুন" : "Report an Incident"}</span>
                  </Link>

                  <Link
                    href="/missing-person/create"
                    className="flex items-center gap-3 px-3 py-2 rounded-lg font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                  >
                    <span>📢</span>
                    <span>{lang === "bn" ? "নিখোঁজ ব্যক্তির তথ্য দিন" : "Submit Missing Alert"}</span>
                  </Link>
                </div>

                {/* 3. INSIGHTS */}
                <div className="space-y-1">
                  <p className="text-[10px] font-bold tracking-wider text-zinc-400 uppercase px-2">
                    {lang === "bn" ? "তথ্য ও বিশ্লেষণ" : "Insights & Transparency"}
                  </p>
                  <Link
                    href="/transparency"
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg font-semibold transition ${
                      pathname === "/transparency"
                        ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold"
                        : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    }`}
                  >
                    <span>📊</span>
                    <span>{lang === "bn" ? "স্বচ্ছতা ও ক্রাইম অ্যানালিটিক্স" : "Transparency & Analytics"}</span>
                  </Link>
                </div>

                {/* 4. ADMIN CONSOLE (If Admin) */}
                {isAdmin && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold tracking-wider text-amber-600 uppercase px-2">
                      Admin Oversight
                    </p>
                    <Link
                      href="/admin"
                      className="flex items-center gap-3 px-3 py-2 rounded-lg font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 hover:bg-amber-100 transition"
                    >
                      <span>🛡️</span>
                      <span>Admin Management Console</span>
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* Drawer Footer / Account Info */}
            <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/30 text-xs space-y-3">
              {isAuthenticated && user ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-xs">
                      {(user.full_name || user.username).charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-zinc-900 dark:text-zinc-100 truncate">
                        {user.full_name || user.username}
                      </p>
                      <p className="text-[10px] text-zinc-400 truncate">
                        {user.email || user.username}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <Link
                      href="/dashboard"
                      className="text-center py-1.5 px-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 font-semibold text-zinc-700 dark:text-zinc-300"
                    >
                      Dashboard
                    </Link>
                    <button
                      type="button"
                      onClick={logout}
                      className="py-1.5 px-2 rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/30 font-semibold text-red-600 dark:text-red-400"
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href="/login"
                    className="text-center py-2 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 font-bold text-zinc-800 dark:text-zinc-200"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/register"
                    className="text-center py-2 px-3 rounded-lg bg-emerald-700 text-white font-bold"
                  >
                    Register
                  </Link>
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-zinc-400">Language / ভাষা</span>
                <button
                  type="button"
                  onClick={toggleLanguage}
                  className="px-2.5 py-1 text-xs font-bold rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                >
                  {lang === "en" ? "বাংলা করুন" : "English"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SEARCH MODAL (Accessible Quick Search Experience) */}
      {/* ========================================================= */}
      {searchModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 sm:pt-24"
        >
          {/* Backdrop */}
          <div
            onClick={() => setSearchModalOpen(false)}
            className="fixed inset-0 bg-zinc-950/60 backdrop-blur-xs transition-opacity"
          />

          {/* Search Card */}
          <div className="relative w-full max-w-lg rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl p-4 sm:p-5 z-10 animate-in fade-in zoom-in-95 duration-150 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <span>🔍</span>
                <span>{lang === "bn" ? "নাগরিক রিপোর্ট অনুসন্ধান" : "Search Citizen Reports"}</span>
              </h3>
              <button
                type="button"
                onClick={() => setSearchModalOpen(false)}
                className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSearchSubmit} className="space-y-3">
              <div className="relative">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    lang === "bn"
                      ? "ঘটনা, এলাকা বা সমস্যা লিখে খুঁজুন (যেমন: মিরপুর, বিদ্যুৎ বিভ্রাট)..."
                      : "Search by title, location or keyword (e.g., Mirpur, road hazard)..."
                  }
                  className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />
              </div>

              {/* Quick Preset Filters */}
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                <span className="text-[11px] text-zinc-400 font-medium">Suggestions:</span>
                {["Dhaka", "Chittagong", "Traffic", "Waterlogging", "Missing"].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      setSearchQuery(tag);
                      router.push(`/?q=${encodeURIComponent(tag)}`);
                      setSearchModalOpen(false);
                    }}
                    className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 hover:text-emerald-700 text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 transition"
                  >
                    {tag}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setSearchModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white shadow-2xs transition"
                >
                  {lang === "bn" ? "খুঁজুন" : "Search"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
