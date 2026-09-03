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
    <div className="space-y-10 sm:space-y-12 pb-12">
      {/* =================================================================== */}
      {/* 1. HERO SECTION (Matching User Reference media_1788378720889.png)   */}
      {/* =================================================================== */}
      <section className="relative overflow-hidden bg-zinc-950 text-white">
        {/* Background Image with Dark Emerald Overlay */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/brand/bangladesh-hero-bg.jpg"
            alt="Bangladesh National Monument and Heritage"
            fill
            className="object-cover object-center opacity-35"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-emerald-950/70" />
        </div>

        {/* Hero Content */}
        <div className="relative z-10 mx-auto max-w-5xl px-4 py-12 sm:py-20 text-center space-y-5">
          {/* Trust Pill */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 backdrop-blur-xs">
            <span>🛡️</span>
            <span>
              {lang === "bn"
                ? "যাচাইকৃত নাগরিক রিপোর্টিং নেটওয়ার্ক • বাংলাদেশ"
                : "Platform-Verified Citizen Reporting • বাংলাদেশ"}
            </span>
          </div>

          {/* White Card Emblem Frame */}
          <div className="mx-auto h-16 w-16 sm:h-20 sm:w-20 relative rounded-2xl overflow-hidden shadow-xl border-2 border-emerald-500/40 bg-white p-1">
            <Image
              src="/brand/logo-sm.jpg"
              alt="Bangladesh Citizen Report Emblem"
              fill
              className="object-contain p-1"
              priority
            />
          </div>

          {/* Headline */}
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight max-w-3xl mx-auto leading-tight">
            {lang === "bn"
              ? "বাংলাদেশ সিটিজেন ইনসিডেন্ট অ্যান্ড সেফটি নেটওয়ার্ক"
              : "Bangladesh Citizen Incident & Safety Network"}
          </h1>

          {/* Subtitle */}
          <p className="text-sm sm:text-base text-zinc-300 max-w-2xl mx-auto leading-relaxed">
            {lang === "bn"
              ? "নাগরিক সমস্যা ও দুর্ঘটনা রিপোর্ট করুন, জরুরি সেবা খুঁজুন এবং গোপনীয়তা বজায় রেখে নিখোঁজদের সন্ধানে তথ্য দিন।"
              : "Report civic hazards, track community alerts, find nearby emergency services, and support verified missing person searches with privacy protection across Bangladesh."}
          </p>

          {/* CTA Buttons */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/reports/create"
              className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 text-xs sm:text-sm font-bold shadow-lg shadow-emerald-700/30 transition active:scale-95 flex items-center gap-2"
            >
              <span>+</span>
              <span>{lang === "bn" ? "রিপোর্ট করুন" : "Report an Incident"}</span>
            </Link>

            <Link
              href="/safety"
              className="rounded-xl bg-red-600 hover:bg-red-500 text-white px-5 py-3 text-xs sm:text-sm font-bold shadow-lg shadow-red-700/30 transition active:scale-95 flex items-center gap-2"
            >
              <span>🚨</span>
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

          {/* Logged in state */}
          {isAuthenticated && user && (
            <p className="text-xs text-zinc-400 pt-2">
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
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-10 sm:space-y-14">
        {/* =================================================================== */}
        {/* 2. CIVIC QUICK ACTIONS (Matching media_1788378720889.png)          */}
        {/* =================================================================== */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <Link
            href="/safety"
            className="group rounded-2xl border border-red-950/60 bg-red-950/20 p-4 hover:border-red-400/80 transition"
          >
            <div className="h-9 w-9 rounded-xl bg-red-600 text-white flex items-center justify-center text-lg mb-2 group-hover:scale-105 transition shadow-2xs">
              🚨
            </div>
            <h2 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 leading-tight">
              {lang === "bn" ? "সেফটি নেভিগেটর" : "Safety Navigator"}
            </h2>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 leading-snug">
              {lang === "bn" ? "৯৯৯ হটলাইন ও নিকটস্থ পুলিশ ইউনিট।" : "999 hotline & verified nearby police units."}
            </p>
          </Link>

          <Link
            href="/missing-person"
            className="group rounded-2xl border border-amber-950/60 bg-amber-950/20 p-4 hover:border-amber-400/80 transition"
          >
            <div className="h-9 w-9 rounded-xl bg-amber-600 text-white flex items-center justify-center text-lg mb-2 group-hover:scale-105 transition shadow-2xs">
              🔍
            </div>
            <h2 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 leading-tight">
              {lang === "bn" ? "নিখোঁজ ব্যক্তি" : "Missing Persons"}
            </h2>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 leading-snug">
              {lang === "bn" ? "সক্রিয় অনুসন্ধান ও সাইটিং রেসপন্স।" : "Active search alerts & sighting responses."}
            </p>
          </Link>

          <Link
            href="/safety-map"
            className="group rounded-2xl border border-emerald-950/60 bg-emerald-950/20 p-4 hover:border-emerald-400/80 transition"
          >
            <div className="h-9 w-9 rounded-xl bg-emerald-700 text-white flex items-center justify-center text-lg mb-2 group-hover:scale-105 transition shadow-2xs">
              🗺️
            </div>
            <h2 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 leading-tight">
              {lang === "bn" ? "কমিউনিটি মানচিত্র" : "Community Map"}
            </h2>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 leading-snug">
              {lang === "bn" ? "বিপদ ক্লাস্টারিং ও সুরক্ষা অ্যালার্ট।" : "Geographic hazard clustering & safety alerts."}
            </p>
          </Link>

          <Link
            href="/transparency"
            className="group rounded-2xl border border-blue-950/60 bg-blue-950/20 p-4 hover:border-blue-400/80 transition"
          >
            <div className="h-9 w-9 rounded-xl bg-blue-600 text-white flex items-center justify-center text-lg mb-2 group-hover:scale-105 transition shadow-2xs">
              📊
            </div>
            <h2 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 leading-tight">
              {lang === "bn" ? "স্বচ্ছতা ও তথ্য" : "Transparency"}
            </h2>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 leading-snug">
              {lang === "bn" ? "রিপোর্ট অ্যানালিটিক্স ও বার্ষিক প্রবণতা।" : "Platform report analytics & annual trends."}
            </p>
          </Link>
        </section>

        {/* =================================================================== */}
        {/* 3. RECENT COMMUNITY REPORTS FEED (Step 4 Core UI)                  */}
        {/* =================================================================== */}
        <section className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800/80 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse" />
                <h2 className="text-xl sm:text-2xl font-extrabold text-zinc-900 dark:text-zinc-100 tracking-tight">
                  {lang === "bn" ? "যাচাইকৃত নাগরিক ফিড" : "Verified Incident Feed"}
                </h2>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                {lang === "bn"
                  ? "অনুমোদিত নাগরিক রিপোর্ট ও কমিউনিটি পর্যবেক্ষণসমূহ।"
                  : "Public reports reviewed by authorized moderators across Bangladesh."}
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
            className="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xs"
          >
            <div className="sm:col-span-6 relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  lang === "bn"
                    ? "কীওয়ার্ড দিয়ে রিপোর্ট খুঁজুন (যেমন: আগুন, সড়ক, পানি)..."
                    : "Search incident keywords (e.g. fire, road, water)..."
                }
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 px-3.5 py-2.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
            </div>

            <div className="sm:col-span-4 relative">
              <input
                type="text"
                value={locationQuery}
                onChange={(e) => setLocationQuery(e.target.value)}
                placeholder={
                  lang === "bn"
                    ? "জেলা বা এলাকা (যেমন: ঢাকা, মিরপুর)..."
                    : "District or Area (e.g. Dhaka, Mirpur)..."
                }
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 px-3.5 py-2.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
            </div>

            <div className="sm:col-span-2">
              <button
                type="submit"
                className="w-full rounded-xl bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white py-2.5 text-xs font-bold transition shadow-xs"
              >
                {lang === "bn" ? "অনুসন্ধান" : "Search"}
              </button>
            </div>
          </form>

          {/* Active Filter Chips Summary */}
          {(selectedCategory || activeSearch || activeLocation || sortOrder !== "latest") && (
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
              <span className="text-zinc-400 font-medium">Active filters:</span>

              {selectedCategory && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 text-xs font-semibold">
                  Category: {categories.find((c) => c.id === selectedCategory)?.name || "Selected"}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategory("");
                      setPage(0);
                    }}
                    className="hover:text-emerald-950 dark:hover:text-white"
                  >
                    ×
                  </button>
                </span>
              )}

              {activeSearch && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 text-xs font-semibold">
                  Keyword: &quot;{activeSearch}&quot;
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSearch("");
                      setSearchQuery("");
                      setPage(0);
                    }}
                    className="hover:text-black dark:hover:text-white"
                  >
                    ×
                  </button>
                </span>
              )}

              {activeLocation && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 text-xs font-semibold">
                  Location: {activeLocation}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveLocation("");
                      setLocationQuery("");
                      setPage(0);
                    }}
                    className="hover:text-black dark:hover:text-white"
                  >
                    ×
                  </button>
                </span>
              )}

              {sortOrder !== "latest" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 text-xs font-semibold">
                  Sort: Trending
                  <button
                    type="button"
                    onClick={() => {
                      setSortOrder("latest");
                      setPage(0);
                    }}
                    className="hover:text-blue-950 dark:hover:text-white"
                  >
                    ×
                  </button>
                </span>
              )}

              <button
                type="button"
                onClick={clearAllFilters}
                className="text-xs text-red-600 dark:text-red-400 hover:underline font-bold ml-1"
              >
                Clear all
              </button>
            </div>
          )}

          {/* Category Chips Bar */}
          {categories.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory("");
                  setPage(0);
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition select-none ${
                  selectedCategory === ""
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-2xs font-bold"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                }`}
              >
                {lang === "bn" ? "সকল ধরন" : "All Incident Types"}
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(cat.id);
                    setPage(0);
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition select-none ${
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
              <p className="text-sm font-semibold text-red-800 dark:text-red-300 mb-3">
                {error}
              </p>
              <button
                onClick={() => setPage(0)}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-500 transition"
              >
                {lang === "bn" ? "পুনরায় চেষ্টা করুন" : "Retry Loading Feed"}
              </button>
            </div>
          ) : !data || data.items.length === 0 ? (
            <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-12 text-center space-y-3">
              <div className="text-4xl">📋</div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                {lang === "bn" ? "কোনো রিপোর্ট পাওয়া যায়নি" : "No Verified Reports Found"}
              </h3>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto leading-relaxed">
                {lang === "bn"
                  ? "আপনার অনুসন্ধান বা ফিল্টারের সাথে সামঞ্জস্যপূর্ণ কোনো রিপোর্ট নেই।"
                  : "There are currently no approved community reports matching your search or filter criteria."}
              </p>
              <div className="flex items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-2 text-xs font-bold hover:bg-zinc-50 transition"
                >
                  Clear Filters
                </button>
                <Link
                  href="/reports/create"
                  className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-600 transition"
                >
                  Submit Incident
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {data.items.map((report) => (
                <PublicReportCard key={report.id} report={report} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {data && totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
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
        </section>

        {/* =================================================================== */}
        {/* 4. PLATFORM TRANSPARENCY PREVIEW: Dynamic Real Metrics             */}
        {/* =================================================================== */}
        <section className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-8 shadow-2xs space-y-6">
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
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 hover:bg-blue-100 transition text-xs font-bold shrink-0 self-start sm:self-auto"
            >
              <span>{lang === "bn" ? "পূর্ণাঙ্গ ড্যাশবোর্ড" : "Full Analytics"}</span>
              <span>→</span>
            </Link>
          </div>

          {/* Dynamic Metric KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div className="rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-800/40 p-4 space-y-1">
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

            <div className="rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-800/40 p-4 space-y-1">
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

            <div className="rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-800/40 p-4 space-y-1">
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

            <div className="rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-800/40 p-4 space-y-1">
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
        {/* 5. ACTIVE MISSING PERSON HIGHLIGHT                                  */}
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
                  className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-3 animate-pulse"
                >
                  <div className="h-32 bg-zinc-200 dark:bg-zinc-800 rounded-xl w-full" />
                  <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-2/3" />
                  <div className="h-3 bg-zinc-100 dark:bg-zinc-800/50 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : missingAlerts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 text-center space-y-2">
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
                  className="inline-block px-3.5 py-2 rounded-xl bg-amber-600 text-white text-xs font-bold hover:bg-amber-500 transition"
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
                  className="group rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs hover:border-amber-500/40 hover:shadow-xs transition overflow-hidden flex flex-col justify-between"
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
        {/* 6. HOW CITIZEN REPORTS ARE VERIFIED (Pipeline)                      */}
        {/* =================================================================== */}
        <section className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 sm:p-10 shadow-2xs space-y-6">
          <div className="text-center max-w-xl mx-auto space-y-1">
            <h2 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
              {lang === "bn" ? "কীভাবে নাগরিক রিপোর্ট যাচাই করা হয়" : "How Citizen Reports Are Verified"}
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {lang === "bn"
                ? "প্রত্যেকটি রিপোর্ট জনসাধারণের সামনে প্রকাশের আগে কঠোরভাবে নিরীক্ষা করা হয়।"
                : "Every report on this platform undergoes rigorous checks before public publication."}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
            <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 p-5 space-y-2 border border-zinc-100 dark:border-zinc-800">
              <div className="h-8 w-8 rounded-lg bg-emerald-700 text-white flex items-center justify-center font-bold text-sm">
                1
              </div>
              <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                {lang === "bn" ? "প্রমাণ জমা" : "Evidence Submission"}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                {lang === "bn"
                  ? "নাগরিকরা যাচাইযোগ্য ছবি বা তথ্য দিয়ে রিপোর্ট করেন। বেনামী রিপোর্টিংয়ের মাধ্যমে পরিচয় নিরাপদ থাকে।"
                  : "Citizens submit reports with verifiable photographic or document evidence. Anonymous reporting protects reporter identity."}
              </p>
            </div>

            <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 p-5 space-y-2 border border-zinc-100 dark:border-zinc-800">
              <div className="h-8 w-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                2
              </div>
              <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                {lang === "bn" ? "মডারেটর নিরীক্ষা" : "Moderator Review"}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                {lang === "bn"
                  ? "অনুমোদিত মডারেটররা প্রমাণের সত্যতা ও স্থানাঙ্ক নিরীক্ষা করে ভূয়া তথ্য প্রতিহত করেন।"
                  : "Authorized moderators review media authenticity, verify location data, and inspect reports against hoax and duplicate signals."}
              </p>
            </div>

            <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 p-5 space-y-2 border border-zinc-100 dark:border-zinc-800">
              <div className="h-8 w-8 rounded-lg bg-purple-600 text-white flex items-center justify-center font-bold text-sm">
                3
              </div>
              <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                {lang === "bn" ? "জনসুরক্ষা ও পদক্ষেপ" : "Public Action & Safety"}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                {lang === "bn"
                  ? "অনুমোদিত রিপোর্টগুলো গোপনীয়তা বজায় রেখে ফিড, ম্যাপ এবং অ্যালার্ট সিস্টেমে প্রকাশিত হয়।"
                  : "Approved reports appear on the public feed, community safety map, and civic transparency dashboard with full location privacy."}
              </p>
            </div>
          </div>
        </section>

        {/* =================================================================== */}
        {/* 7. EMERGENCY 999 SECTION                                           */}
        {/* =================================================================== */}
        <section className="rounded-3xl border border-red-200 dark:border-red-950/80 bg-red-50/60 dark:bg-red-950/20 p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-2xs">
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
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-xs font-bold shadow-2xs transition"
            >
              <span>📞</span>
              <span>{lang === "bn" ? "কল ৯৯৯" : "Call 999"}</span>
            </a>
            <Link
              href="/safety"
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-red-300 dark:border-red-900 bg-white dark:bg-zinc-900 text-red-700 dark:text-red-300 text-xs font-bold hover:bg-red-50 dark:hover:bg-red-950/40 transition"
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
