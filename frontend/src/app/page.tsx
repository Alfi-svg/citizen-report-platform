"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { apiFetch, getApiBaseUrl } from "@/lib/api";
import {
  PublicCategory,
  PublicReportPagination,
  KPICardsResponse,
  PublicMissingPersonAlertPagination,
  PublicMissingPersonAlertResponse,
} from "@/lib/types";
import { translations, Language } from "@/lib/i18n";
import PublicReportCard from "@/components/PublicReportCard";
import { StatusBadge } from "@/components/ui";

export default function HomePage() {
  const { isAuthenticated, user } = useAuth();

  // Language state synchronized with app_lang
  const [lang, setLang] = useState<Language>("en");
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = (localStorage.getItem("app_lang") as Language) || "en";
      setLang(saved);
      const handleLangChange = () => {
        const next = (localStorage.getItem("app_lang") as Language) || "en";
        setLang(next);
      };
      window.addEventListener("languagechange", handleLangChange);
      return () => window.removeEventListener("languagechange", handleLangChange);
    }
  }, []);

  const t = translations[lang];

  // 1. Category Data
  const [categories, setCategories] = useState<PublicCategory[]>([]);

  // 2. Report Feed Data & Filters
  const [data, setData] = useState<PublicReportPagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeSearch, setActiveSearch] = useState<string>("");
  const [locationQuery, setLocationQuery] = useState<string>("");
  const [activeLocation, setActiveLocation] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<"latest" | "trending">("latest");
  const [page, setPage] = useState<number>(0);
  const PAGE_SIZE = 6;

  // 3. Transparency Dynamic KPIs
  const [kpis, setKpis] = useState<KPICardsResponse | null>(null);

  // 4. Missing Person Alerts
  const [missingAlerts, setMissingAlerts] = useState<PublicMissingPersonAlertResponse[]>([]);
  const [missingLoading, setMissingLoading] = useState<boolean>(true);

  // Fetch Public Categories
  useEffect(() => {
    let isMounted = true;
    apiFetch<PublicCategory[]>("/public/categories")
      .then((cats) => {
        if (isMounted) setCategories(cats);
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch Transparency Dynamic KPIs
  useEffect(() => {
    let isMounted = true;
    apiFetch<KPICardsResponse>("/analytics/kpis")
      .then((res) => {
        if (isMounted) setKpis(res);
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch Active Missing Person Alerts
  useEffect(() => {
    let isMounted = true;
    setMissingLoading(true);
    apiFetch<PublicMissingPersonAlertPagination>(
      "/missing-person/alerts?limit=3&alert_status=ALERT_ACTIVE"
    )
      .then((res) => {
        if (isMounted) {
          setMissingAlerts(res.items || []);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setMissingLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch Public Approved Reports Feed
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    const params = new URLSearchParams();
    params.append("sort", sortOrder);
    if (selectedCategory) params.append("category_id", selectedCategory);
    if (activeLocation.trim()) params.append("location", activeLocation.trim());
    if (activeSearch.trim()) params.append("q", activeSearch.trim());
    params.append("limit", PAGE_SIZE.toString());
    params.append("offset", (page * PAGE_SIZE).toString());

    apiFetch<PublicReportPagination>(`/public/reports?${params.toString()}`)
      .then((res) => {
        if (isMounted) {
          setData(res);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (isMounted && err instanceof Error) setError(err.message);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [sortOrder, selectedCategory, activeLocation, activeSearch, page]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    setActiveSearch(searchQuery);
    setActiveLocation(locationQuery);
  };

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1;

  const apiBase = getApiBaseUrl();
  const getFullUrl = (downloadUrl?: string) => {
    if (!downloadUrl) return "/brand/logo-sm.jpg";
    if (downloadUrl.startsWith("http")) return downloadUrl;
    const normalizedPath = downloadUrl.replace(/^\/api\/v1/, "");
    return `${apiBase}${normalizedPath}`;
  };

  return (
    <div className="space-y-12 sm:space-y-16 pb-12">
      {/* =================================================================== */}
      {/* 1. HERO SECTION: Clean, Bangladesh Artwork, Trustworthy Messaging  */}
      {/* =================================================================== */}
      <section className="relative overflow-hidden bg-zinc-950 text-white border-b border-zinc-800/80">
        {/* Background Image with Dark Emerald/Neutral Overlay */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/brand/bangladesh-hero-bg.jpg"
            alt="Bangladesh National Heritage"
            fill
            className="object-cover object-center opacity-25"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/85 to-emerald-950/75" />
        </div>

        {/* Hero Content */}
        <div className="relative z-10 mx-auto max-w-5xl px-4 py-12 sm:py-20 text-center space-y-5">
          {/* Trust Pill */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 backdrop-blur-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>
              {lang === "bn"
                ? "যাচাইকৃত নাগরিক রিপোর্টিং নেটওয়ার্ক • বাংলাদেশ"
                : "Platform-Reviewed Citizen Reporting • Bangladesh"}
            </span>
          </div>

          {/* Compact Emblem */}
          <div className="mx-auto h-14 w-14 sm:h-16 sm:w-16 relative rounded-2xl overflow-hidden shadow-md border border-emerald-500/40">
            <Image
              src="/brand/logo-sm.jpg"
              alt="Bangladesh Citizen Report Emblem"
              fill
              className="object-cover"
              priority
            />
          </div>

          {/* Heading */}
          <div className="space-y-2">
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight max-w-3xl mx-auto leading-tight">
              {lang === "bn"
                ? "রিপোর্ট করুন। সুরক্ষা নিশ্চিত করুন। একসাথে গড়ি নিরাপদ বাংলাদেশ।"
                : "Report. Protect. Understand."}
            </h1>
            <p className="text-emerald-400 text-base sm:text-xl font-bold tracking-tight">
              {lang === "bn" ? "Together for a safer Bangladesh." : "Together for a safer Bangladesh."}
            </p>
          </div>

          {/* Supporting Copy */}
          <p className="text-xs sm:text-sm text-zinc-300 max-w-2xl mx-auto leading-relaxed">
            {lang === "bn"
              ? "নাগরিক সমস্যা ও ঘটনা রিপোর্ট করুন, কাছাকাছি জরুরি সেবা খুঁজুন এবং যাচাইকৃত পর্যালোচিত তথ্যের মাধ্যমে সচেতন থাকুন।"
              : "Report incidents, discover community safety information, find help near you, and stay informed through platform-reviewed reports."}
          </p>

          {/* Hero Action CTAs */}
          <div className="pt-3 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/reports/create"
              className="rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white px-6 py-3 text-xs sm:text-sm font-bold shadow-md shadow-emerald-700/25 transition active:scale-95 flex items-center gap-2"
            >
              <span>+</span>
              <span>{lang === "bn" ? "রিপোর্ট করুন" : "Report an Issue"}</span>
            </Link>

            <Link
              href="/safety"
              className="rounded-xl bg-red-600 hover:bg-red-500 active:bg-red-700 text-white px-5 py-3 text-xs sm:text-sm font-bold shadow-md shadow-red-700/25 transition active:scale-95 flex items-center gap-2"
            >
              <span className="animate-ping h-2 w-2 rounded-full bg-white" />
              <span>{lang === "bn" ? "কাছাকাছি সাহায্য খুঁজুন" : "Find Help Near Me"}</span>
            </Link>

            <Link
              href="/safety-map"
              className="rounded-xl border border-zinc-700 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-200 px-4 py-3 text-xs sm:text-sm font-semibold transition backdrop-blur-xs flex items-center gap-1.5"
            >
              <span>🗺️</span>
              <span>{lang === "bn" ? "নিরাপত্তা মানচিত্র" : "Safety Map"}</span>
            </Link>
          </div>

          {/* Logged-in personalization notice */}
          {isAuthenticated && user && (
            <p className="text-[11px] text-zinc-400 pt-2">
              {lang === "bn" ? "স্বাগতম, " : "Welcome back, "}
              <span className="text-zinc-200 font-semibold">{user.full_name || user.username}</span>.{" "}
              <Link href="/dashboard" className="text-emerald-400 hover:underline ml-1">
                {lang === "bn" ? "আপনার ড্যাশবোর্ড দেখুন →" : "View your citizen dashboard →"}
              </Link>
            </p>
          )}
        </div>
      </section>

      {/* Main Page Container */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12 sm:space-y-16">
        {/* =================================================================== */}
        {/* 2. SAFETY TOOLS SECTION: 4 Clean Reusable Tool Cards                */}
        {/* =================================================================== */}
        <section className="space-y-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
              {lang === "bn" ? "নিরাপত্তা সেবাসমূহ" : "Safety Tools"}
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              {lang === "bn"
                ? "জরুরি সেবা ও নাগরিক সুরক্ষার গুরুত্বপূর্ণ ফিচারসমূহে দ্রুত প্রবেশ করুন।"
                : "Quick access to important safety features across Bangladesh."}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
            {/* Tool 1: Find Help */}
            <Link
              href="/safety"
              className="group rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5 shadow-2xs hover:border-red-500/40 hover:shadow-xs transition-all flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="h-9 w-9 rounded-lg bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center text-lg mb-3 shadow-2xs group-hover:scale-105 transition">
                  🚨
                </div>
                <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 group-hover:text-red-600 transition">
                  {lang === "bn" ? "সাহায্য খুঁজুন" : "Find Help"}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                  {lang === "bn"
                    ? "নিকটস্থ থানা, পুলিশ বক্স, ফায়ার সার্ভিস ও জরুরি ৯৯৯ হটলাইন খুঁজুন।"
                    : "Find nearby police stations, police boxes, fire services and 999 emergency hotline."}
                </p>
              </div>
              <span className="text-xs font-bold text-red-600 dark:text-red-400 flex items-center gap-1 pt-1">
                <span>{lang === "bn" ? "জরুরি সাহায্য নিন" : "Open Navigator"}</span>
                <span>→</span>
              </span>
            </Link>

            {/* Tool 2: Missing Persons */}
            <Link
              href="/missing-person"
              className="group rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5 shadow-2xs hover:border-amber-500/40 hover:shadow-xs transition-all flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="h-9 w-9 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center text-lg mb-3 shadow-2xs group-hover:scale-105 transition">
                  🔍
                </div>
                <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 group-hover:text-amber-600 transition">
                  {lang === "bn" ? "নিখোঁজ ব্যক্তি" : "Missing Persons"}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                  {lang === "bn"
                    ? "সক্রিয় নিখোঁজ অ্যালার্ট দেখুন এবং অনুসন্ধানে তথ্য জমা দিন।"
                    : "View active missing-person alerts and submit verified community sightings to help families."}
                </p>
              </div>
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1 pt-1">
                <span>{lang === "bn" ? "অ্যালার্ট নেটওয়ার্ক" : "View Alerts"}</span>
                <span>→</span>
              </span>
            </Link>

            {/* Tool 3: Safety Map */}
            <Link
              href="/safety-map"
              className="group rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5 shadow-2xs hover:border-emerald-600/40 hover:shadow-xs transition-all flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="h-9 w-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-lg mb-3 shadow-2xs group-hover:scale-105 transition">
                  🗺️
                </div>
                <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 group-hover:text-emerald-700 transition">
                  {lang === "bn" ? "নিরাপত্তা মানচিত্র" : "Safety Map"}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                  {lang === "bn"
                    ? "ইন্টারেক্টিভ মানচিত্রে নাগরিক রিপোর্ট ও এলাকার বিপদ ক্লাস্টার পর্যবেক্ষণ করুন।"
                    : "Explore community-reported incidents, hazards and cluster patterns across Bangladesh on an interactive map."}
                </p>
              </div>
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1 pt-1">
                <span>{lang === "bn" ? "ম্যাপ দেখুন" : "Explore Map"}</span>
                <span>→</span>
              </span>
            </Link>

            {/* Tool 4: Safety Alerts & Preferences */}
            <Link
              href={isAuthenticated ? "/dashboard" : "/login"}
              className="group rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5 shadow-2xs hover:border-blue-500/40 hover:shadow-xs transition-all flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="h-9 w-9 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center text-lg mb-3 shadow-2xs group-hover:scale-105 transition">
                  🔔
                </div>
                <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 group-hover:text-blue-600 transition">
                  {lang === "bn" ? "সুরক্ষা অ্যালার্ট" : "Safety Alerts"}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                  {lang === "bn"
                    ? "আপনার এলাকার যাচাইকৃত নাগরিক সমস্যা ও জরুরি সতর্কবার্তা গ্রহণ করুন।"
                    : "Configure district notifications to receive alerts about nearby safety incidents and missing persons."}
                </p>
              </div>
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1 pt-1">
                <span>{lang === "bn" ? "অ্যালার্ট সেটিংস" : "Configure Alerts"}</span>
                <span>→</span>
              </span>
            </Link>
          </div>
        </section>

        {/* =================================================================== */}
        {/* 3. RECENT COMMUNITY REPORTS FEED                                   */}
        {/* =================================================================== */}
        <section className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800/80 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse" />
                <h2 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
                  {lang === "bn" ? "সাম্প্রতিক নাগরিক রিপোর্ট" : "Recent Community Reports"}
                </h2>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                {lang === "bn"
                  ? "সারাদেশের প্ল্যাটফর্ম-যাচাইকৃত এবং অনুমোদিত নাগরিক প্রতিবেদনসমূহ।"
                  : "Platform-reviewed community reports across Bangladesh."}
              </p>
            </div>

            {/* Sort Order Tabs */}
            <div className="inline-flex rounded-xl bg-zinc-100 dark:bg-zinc-800 p-1 border border-zinc-200 dark:border-zinc-700 self-start sm:self-auto shrink-0">
              <button
                type="button"
                onClick={() => {
                  setSortOrder("latest");
                  setPage(0);
                }}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition select-none ${
                  sortOrder === "latest"
                    ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-2xs"
                    : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400"
                }`}
              >
                {lang === "bn" ? "সর্বশেষ" : "Latest"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSortOrder("trending");
                  setPage(0);
                }}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition select-none ${
                  sortOrder === "trending"
                    ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-2xs"
                    : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400"
                }`}
              >
                {lang === "bn" ? "জনপ্রিয়" : "Trending"}
              </button>
            </div>
          </div>

          {/* Search & Location Filter Toolbar */}
          <form
            onSubmit={handleSearchSubmit}
            className="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-white dark:bg-zinc-900 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-2xs"
          >
            <div className="sm:col-span-6 relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  lang === "bn"
                    ? "কীওয়ার্ড লিখে খুঁজুন (যেমন: বিদ্যুৎ, সড়ক, বর্জ্য)..."
                    : "Search incident keywords (e.g. fire, road, water)..."
                }
                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 px-3.5 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-emerald-700"
              />
            </div>

            <div className="sm:col-span-4 relative">
              <input
                type="text"
                value={locationQuery}
                onChange={(e) => setLocationQuery(e.target.value)}
                placeholder={
                  lang === "bn"
                    ? "এলাকা বা জেলা (যেমন: ঢাকা, মিরপুর)..."
                    : "District or Area (e.g. Dhaka, Mirpur)..."
                }
                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 px-3.5 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-emerald-700"
              />
            </div>

            <div className="sm:col-span-2">
              <button
                type="submit"
                className="w-full rounded-lg bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white py-2 text-xs font-bold transition shadow-2xs"
              >
                {lang === "bn" ? "অনুসন্ধান" : "Search"}
              </button>
            </div>
          </form>

          {/* Category Chips Bar */}
          {categories.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory("");
                  setPage(0);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition select-none ${
                  selectedCategory === ""
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-2xs font-bold"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                }`}
              >
                {lang === "bn" ? "সকল ধরন" : "All Categories"}
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(cat.id);
                    setPage(0);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition select-none ${
                    selectedCategory === cat.id
                      ? "bg-emerald-700 text-white shadow-2xs font-bold"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}

          {/* Feed Content Grid */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-3 animate-pulse"
                >
                  <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-1/3" />
                  <div className="h-5 bg-zinc-200 dark:bg-zinc-800 rounded w-3/4" />
                  <div className="h-24 bg-zinc-100 dark:bg-zinc-800/50 rounded w-full" />
                  <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 p-6 text-center">
              <p className="text-sm font-semibold text-red-800 dark:text-red-300 mb-3">
                {error}
              </p>
              <button
                onClick={() => setPage(0)}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-500 transition"
              >
                {lang === "bn" ? "পুনরায় চেষ্টা করুন" : "Retry Loading Feed"}
              </button>
            </div>
          ) : !data || data.items.length === 0 ? (
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-10 text-center space-y-3">
              <div className="text-3xl">📋</div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                {lang === "bn" ? "কোনো রিপোর্ট পাওয়া যায়নি" : "No Verified Reports Found"}
              </h3>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto leading-relaxed">
                {lang === "bn"
                  ? "আপনার অনুসন্ধান বা নির্বাচিত ক্যাটাগরির সাথে সামঞ্জস্যপূর্ণ কোনো রিপোর্ট নেই।"
                  : "There are currently no approved community reports matching your search or filter criteria."}
              </p>
              <Link
                href="/reports/create"
                className="inline-block mt-2 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-2xs hover:bg-emerald-600 transition"
              >
                {lang === "bn" ? "প্রথম রিপোর্ট জমা দিন" : "Submit First Report"}
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {data.items.map((report) => (
                <PublicReportCard key={report.id} report={report} />
              ))}
            </div>
          )}

          {/* Pagination & View All Link */}
          {data && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
              <Link
                href="/"
                onClick={() => {
                  setSelectedCategory("");
                  setActiveSearch("");
                  setSearchQuery("");
                  setActiveLocation("");
                  setLocationQuery("");
                  setPage(0);
                }}
                className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
              >
                {lang === "bn" ? "← সব রিপোর্ট প্রদর্শন করুন" : "← View All Reports"}
              </Link>

              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-semibold disabled:opacity-40 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition"
                  >
                    ← Previous
                  </button>
                  <span className="text-xs text-zinc-500 px-2 font-medium">
                    Page {page + 1} of {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage((p) => p + 1)}
                    className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-semibold disabled:opacity-40 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition"
                  >
                    Next →
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        {/* =================================================================== */}
        {/* 4. PLATFORM TRANSPARENCY PREVIEW: Dynamic Real Metrics             */}
        {/* =================================================================== */}
        <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-8 shadow-2xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 text-sm">
                  📊
                </span>
                <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
                  {lang === "bn" ? t.transparency_title : "Platform Transparency & Analytics"}
                </h2>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                {lang === "bn"
                  ? "প্ল্যাটফর্মের মডারেশন টিম কর্তৃক যাচাইকৃত তথ্যের সামগ্রিক চিত্র।"
                  : "Dynamic metrics calculated strictly from platform-reviewed citizen submissions."}
              </p>
            </div>

            <Link
              href="/transparency"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 hover:bg-blue-100 transition text-xs font-bold shrink-0 self-start sm:self-auto"
            >
              <span>{lang === "bn" ? "পূর্ণাঙ্গ ড্যাশবোর্ড" : "Full Analytics"}</span>
              <span>→</span>
            </Link>
          </div>

          {/* Dynamic Metric KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div className="rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-800/40 p-4 space-y-1">
              <p className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                {lang === "bn" ? t.kpi_total_reports : "Total Reviewed Reports"}
              </p>
              <p className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
                {kpis ? kpis.total_reviewed_reports.toLocaleString() : "—"}
              </p>
              <p className="text-[10px] text-emerald-600 font-medium pt-0.5">
                ✓ 100% Verified by Moderation
              </p>
            </div>

            <div className="rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-800/40 p-4 space-y-1">
              <p className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                {lang === "bn" ? t.kpi_this_month : "Reviewed This Month"}
              </p>
              <p className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
                {kpis ? kpis.reports_this_month.toLocaleString() : "—"}
              </p>
              <p className="text-[10px] text-zinc-400 font-medium pt-0.5">
                Current calendar month
              </p>
            </div>

            <div className="rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-800/40 p-4 space-y-1">
              <p className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                {lang === "bn" ? t.kpi_this_year : "Reviewed This Year"}
              </p>
              <p className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
                {kpis ? kpis.reports_this_year.toLocaleString() : "—"}
              </p>
              <p className="text-[10px] text-zinc-400 font-medium pt-0.5">
                Annual civic activity
              </p>
            </div>

            <div className="rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-800/40 p-4 space-y-1">
              <p className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                {lang === "bn" ? t.kpi_active_missing : "Active Missing Alerts"}
              </p>
              <p className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 tracking-tight">
                {kpis ? kpis.active_missing_alerts.toLocaleString() : "—"}
              </p>
              <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium pt-0.5">
                Search in progress
              </p>
            </div>
          </div>

          {/* Legal / Trust Disclaimer */}
          <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/50 p-3.5 border border-zinc-200/80 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed flex items-start gap-2.5">
            <span className="shrink-0 text-sm">🔒</span>
            <p>
              {lang === "bn"
                ? t.transparency_disclaimer
                : "These figures represent platform-reviewed citizen reports and are not official government crime statistics or proof that reported incidents occurred as alleged."}
            </p>
          </div>
        </section>

        {/* =================================================================== */}
        {/* 5. ACTIVE MISSING PERSON HIGHLIGHT: Real Alerts Preview             */}
        {/* =================================================================== */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 text-sm">
                  🔍
                </span>
                <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
                  {lang === "bn" ? "সক্রিয় নিখোঁজ ব্যক্তি অ্যালার্ট" : "Active Missing Person Alerts"}
                </h2>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                {lang === "bn"
                  ? "নিখোঁজদের সন্ধান পেতে এবং পরিবারের পাশে দাঁড়াতে সহায়তামূলক তথ্য দিন।"
                  : "Help families and authorities locate missing individuals safely across Bangladesh."}
              </p>
            </div>

            <Link
              href="/missing-person"
              className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 dark:text-amber-400 hover:underline shrink-0"
            >
              <span>{lang === "bn" ? "সকল নিখোঁজ অ্যালার্ট দেখুন" : "View All Alerts"}</span>
              <span>→</span>
            </Link>
          </div>

          {missingLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-3 animate-pulse"
                >
                  <div className="h-32 bg-zinc-200 dark:bg-zinc-800 rounded-lg w-full" />
                  <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-2/3" />
                  <div className="h-3 bg-zinc-100 dark:bg-zinc-800/50 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : missingAlerts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 text-center space-y-2">
              <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                {lang === "bn"
                  ? "বর্তমানে কোনো সক্রিয় নিখোঁজ ব্যক্তি সতর্কতা নেই।"
                  : "No active missing person alerts at this moment."}
              </p>
              <p className="text-xs text-zinc-400">
                {lang === "bn"
                  ? "আপনার পরিচিত কেউ নিখোঁজ হলে অবিলম্বে রিপোর্ট জমা দিন।"
                  : "If someone you know is missing, you can submit a verified alert to activate the community network."}
              </p>
              <div className="pt-2">
                <Link
                  href="/missing-person/create"
                  className="inline-block px-3.5 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-bold hover:bg-amber-500 transition"
                >
                  {lang === "bn" ? "নিখোঁজ ব্যক্তির তথ্য দিন" : "Submit Missing Alert"}
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {missingAlerts.map((alert) => (
                <Link
                  key={alert.id}
                  href={`/missing-person/${alert.id}`}
                  className="group rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs hover:border-amber-500/40 hover:shadow-xs transition overflow-hidden flex flex-col justify-between"
                >
                  <div>
                    {/* Alert Photo */}
                    <div className="relative aspect-4/3 w-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={getFullUrl(alert.profile.photo_url || undefined)}
                        alt={alert.profile.full_name}
                        className="h-full w-full object-cover group-hover:scale-102 transition duration-200"
                        loading="lazy"
                      />
                      <div className="absolute top-2.5 left-2.5">
                        <StatusBadge status={alert.status} lang={lang} size="sm" />
                      </div>
                    </div>

                    {/* Profile Information */}
                    <div className="p-4 space-y-1.5">
                      <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 group-hover:text-amber-600 transition truncate">
                        {alert.profile.full_name}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                        {alert.profile.age && <span>Age: {alert.profile.age}</span>}
                        {alert.profile.gender && <span>• {alert.profile.gender}</span>}
                      </div>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate pt-1">
                        📍 {alert.profile.last_seen_location}
                      </p>
                    </div>
                  </div>

                  <div className="p-4 pt-0 border-t border-zinc-100 dark:border-zinc-800/80 mt-2">
                    <span className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center justify-between pt-2">
                      <span>{lang === "bn" ? "আমি এই ব্যক্তিকে দেখেছি" : "I Saw This Person"}</span>
                      <span>→</span>
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* =================================================================== */}
        {/* 6. HOW IT WORKS & TRUST & SAFETY PIPELINE                          */}
        {/* =================================================================== */}
        <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-10 shadow-2xs space-y-8">
          <div className="text-center max-w-xl mx-auto space-y-1.5">
            <h2 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
              {lang === "bn" ? "প্ল্যাটফর্মটি যেভাবে কাজ করে" : "How the Platform Works"}
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {lang === "bn"
                ? "নাগরিক রিপোর্ট থেকে সরকারি সমন্বয় ও জনসুরক্ষা নিশ্চিতকরণ।"
                : "From citizen submission to verified community safety awareness."}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/50 p-4 space-y-2 border border-zinc-100 dark:border-zinc-800">
              <span className="text-xs font-black text-emerald-700 dark:text-emerald-400">01</span>
              <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                {lang === "bn" ? "রিপোর্ট জমা" : "Report"}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                {lang === "bn"
                  ? "ছবি বা ডকুমেন্টসহ সমস্যা রিপোর্ট করুন। নাম প্রকাশ না করে গোপনীয়ভাবে রিপোর্ট সম্ভব।"
                  : "Citizens submit civic hazards or alerts with verifiable photos. Anonymous reporting protects privacy."}
              </p>
            </div>

            <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/50 p-4 space-y-2 border border-zinc-100 dark:border-zinc-800">
              <span className="text-xs font-black text-blue-600 dark:text-blue-400">02</span>
              <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                {lang === "bn" ? "মডারেশন যাচাই" : "Review"}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                {lang === "bn"
                  ? "অনুমোদিত মডারেটর টিম প্রমাণের সত্যতা ও অবস্থান যাচাই করে ভূয়া রিপোর্ট প্রতিহত করেন।"
                  : "Authorized moderators review media authenticity and check for duplicates or false information."}
              </p>
            </div>

            <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/50 p-4 space-y-2 border border-zinc-100 dark:border-zinc-800">
              <span className="text-xs font-black text-amber-600 dark:text-amber-400">03</span>
              <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                {lang === "bn" ? "কমিউনিটি প্রকাশ" : "Community"}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                {lang === "bn"
                  ? "অনুমোদিত রিপোর্টগুলো গোপনীয়তা বজায় রেখে আনুমানিক স্থানাঙ্কে মানচিত্রে প্রকাশিত হয়।"
                  : "Approved information appears on the public feed and map with privacy-sanitized approximate locations."}
              </p>
            </div>

            <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/50 p-4 space-y-2 border border-zinc-100 dark:border-zinc-800">
              <span className="text-xs font-black text-purple-600 dark:text-purple-400">04</span>
              <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                {lang === "bn" ? "সুরক্ষা ও স্বচ্ছতা" : "Understand"}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                {lang === "bn"
                  ? "স্বচ্ছতা ড্যাশবোর্ড ও ক্রাইম অ্যানালিটিক্সের মাধ্যমে এলাকার নিরাপত্তা পরিস্থিতি বুঝুন।"
                  : "Explore safety trends, verified directory contacts, and civic transparency dashboards."}
              </p>
            </div>
          </div>

          {/* Trust & Safety Assurance Badges */}
          <div className="border-t border-zinc-100 dark:border-zinc-800 pt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            <div className="space-y-1">
              <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                🛡️ 100% Privacy Protection
              </p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Exact residential coordinates and private identities are never exposed publicly.
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                👁️ Moderated Verification
              </p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                All submissions undergo checks to eliminate spam, hoaxes, and personal harassment.
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                🏛️ Civic Authority Integration
              </p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Direct integration with verified national directory numbers (999, 109, 333).
              </p>
            </div>
          </div>
        </section>

        {/* =================================================================== */}
        {/* 7. EMERGENCY CTA SECTION: 999 Hotline Support                      */}
        {/* =================================================================== */}
        <section className="rounded-2xl border border-red-200 dark:border-red-950/80 bg-red-50/60 dark:bg-red-950/20 p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-2xs">
          <div className="flex items-center gap-4 text-center sm:text-left">
            <div className="h-12 w-12 rounded-xl bg-red-600 text-white flex items-center justify-center text-2xl shrink-0 shadow-2xs mx-auto sm:mx-0">
              🚨
            </div>
            <div className="space-y-1">
              <h3 className="text-base sm:text-lg font-black text-red-950 dark:text-red-100 leading-tight">
                {lang === "bn" ? "জরুরি সাহায্য প্রয়োজন?" : "Need Immediate Emergency Assistance?"}
              </h3>
              <p className="text-xs text-red-800 dark:text-red-300 leading-relaxed">
                {lang === "bn"
                  ? "পুলিশ, ফায়ার সার্ভিস বা অ্যাম্বুলেন্সের জন্য জাতীয় জরুরি সেবা ৯৯৯ নম্বরে বিনামূল্যে কল করুন।"
                  : "Call National Emergency Service 999 24/7 toll-free for Police, Fire Service, and Ambulance."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <a
              href="tel:999"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-xs font-bold shadow-2xs transition"
            >
              <span>📞</span>
              <span>{lang === "bn" ? "কল ৯৯৯" : "Call 999"}</span>
            </a>
            <Link
              href="/safety"
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg border border-red-300 dark:border-red-900 bg-white dark:bg-zinc-900 text-red-700 dark:text-red-300 text-xs font-bold hover:bg-red-50 dark:hover:bg-red-950/40 transition"
            >
              <span>{lang === "bn" ? "কাছাকাছি সেবা খুঁজুন" : "Find Units Near Me"}</span>
              <span>→</span>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
