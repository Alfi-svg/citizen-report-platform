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
  BloodRequestPagination,
  PublicBloodRequest,
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

  // 1. Categories
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

  // 5. Emergency Blood Requests Preview
  const [bloodRequests, setBloodRequests] = useState<PublicBloodRequest[]>([]);
  const [bloodLoading, setBloodLoading] = useState<boolean>(true);

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

  // Fetch Emergency Blood Requests Preview
  useEffect(() => {
    let isMounted = true;
    setBloodLoading(true);
    apiFetch<BloodRequestPagination>("/blood/requests?limit=3")
      .then((res) => {
        if (isMounted) {
          setBloodRequests(res.items || []);
        }
      })
      .catch(() => {
        if (isMounted) setBloodRequests([]);
      })
      .finally(() => {
        if (isMounted) setBloodLoading(false);
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

  const clearAllFilters = () => {
    setSelectedCategory("");
    setSearchQuery("");
    setActiveSearch("");
    setLocationQuery("");
    setActiveLocation("");
    setSortOrder("latest");
    setPage(0);
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
    <div className="space-y-10 sm:space-y-14 pb-12">
      {/* =================================================================== */}
      {/* 1. SIMPLIFIED HERO SECTION (Focused, Calm, Single Dominant CTA)     */}
      {/* =================================================================== */}
      <section className="relative overflow-hidden bg-zinc-950 text-white">
        {/* Subtle Background Overlay */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/brand/bangladesh-hero-bg.jpg"
            alt="Bangladesh National Monument"
            fill
            className="object-cover object-center opacity-30"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/85 to-zinc-950/70" />
        </div>

        {/* Hero Content */}
        <div className="relative z-10 mx-auto max-w-4xl px-4 py-12 sm:py-18 text-center space-y-4">
          {/* Trust Pill */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 backdrop-blur-xs">
            <span>🛡️</span>
            <span>
              {lang === "bn"
                ? "যাচাইকৃত নাগরিক সুরক্ষা ও রিপোর্টিং নেটওয়ার্ক"
                : "Verified Citizen Safety & Incident Network • Bangladesh"}
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight max-w-3xl mx-auto leading-tight">
            {lang === "bn"
              ? "নিরাপদ বাংলাদেশ গড়ার নির্ভরযোগ্য নাগরিক প্ল্যাটফর্ম"
              : "Empowering Bangladesh with Verified Civic Reporting & Safety"}
          </h1>

          {/* Subtitle */}
          <p className="text-xs sm:text-sm text-zinc-300 max-w-2xl mx-auto leading-relaxed">
            {lang === "bn"
              ? "নাগরিক সমস্যা নিরাপদে রিপোর্ট করুন, জরুরি সেবা খুঁজুন, রক্ত সহায়তায় পাশে দাঁড়ান এবং নিখোঁজদের সন্ধানে অংশ নিন।"
              : "Report civic hazards safely with photo evidence, access emergency 999 services, connect with blood donors, and support verified missing person searches."}
          </p>

          {/* Dominant Primary Action vs Subtle Secondary Action */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/reports/create"
              className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 text-xs sm:text-sm font-bold shadow-md shadow-emerald-700/20 transition active:scale-95 flex items-center gap-2"
            >
              <span className="text-base font-bold">+</span>
              <span>{lang === "bn" ? "নতুন ঘটনা রিপোর্ট করুন" : "Report an Incident"}</span>
            </Link>

            <Link
              href="/safety"
              className="rounded-xl border border-zinc-700 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-200 px-5 py-3 text-xs sm:text-sm font-semibold transition backdrop-blur-xs flex items-center gap-2"
            >
              <span>🚨</span>
              <span>{lang === "bn" ? "জরুরি সেবা ও ৯৯৯" : "Find Emergency Help"}</span>
            </Link>
          </div>

          {/* Trust Guarantee Strip */}
          <div className="pt-3 text-[11px] text-zinc-400 flex flex-wrap items-center justify-center gap-4">
            <span className="inline-flex items-center gap-1">
              <span>🔒</span>
              <span>{lang === "bn" ? "১০০% বেনামী রিপোর্টিং সুবিধা" : "100% Anonymous Option"}</span>
            </span>
            <span className="text-zinc-600">•</span>
            <span className="inline-flex items-center gap-1">
              <span>✓</span>
              <span>{lang === "bn" ? "মডারেটর কর্তৃক যাচাইকৃত" : "Moderator-Reviewed Data"}</span>
            </span>
            <span className="text-zinc-600">•</span>
            <span className="inline-flex items-center gap-1">
              <span>📞</span>
              <span>{lang === "bn" ? "টোল-ফ্রি জাতীয় ৯৯৯ হটলাইন" : "24/7 National 999 Linkage"}</span>
            </span>
          </div>

          {/* Logged in state info */}
          {isAuthenticated && user && (
            <p className="text-xs text-zinc-400 pt-1">
              {lang === "bn" ? "স্বাগতম, " : "Logged in as "}
              <span className="text-zinc-200 font-bold">{user.full_name || user.username}</span>
              {" • "}
              <Link href="/dashboard" className="text-emerald-400 hover:underline">
                {lang === "bn" ? "ড্যাশবোর্ড খুলুন →" : "Open Citizen Dashboard →"}
              </Link>
            </p>
          )}
        </div>
      </section>

      {/* Main Container */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
        {/* =================================================================== */}
        {/* 2. THE FOUR CIVIC PILLARS (Clean Gateway - No Colorful Card Noise)  */}
        {/* =================================================================== */}
        <section aria-label="Core Civic Capabilities">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Pillar 1: REPORT */}
            <Link
              href="/reports"
              className="group rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 hover:border-emerald-600 dark:hover:border-emerald-500 transition shadow-2xs flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xl">📋</span>
                  <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                    {lang === "bn" ? "১. রিপোর্ট" : "1. Report"}
                  </span>
                </div>
                <h2 className="font-bold text-sm sm:text-base text-zinc-900 dark:text-zinc-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition">
                  {lang === "bn" ? "নাগরিক রিপোর্ট ফিড" : "Report Something"}
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  {lang === "bn"
                    ? "রাস্তাঘাট, দুর্ঘটনা বা সামাজিক সমস্যার রিপোর্ট জমা দিন ও অগ্রগতি ট্র্যাক করুন।"
                    : "Submit civic hazards with photo evidence and track resolution progress."}
                </p>
              </div>
              <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/80 mt-3 text-xs font-bold text-zinc-700 dark:text-zinc-300 group-hover:text-emerald-700 flex items-center justify-between">
                <span>{lang === "bn" ? "রিপোর্ট দেখুন" : "Browse Reports"}</span>
                <span>→</span>
              </div>
            </Link>

            {/* Pillar 2: PROTECT */}
            <Link
              href="/safety"
              className="group rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 hover:border-red-600 dark:hover:border-red-500 transition shadow-2xs flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xl">🛡️</span>
                  <span className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">
                    {lang === "bn" ? "২. সুরক্ষা" : "2. Protect"}
                  </span>
                </div>
                <h2 className="font-bold text-sm sm:text-base text-zinc-900 dark:text-zinc-100 group-hover:text-red-600 transition">
                  {lang === "bn" ? "জরুরি সুরক্ষা কেন্দ্র" : "Find Emergency Help"}
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  {lang === "bn"
                    ? "৯৯৯ হটলাইন, নিকটস্থ থানা, পুলিশ বক্স এবং ইন্টারেক্টিভ সুরক্ষা ম্যাপ।"
                    : "Instant 999 hotline, verified nearby police units, and safety maps."}
                </p>
              </div>
              <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/80 mt-3 text-xs font-bold text-zinc-700 dark:text-zinc-300 group-hover:text-red-600 flex items-center justify-between">
                <span>{lang === "bn" ? "সেবা খুঁজুন" : "Find Help Near Me"}</span>
                <span>→</span>
              </div>
            </Link>

            {/* Pillar 3: HELP */}
            <Link
              href="/blood-help"
              className="group rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 hover:border-rose-600 dark:hover:border-rose-500 transition shadow-2xs flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xl">🤝</span>
                  <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
                    {lang === "bn" ? "৩. সহায়তা" : "3. Help"}
                  </span>
                </div>
                <h2 className="font-bold text-sm sm:text-base text-zinc-900 dark:text-zinc-100 group-hover:text-rose-600 transition">
                  {lang === "bn" ? "কমিউনিটি সহায়তা" : "Help the Community"}
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  {lang === "bn"
                    ? "রক্তের প্রয়োজনে এগিয়ে আসুন অথবা নিখোঁজ ব্যক্তির সন্ধানে তথ্য দিয়ে সাহায্য করুন।"
                    : "Volunteer as a blood donor or support active missing person searches."}
                </p>
              </div>
              <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/80 mt-3 text-xs font-bold text-zinc-700 dark:text-zinc-300 group-hover:text-rose-600 flex items-center justify-between">
                <span>{lang === "bn" ? "সহায়তা নেটওয়ার্ক" : "Explore Help Hub"}</span>
                <span>→</span>
              </div>
            </Link>

            {/* Pillar 4: UNDERSTAND */}
            <Link
              href="/transparency"
              className="group rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 hover:border-blue-600 dark:hover:border-blue-500 transition shadow-2xs flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xl">📊</span>
                  <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                    {lang === "bn" ? "৪. বিশ্লেষণ" : "4. Understand"}
                  </span>
                </div>
                <h2 className="font-bold text-sm sm:text-base text-zinc-900 dark:text-zinc-100 group-hover:text-blue-600 transition">
                  {lang === "bn" ? "স্বচ্ছতা ও অ্যানালিটিক্স" : "Understand Trends"}
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  {lang === "bn"
                    ? "যাচাইকৃত রিপোর্ট ট্রেন্ড, মাসিক পরিসংখ্যান ও জেলাভিত্তিক সমাধানের হার।"
                    : "Verified incident metrics, moderation trends, and district resolution rates."}
                </p>
              </div>
              <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/80 mt-3 text-xs font-bold text-zinc-700 dark:text-zinc-300 group-hover:text-blue-600 flex items-center justify-between">
                <span>{lang === "bn" ? "তথ্য দেখুন" : "View Analytics"}</span>
                <span>→</span>
              </div>
            </Link>
          </div>
        </section>

        {/* =================================================================== */}
        {/* 3. VERIFIED INCIDENT FEED (Streamlined, Clear Filter Bar)          */}
        {/* =================================================================== */}
        <section className="space-y-6" aria-label="Incident Reports Feed">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 border-b border-zinc-200/80 dark:border-zinc-800 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse" />
                <h2 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
                  {lang === "bn" ? "যাচাইকৃত নাগরিক ফিড" : "Verified Incident Feed"}
                </h2>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                {lang === "bn"
                  ? "অনুমোদিত নাগরিক রিপোর্ট ও পর্যবেক্ষণসমূহ।"
                  : "Public reports reviewed by authorized moderators across Bangladesh."}
              </p>
            </div>

            {/* Sort Order Tabs & View All */}
            <div className="flex items-center gap-3">
              <div className="inline-flex rounded-xl bg-zinc-100 dark:bg-zinc-800 p-1 border border-zinc-200 dark:border-zinc-700">
                <button
                  type="button"
                  onClick={() => {
                    setSortOrder("latest");
                    setPage(0);
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                    sortOrder === "latest"
                      ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs"
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
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                    sortOrder === "trending"
                      ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs"
                      : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400"
                  }`}
                >
                  {lang === "bn" ? "আলোচিত" : "Trending"}
                </button>
              </div>

              <Link
                href="/reports"
                className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline hidden sm:inline"
              >
                {lang === "bn" ? "সকল রিপোর্ট →" : "View All Reports →"}
              </Link>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <form
            onSubmit={handleSearchSubmit}
            className="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-white dark:bg-zinc-900 p-2.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xs"
          >
            <div className="sm:col-span-6">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  lang === "bn"
                    ? "রিপোর্ট, স্থান বা ঘটনার বিবরণ দিয়ে খুঁজুন..."
                    : "Search reports, places, keywords..."
                }
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 px-3.5 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
            </div>
            <div className="sm:col-span-4">
              <input
                type="text"
                value={locationQuery}
                onChange={(e) => setLocationQuery(e.target.value)}
                placeholder={
                  lang === "bn" ? "জেলা বা এলাকা (যেমন: ঢাকা, সিলেট)..." : "District or Area (e.g. Dhaka, Sylhet)..."
                }
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 px-3.5 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
            </div>
            <div className="sm:col-span-2 flex gap-1.5">
              <button
                type="submit"
                className="flex-1 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold px-3 py-2 transition"
              >
                Search
              </button>
              {(activeSearch || activeLocation || selectedCategory) && (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="rounded-xl border border-zinc-200 dark:border-zinc-700 px-2.5 text-xs text-zinc-500 hover:bg-zinc-100"
                  title="Reset"
                >
                  ✕
                </button>
              )}
            </div>
          </form>

          {/* Category Chips Bar */}
          {categories.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory("");
                  setPage(0);
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                  selectedCategory === ""
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 font-bold"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200"
                }`}
              >
                {lang === "bn" ? "সকল ধরন" : "All Types"}
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(cat.id);
                    setPage(0);
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                    selectedCategory === cat.id
                      ? "bg-emerald-700 text-white font-bold"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}

          {/* Reports Grid */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-3 animate-pulse"
                >
                  <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-1/3" />
                  <div className="h-5 bg-zinc-200 dark:bg-zinc-800 rounded w-3/4" />
                  <div className="h-24 bg-zinc-100 dark:bg-zinc-800/50 rounded w-full" />
                  <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 p-6 text-center">
              <p className="text-sm font-semibold text-red-800 dark:text-red-300 mb-3">{error}</p>
              <button
                onClick={() => setPage(0)}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-500 transition"
              >
                {lang === "bn" ? "পুনরায় চেষ্টা করুন" : "Retry"}
              </button>
            </div>
          ) : !data || data.items.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-12 text-center space-y-3">
              <div className="text-3xl">📋</div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                {lang === "bn" ? "কোনো রিপোর্ট পাওয়া যায়নি" : "No Reports Found"}
              </h3>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                {lang === "bn"
                  ? "আপনার ফিল্টারের সাথে সামঞ্জস্যপূর্ণ কোনো রিপোর্ট নেই।"
                  : "No approved reports match your current filter."}
              </p>
              <button
                type="button"
                onClick={clearAllFilters}
                className="rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-1.5 text-xs font-bold hover:bg-zinc-50 transition"
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {data.items.map((report) => (
                <PublicReportCard key={report.id} report={report} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {data && totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-semibold disabled:opacity-40 hover:bg-zinc-50 transition"
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
                className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-semibold disabled:opacity-40 hover:bg-zinc-50 transition"
              >
                Next →
              </button>
            </div>
          )}
        </section>

        {/* =================================================================== */}
        {/* 4. COMMUNITY URGENT NEEDS (Missing Persons & Blood Requests)        */}
        {/* =================================================================== */}
        <section className="space-y-6" aria-label="Community Action & Support">
          <div className="border-b border-zinc-200/80 dark:border-zinc-800 pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight flex items-center gap-2">
                <span>🤝</span>
                <span>{lang === "bn" ? "কমিউনিটি জরুরি প্রয়োজন" : "Community Urgent Needs"}</span>
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                {lang === "bn"
                  ? "জরুরি রক্তের আবেদন এবং নিখোঁজদের সন্ধানে আপনার প্রত্যক্ষ সহায়তা জীবন বাঁচাতে পারে।"
                  : "Respond directly to emergency blood requests or report verified missing person sightings."}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column: Missing Persons Search */}
            <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6 shadow-2xs space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🔍</span>
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                      {lang === "bn" ? "সক্রিয় নিখোঁজ ব্যক্তি অনুসন্ধান" : "Active Missing Person Alerts"}
                    </h3>
                  </div>
                  <Link
                    href="/missing-person"
                    className="text-xs font-bold text-amber-700 dark:text-amber-400 hover:underline"
                  >
                    View All ({missingAlerts.length}) →
                  </Link>
                </div>

                {missingLoading ? (
                  <div className="py-8 text-center text-xs text-zinc-400">Loading alerts...</div>
                ) : missingAlerts.length === 0 ? (
                  <div className="py-8 text-center text-xs text-zinc-400">
                    No active missing person alerts.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {missingAlerts.slice(0, 2).map((alert) => (
                      <Link
                        key={alert.id}
                        href={`/missing-person/${alert.id}`}
                        className="flex items-center gap-3 p-3 rounded-2xl border border-zinc-100 dark:border-zinc-800 hover:border-amber-400 dark:hover:border-amber-700 transition group"
                      >
                        <div className="h-14 w-14 rounded-xl bg-zinc-100 dark:bg-zinc-800 overflow-hidden relative shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={getFullUrl(alert.profile.photo_url || undefined)}
                            alt={alert.profile.full_name}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-100 group-hover:text-amber-600 truncate">
                            {alert.profile.full_name}
                          </h4>
                          <p className="text-[11px] text-zinc-400 truncate">
                            📍 {alert.profile.last_seen_location}
                          </p>
                          <span className="text-[10px] text-amber-700 dark:text-amber-400 font-bold block mt-0.5">
                            I Saw This Person →
                          </span>
                        </div>
                        <StatusBadge status={alert.status} lang={lang} size="sm" />
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              <Link
                href="/missing-person/create"
                className="w-full text-center py-2.5 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 text-xs font-bold hover:bg-amber-100 transition block"
              >
                {lang === "bn" ? "+ নিখোঁজ ব্যক্তির তথ্য জমা দিন" : "+ Submit Missing Person Alert"}
              </Link>
            </div>

            {/* Right Column: Emergency Blood Requests */}
            <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6 shadow-2xs space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🩸</span>
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                      {lang === "bn" ? "জরুরি রক্ত সহায়তা" : "Emergency Blood Requests"}
                    </h3>
                  </div>
                  <Link
                    href="/blood-help"
                    className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline"
                  >
                    View All ({bloodRequests.length}) →
                  </Link>
                </div>

                {bloodLoading ? (
                  <div className="py-8 text-center text-xs text-zinc-400">Loading blood requests...</div>
                ) : bloodRequests.length === 0 ? (
                  <div className="py-8 text-center text-xs text-zinc-400">
                    No active blood requests at this moment.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {bloodRequests.slice(0, 2).map((req) => (
                      <Link
                        key={req.id}
                        href={`/blood-help/${req.id}`}
                        className="flex items-center justify-between gap-3 p-3 rounded-2xl border border-zinc-100 dark:border-zinc-800 hover:border-rose-400 dark:hover:border-rose-700 transition group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-600 text-white font-black text-sm">
                            {req.blood_group}
                          </span>
                          <div className="min-w-0">
                            <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-100 group-hover:text-rose-600 truncate">
                              {req.hospital_name}
                            </h4>
                            <p className="text-[11px] text-zinc-400 truncate">
                              📍 {req.hospital_area}, {req.district}
                            </p>
                          </div>
                        </div>

                        <span className="shrink-0 px-3 py-1 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-bold">
                          I Can Help →
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Link
                  href="/blood-help/request"
                  className="flex-1 text-center py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition block shadow-2xs"
                >
                  {lang === "bn" ? "রক্ত প্রয়োজন (পোস্ট)" : "Need Blood"}
                </Link>
                <Link
                  href="/blood-help"
                  className="flex-1 text-center py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-bold transition block"
                >
                  {lang === "bn" ? "রক্তদাতা নেটওয়ার্ক" : "Volunteer as Donor"}
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* =================================================================== */}
        {/* 5. TRANSPARENCY & CIVIC TRUST METRICS (Clean Strip, No Heavy Cards) */}
        {/* =================================================================== */}
        <section className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-8 shadow-2xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight flex items-center gap-2">
                <span>📊</span>
                <span>{lang === "bn" ? t.transparency_title : "Platform Transparency & Analytics"}</span>
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                {lang === "bn"
                  ? "মডারেশন টিম কর্তৃক কঠোরভাবে নিরীক্ষিত তথ্যের নির্ভরযোগ্য সারাংশ।"
                  : "Live metrics generated strictly from moderator-reviewed citizen submissions."}
              </p>
            </div>

            <Link
              href="/transparency"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 hover:bg-blue-100 transition text-xs font-bold shrink-0 self-start sm:self-auto"
            >
              <span>{lang === "bn" ? "পূর্ণাঙ্গ ড্যাশবোর্ড" : "Full Analytics"}</span>
              <span>→</span>
            </Link>
          </div>

          {/* Clean 4-Stat Strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 divide-y md:divide-y-0 md:divide-x divide-zinc-100 dark:divide-zinc-800 pt-2">
            <div className="space-y-1 pt-2 md:pt-0 md:pr-4">
              <p className="text-[11px] font-semibold text-zinc-400">
                {lang === "bn" ? t.kpi_total_reports : "Total Reviewed Reports"}
              </p>
              <p className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-zinc-100">
                {kpis ? kpis.total_reviewed_reports.toLocaleString() : "—"}
              </p>
              <p className="text-[10px] text-emerald-600 font-semibold">100% Moderated</p>
            </div>

            <div className="space-y-1 pt-2 md:pt-0 md:px-4">
              <p className="text-[11px] font-semibold text-zinc-400">
                {lang === "bn" ? t.kpi_this_month : "Reviewed This Month"}
              </p>
              <p className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-zinc-100">
                {kpis ? kpis.reports_this_month.toLocaleString() : "—"}
              </p>
              <p className="text-[10px] text-zinc-400">Current calendar month</p>
            </div>

            <div className="space-y-1 pt-2 md:pt-0 md:px-4">
              <p className="text-[11px] font-semibold text-zinc-400">
                {lang === "bn" ? t.kpi_this_year : "Reviewed This Year"}
              </p>
              <p className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-zinc-100">
                {kpis ? kpis.reports_this_year.toLocaleString() : "—"}
              </p>
              <p className="text-[10px] text-zinc-400">Annual civic record</p>
            </div>

            <div className="space-y-1 pt-2 md:pt-0 md:pl-4">
              <p className="text-[11px] font-semibold text-zinc-400">
                {lang === "bn" ? t.kpi_active_missing : "Active Missing Alerts"}
              </p>
              <p className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400">
                {kpis ? kpis.active_missing_alerts.toLocaleString() : "—"}
              </p>
              <p className="text-[10px] text-amber-600">Active searches</p>
            </div>
          </div>

          {/* Legal / Trust Note */}
          <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-850 p-3.5 border border-zinc-200/60 dark:border-zinc-800 text-xs text-zinc-500 leading-relaxed flex items-center gap-2.5">
            <span className="text-sm">🔒</span>
            <p>
              {lang === "bn"
                ? t.transparency_disclaimer
                : "These figures represent platform-reviewed citizen reports and are not official government crime statistics."}
            </p>
          </div>
        </section>

        {/* =================================================================== */}
        {/* 6. EMERGENCY 999 SECTION (Calm, High-Trust Hotline Banner)         */}
        {/* =================================================================== */}
        <section className="rounded-3xl border border-red-200/80 dark:border-red-950/80 bg-red-50/40 dark:bg-red-950/20 p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-2xs">
          <div className="flex items-center gap-4 text-center sm:text-left">
            <div className="h-12 w-12 rounded-2xl bg-red-600 text-white flex items-center justify-center text-2xl shrink-0 shadow-2xs mx-auto sm:mx-0">
              🚨
            </div>
            <div className="space-y-1">
              <h3 className="text-base sm:text-lg font-black text-red-950 dark:text-red-100 leading-tight">
                {lang === "bn" ? "জরুরি সাহায্য প্রয়োজন?" : "Need Immediate Emergency Assistance?"}
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
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-2xs transition"
            >
              <span>📞</span>
              <span>{lang === "bn" ? "কল ৯৯৯" : "Call 999"}</span>
            </a>
            <Link
              href="/safety"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-red-300 dark:border-red-900 bg-white dark:bg-zinc-900 text-red-700 dark:text-red-300 text-xs font-bold hover:bg-red-50 dark:hover:bg-red-950/40 transition"
            >
              <span>{lang === "bn" ? "নিকটস্থ সেবা খুঁজুন" : "Find Units Near Me"}</span>
              <span>→</span>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
