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
import EmergencyCallModal from "@/components/EmergencyCallModal";
import { Capacitor } from "@capacitor/core";

export default function HomePage() {
  const { isAuthenticated, user } = useAuth();
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    setIsNative(Capacitor.isNativePlatform());
  }, []);

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

  // Emergency Call Dialog State
  const [emergencyModalOpen, setEmergencyModalOpen] = useState(false);

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

  // 5. Active Blood Requests Counter
  const [bloodCount, setBloodCount] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;
    apiFetch<{ total: number }>("/blood/requests?limit=1&status=OPEN")
      .then((res) => {
        if (isMounted && res && typeof res.total === "number") {
          setBloodCount(res.total);
        }
      })
      .catch(() => {});
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
    <div className="space-y-10 sm:space-y-12 pb-24 sm:pb-12">
      {/* =================================================================== */}
      {/* 1. HERO SECTION                                                     */}
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
        <div className="relative z-10 mx-auto max-w-5xl px-4 py-10 sm:py-16 text-center space-y-5">
          {/* Trust Pill */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 backdrop-blur-xs">
            <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.249-8.25-3.286Zm0 13.036h.008v.008H12v-.008Z" />
            </svg>
            <span>
              {lang === "bn"
                ? "নিরাপত্তা — যাচাইকৃত নাগরিক প্ল্যাটফর্ম • বাংলাদেশ"
                : "NIRAPOTTA — Verified Citizen Safety Platform • বাংলাদেশ"}
            </span>
          </div>

          {/* White Card Emblem Frame */}
          <div className="mx-auto h-16 w-16 sm:h-20 sm:w-20 relative rounded-2xl overflow-hidden shadow-xl border-2 border-emerald-500/40 bg-white p-1">
            <Image
              src="/brand/logo-sm.jpg"
              alt="NIRAPOTTA Emblem"
              fill
              className="object-contain p-1"
              priority
            />
          </div>

          {/* Headline */}
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-tight max-w-3xl mx-auto leading-tight">
            {lang === "bn"
              ? "নিরাপত্তা — নাগরিক সুরক্ষা নেটওয়ার্ক"
              : "NIRAPOTTA — Citizen Safety Network"}
          </h1>

          {/* Subtitle */}
          <p className="text-sm sm:text-base text-zinc-300 max-w-2xl mx-auto leading-relaxed">
            {lang === "bn"
              ? "নাগরিক নিরাপত্তা রক্ষা, দ্রুত দুর্ঘটনা রিপোর্ট, জরুরি সেবা ও নিখোঁজ ব্যক্তিদের সন্ধানে একটি নির্ভরযোগ্য জাতীয় প্ল্যাটফর্ম।"
              : "Report civic hazards, track community alerts, find nearby emergency services, and support verified missing person searches with privacy protection across Bangladesh."}
          </p>

          {/* CTA Buttons */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/reports/create"
              className="w-full sm:w-auto justify-center rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 text-xs sm:text-sm font-bold shadow-lg shadow-emerald-700/30 transition active:scale-95 flex items-center gap-2 min-h-[44px]"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span>{lang === "bn" ? "রিপোর্ট করুন" : "Report an Incident"}</span>
            </Link>

            <Link
              href="/safety"
              className="w-full sm:w-auto justify-center rounded-xl bg-red-600 hover:bg-red-500 text-white px-5 py-3 text-xs sm:text-sm font-bold shadow-lg shadow-red-700/30 transition active:scale-95 flex items-center gap-2 min-h-[44px]"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.249-8.25-3.286Zm0 13.036h.008v.008H12v-.008Z" />
              </svg>
              <span>{lang === "bn" ? "কাছাকাছি সাহায্য খুঁজুন" : "Find Help Near Me"}</span>
            </Link>

            <Link
              href="/safety-map"
              className="w-full sm:w-auto justify-center rounded-xl border border-zinc-700 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-200 px-4 py-3 text-xs sm:text-sm font-semibold transition backdrop-blur-xs flex items-center gap-1.5 min-h-[44px]"
            >
              <svg className="h-4 w-4 text-zinc-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.31a1.125 1.125 0 0 0-1.006 0L3.622 5.748A1.125 1.125 0 0 0 3 6.754v11.926c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z" />
              </svg>
              <span>{lang === "bn" ? "নিরাপত্তা মানচিত্র" : "Safety Map"}</span>
            </Link>

            {!isNative && (
              <a
                href="/nirapotta.apk"
                download="nirapotta.apk"
                className="w-full sm:w-auto justify-center rounded-xl border border-emerald-600/50 bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 px-4 py-3 text-xs sm:text-sm font-semibold transition backdrop-blur-xs flex items-center gap-1.5 shadow-xs min-h-[44px]"
                title={lang === "bn" ? "অ্যান্ড্রয়েড অ্যাপ ডাউনলোড করুন" : "Download Android App (APK)"}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
                </svg>
                <span>{lang === "bn" ? "অ্যাপ ডাউনলোড (APK)" : "Download APK"}</span>
              </a>
            )}
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
        {/* 2. CIVIC SAFETY DUO: Blood Help & Nirapotta Guard                  */}
        {/* =================================================================== */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Card A: Blood Help */}
          <div className="relative overflow-hidden rounded-3xl border border-rose-200 dark:border-rose-900/60 bg-gradient-to-br from-rose-50/70 via-white to-rose-50/30 dark:from-rose-950/40 dark:via-zinc-900 dark:to-zinc-950 p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30">
                  <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
                  </svg>
                  <span>{t.home_blood_cta_title}</span>
                </div>
                {bloodCount !== null && bloodCount > 0 && (
                  <span className="text-[11px] font-bold text-rose-700 dark:text-rose-400 bg-rose-100 dark:bg-rose-950/60 px-2.5 py-0.5 rounded-full">
                    {bloodCount} {lang === "bn" ? "সক্রিয় অনুরোধ" : "Active Requests"}
                  </span>
                )}
              </div>

              <div>
                <h2 className="text-lg sm:text-xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
                  {t.home_blood_cta_subtitle}
                </h2>
                <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 mt-1 leading-relaxed">
                  {lang === "bn"
                    ? "জরুরি রক্তের প্রয়োজনে তাৎক্ষণিক অনুরোধ জমা দিন অথবা নিবন্ধিত রক্তদাতা নেটওয়ার্কের মাধ্যমে জীবন বাঁচান।"
                    : "Request urgent blood units or connect instantly with verified community donors across Bangladesh."}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-2">
              <Link
                href="/blood-help/request"
                className="flex-1 min-w-[120px] inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white px-4 py-2.5 text-xs sm:text-sm font-bold shadow-xs shadow-rose-700/20 transition active:scale-95 min-h-[44px]"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
                </svg>
                <span>{t.home_blood_need_btn}</span>
              </Link>

              <Link
                href="/blood-help"
                className="flex-1 min-w-[120px] inline-flex items-center justify-center gap-2 rounded-xl border border-rose-300 dark:border-rose-800/80 bg-white dark:bg-zinc-800 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-zinc-700 px-4 py-2.5 text-xs sm:text-sm font-bold transition active:scale-95 min-h-[44px]"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
                </svg>
                <span>{t.home_blood_donate_btn}</span>
              </Link>

              <Link
                href="/blood-help/map"
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white/80 dark:bg-zinc-800/80 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 px-3.5 py-2.5 text-xs sm:text-sm font-semibold transition active:scale-95 min-h-[44px]"
                title={lang === "bn" ? "রক্ত সহায়তা মানচিত্র" : "Blood Request Map"}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                </svg>
                <span>{lang === "bn" ? "মানচিত্র" : "Map"}</span>
              </Link>
            </div>
          </div>

          {/* Card B: Nirapotta Guard */}
          <div className="relative overflow-hidden rounded-3xl border border-emerald-200 dark:border-emerald-900/60 bg-gradient-to-br from-emerald-50/70 via-white to-emerald-50/30 dark:from-emerald-950/40 dark:via-zinc-900 dark:to-zinc-950 p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30">
                  <span className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse" />
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.249-8.25-3.286Zm0 13.036h.008v.008H12v-.008Z" />
                  </svg>
                  <span>{lang === "bn" ? "নিরাপত্তা গার্ড" : "Nirapotta Guard"}</span>
                </div>
                <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full">
                  {lang === "bn" ? "ব্যক্তিগত জরুরি নেটওয়ার্ক" : "Personal SOS Network"}
                </span>
              </div>

              <div>
                <h2 className="text-lg sm:text-xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
                  {lang === "bn" ? "বিপদে পড়লে বিশ্বস্ত ব্যক্তিদের দ্রুত জানান" : "Emergency Assistance & Rapid Trusted Alerts"}
                </h2>
                <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 mt-1 leading-relaxed">
                  {lang === "bn"
                    ? "এক ক্লিকে আপনার পরিবার ও বিশ্বস্ত পরিচিতদের নিকট লাইভ জিপিএস লোকেশনসহ জরুরি অ্যালার্ট পাঠান।"
                    : "Stay protected wherever you go. Send instant emergency alerts with approximate GPS to your trusted circle."}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-2">
              <Link
                href="/guard"
                className="flex-1 min-w-[120px] inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 text-white px-4 py-2.5 text-xs sm:text-sm font-bold shadow-xs shadow-emerald-700/20 transition active:scale-95 min-h-[44px]"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
                <span>{lang === "bn" ? "গার্ড খুলুন" : "Open Guard"}</span>
              </Link>

              <Link
                href="/guard"
                className="flex-1 min-w-[120px] inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-300 dark:border-emerald-800/80 bg-white dark:bg-zinc-800 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-zinc-700 px-4 py-2.5 text-xs sm:text-sm font-bold transition active:scale-95 min-h-[44px]"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
                </svg>
                <span>{lang === "bn" ? "বিশ্বস্ত কন্টাক্ট" : "Trusted Circle"}</span>
              </Link>

              <button
                type="button"
                onClick={() => setEmergencyModalOpen(true)}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/60 text-red-700 dark:text-red-300 px-3.5 py-2.5 text-xs sm:text-sm font-semibold transition active:scale-95 min-h-[44px] cursor-pointer"
                title={lang === "bn" ? "জরুরি ৯৯৯ কল" : "Emergency 999"}
              >
                <svg className="h-4 w-4 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
                </svg>
                <span>৯৯৯</span>
              </button>
            </div>
          </div>
        </section>

        {/* =================================================================== */}
        {/* 3. CIVIC QUICK ACTIONS (6 Pillars: Report, Blood, Guard, Missing, Safety, Map) */}
        {/* =================================================================== */}
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          <Link
            href="/reports/create"
            className="group rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3.5 sm:p-4 hover:border-emerald-500/60 dark:hover:border-emerald-500/60 transition shadow-2xs flex flex-col justify-between"
          >
            <div>
              <div className="h-9 w-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center mb-2 group-hover:scale-105 transition shadow-2xs">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </div>
              <h2 className="font-bold text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 leading-tight">
                {lang === "bn" ? "রিপোর্ট করুন" : "Report Incident"}
              </h2>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 leading-snug">
                {lang === "bn" ? "নাগরিক সমস্যা ও ঝুঁকি।" : "Submit civic hazard report."}
              </p>
            </div>
          </Link>

          <Link
            href="/blood-help"
            className="group rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3.5 sm:p-4 hover:border-rose-500/60 dark:hover:border-rose-500/60 transition shadow-2xs flex flex-col justify-between"
          >
            <div>
              <div className="h-9 w-9 rounded-xl bg-rose-600 text-white flex items-center justify-center mb-2 group-hover:scale-105 transition shadow-2xs">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
                </svg>
              </div>
              <h2 className="font-bold text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 leading-tight">
                {lang === "bn" ? "রক্ত সহায়তা" : "Blood Help"}
              </h2>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 leading-snug">
                {lang === "bn" ? "রক্ত গ্রহণ ও রক্তদান।" : "Requests & donor network."}
              </p>
            </div>
          </Link>

          <Link
            href="/guard"
            className="group rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3.5 sm:p-4 hover:border-emerald-500/60 dark:hover:border-emerald-500/60 transition shadow-2xs flex flex-col justify-between"
          >
            <div>
              <div className="h-9 w-9 rounded-xl bg-emerald-700 text-white flex items-center justify-center mb-2 group-hover:scale-105 transition shadow-2xs">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.249-8.25-3.286Zm0 13.036h.008v.008H12v-.008Z" />
                </svg>
              </div>
              <h2 className="font-bold text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 leading-tight">
                {lang === "bn" ? "নিরাপত্তা গার্ড" : "Nirapotta Guard"}
              </h2>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 leading-snug">
                {lang === "bn" ? "ব্যক্তিগত জরুরি অ্যালার্ট।" : "Trusted emergency SOS."}
              </p>
            </div>
          </Link>

          <Link
            href="/missing-person"
            className="group rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3.5 sm:p-4 hover:border-amber-500/60 dark:hover:border-amber-500/60 transition shadow-2xs flex flex-col justify-between"
          >
            <div>
              <div className="h-9 w-9 rounded-xl bg-amber-600 text-white flex items-center justify-center mb-2 group-hover:scale-105 transition shadow-2xs">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
              </div>
              <h2 className="font-bold text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 leading-tight">
                {lang === "bn" ? "নিখোঁজ ব্যক্তি" : "Missing Person"}
              </h2>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 leading-snug">
                {lang === "bn" ? "সক্রিয় অনুসন্ধান ও তথ্য।" : "Active alerts & sightings."}
              </p>
            </div>
          </Link>

          <Link
            href="/safety"
            className="group rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3.5 sm:p-4 hover:border-red-500/60 dark:hover:border-red-500/60 transition shadow-2xs flex flex-col justify-between"
          >
            <div>
              <div className="h-9 w-9 rounded-xl bg-red-600 text-white flex items-center justify-center mb-2 group-hover:scale-105 transition shadow-2xs">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.249-8.25-3.286Zm0 13.036h.008v.008H12v-.008Z" />
                </svg>
              </div>
              <h2 className="font-bold text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 leading-tight">
                {lang === "bn" ? "সেফটি নেভিগেটর" : "Safety Navigator"}
              </h2>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 leading-snug">
                {lang === "bn" ? "৯৯৯ ও নিকটস্থ ইউনিট।" : "999 & nearest units."}
              </p>
            </div>
          </Link>

          <Link
            href="/safety-map"
            className="group rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3.5 sm:p-4 hover:border-blue-500/60 dark:hover:border-blue-500/60 transition shadow-2xs flex flex-col justify-between"
          >
            <div>
              <div className="h-9 w-9 rounded-xl bg-blue-600 text-white flex items-center justify-center mb-2 group-hover:scale-105 transition shadow-2xs">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.31a1.125 1.125 0 0 0-1.006 0L3.622 5.748A1.125 1.125 0 0 0 3 6.754v11.926c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z" />
                </svg>
              </div>
              <h2 className="font-bold text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 leading-tight">
                {lang === "bn" ? "নিরাপত্তা মানচিত্র" : "Safety Map"}
              </h2>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 leading-snug">
                {lang === "bn" ? "বিপদ ক্লাস্টার ও ম্যাপ।" : "Live hazard clustering."}
              </p>
            </div>
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
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 px-3.5 py-2.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-700 min-h-[44px]"
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
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 px-3.5 py-2.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-700 min-h-[44px]"
              />
            </div>

            <div className="sm:col-span-2">
              <button
                type="submit"
                className="w-full rounded-xl bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white py-2.5 text-xs font-bold transition shadow-xs min-h-[44px] flex items-center justify-center cursor-pointer"
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
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-500 transition min-h-[40px] inline-flex items-center justify-center cursor-pointer"
              >
                {lang === "bn" ? "পুনরায় চেষ্টা করুন" : "Retry Loading Feed"}
              </button>
            </div>
          ) : !data || data.items.length === 0 ? (
            <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 sm:p-12 text-center space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                {lang === "bn" ? "কোনো রিপোর্ট পাওয়া যায়নি" : "No Verified Reports Found"}
              </h3>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto leading-relaxed">
                {lang === "bn"
                  ? "আপনার অনুসন্ধান বা ফিল্টারের সাথে সামঞ্জস্যপূর্ণ কোনো রিপোর্ট নেই।"
                  : "There are currently no approved community reports matching your search or filter criteria."}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-2 text-xs font-bold hover:bg-zinc-50 transition min-h-[40px] flex items-center justify-center cursor-pointer"
                >
                  Clear Filters
                </button>
                <Link
                  href="/reports/create"
                  className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-600 transition min-h-[40px] flex items-center justify-center"
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
            <div className="flex flex-wrap items-center justify-center gap-2 pt-4">
              <button
                type="button"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-semibold disabled:opacity-40 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition min-h-[40px] flex items-center justify-center cursor-pointer disabled:cursor-not-allowed"
              >
                ← Previous
              </button>
              <span className="text-xs text-zinc-500 px-2 font-medium whitespace-nowrap">
                Page {page + 1} of {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
                className="px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-semibold disabled:opacity-40 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition min-h-[40px] flex items-center justify-center cursor-pointer disabled:cursor-not-allowed"
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
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
                  </svg>
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
            <div className="rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-800/40 p-3.5 sm:p-4 space-y-1">
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

            <div className="rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-800/40 p-3.5 sm:p-4 space-y-1">
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

            <div className="rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-800/40 p-3.5 sm:p-4 space-y-1">
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

            <div className="rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-800/40 p-3.5 sm:p-4 space-y-1">
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
            <span className="shrink-0 text-zinc-500 dark:text-zinc-400 mt-0.5">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
            </span>
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
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                  </svg>
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
                  className="px-3.5 py-2 rounded-xl bg-amber-600 text-white text-xs font-bold hover:bg-amber-500 transition min-h-[40px] inline-flex items-center justify-center cursor-pointer"
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
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate pt-1 flex items-center gap-1">
                        <svg className="h-3 w-3 shrink-0 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                        </svg>
                        <span>{alert.profile.last_seen_location}</span>
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
        <section className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-10 shadow-2xs space-y-6">
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
                  ? "নাগরিকরা ছবি, ভিডিও বা নথি সহযোগে ঘটনার স্থান ও সময়ের সুনির্দিষ্ট বিবরণ দেন।"
                  : "Citizens submit factual incident details accompanied by photos, videos, or documents."}
              </p>
            </div>

            <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 p-5 space-y-2 border border-zinc-100 dark:border-zinc-800">
              <div className="h-8 w-8 rounded-lg bg-amber-600 text-white flex items-center justify-center font-bold text-sm">
                2
              </div>
              <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                {lang === "bn" ? "মডারেশন নিরীক্ষা" : "Moderation Review"}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                {lang === "bn"
                  ? "মডারেটর দল বিভ্রান্তিকর বা ক্ষতিকারক তথ্য প্রতিহত করতে প্রমাণ যাচাই করেন।"
                  : "Authorized moderators audit the report for authenticity and community guideline compliance."}
              </p>
            </div>

            <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 p-5 space-y-2 border border-zinc-100 dark:border-zinc-800">
              <div className="h-8 w-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                3
              </div>
              <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                {lang === "bn" ? "সুরক্ষিত প্রকাশ" : "Safe Publication"}
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
        <section className="rounded-3xl border border-red-200 dark:border-red-950/80 bg-red-50/60 dark:bg-red-950/20 p-5 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-2xs">
          <div className="flex items-center gap-4 text-center sm:text-left">
            <div className="h-12 w-12 rounded-2xl bg-red-600 text-white flex items-center justify-center shrink-0 shadow-2xs mx-auto sm:mx-0">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.249-8.25-3.286Zm0 13.036h.008v.008H12v-.008Z" />
              </svg>
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

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto shrink-0">
            <button
              type="button"
              onClick={() => setEmergencyModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-xs font-bold shadow-2xs transition w-full sm:w-auto min-h-[48px] cursor-pointer"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
              </svg>
              <span>{lang === "bn" ? "কল ৯৯৯" : "Call 999"}</span>
            </button>
            <Link
              href="/safety"
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-red-300 dark:border-red-900 bg-white dark:bg-zinc-900 text-red-700 dark:text-red-300 text-xs font-bold hover:bg-red-50 dark:hover:bg-red-950/40 transition w-full sm:w-auto min-h-[48px]"
            >
              <span>{lang === "bn" ? "কাছাকাছি সেবা খুঁজুন" : "Find Units Near Me"}</span>
              <span>→</span>
            </Link>
          </div>
        </section>
      </div>

      {/* Emergency Call Confirmation Modal */}
      <EmergencyCallModal
        isOpen={emergencyModalOpen}
        onClose={() => setEmergencyModalOpen(false)}
        targetNumber="999"
        lang={lang}
      />
    </div>
  );
}
